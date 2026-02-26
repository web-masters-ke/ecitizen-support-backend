import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@config/prisma.service';
import { BrevoProvider } from './providers/brevo.provider';
import { BongaProvider } from './providers/bonga.provider';
import {
  SendNotificationDto,
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  QueryNotificationsDto,
  QueryNotificationTemplatesDto,
} from './dto/notifications.dto';
import axios from 'axios';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brevoProvider: BrevoProvider,
    private readonly bongaProvider: BongaProvider,
  ) {}

  // ============================================
  // Send Notification (main entry point)
  // ============================================

  async sendNotification(dto: SendNotificationDto) {
    // 1. Resolve template if provided
    let subject = dto.subject ?? '';
    let body = dto.body ?? '';

    if (dto.templateId) {
      const template = await this.prisma.notificationTemplate.findUnique({
        where: { id: dto.templateId },
      });
      if (template) {
        subject = this.interpolate(
          template.subjectTemplate ?? '',
          dto.templateVariables ?? {},
        );
        body = this.interpolate(
          template.bodyTemplate,
          dto.templateVariables ?? {},
        );
      } else {
        this.logger.warn(`Template ${dto.templateId} not found, using inline content`);
      }
    }

    // 2. Create notification record
    const notification = await this.prisma.notification.create({
      data: {
        agencyId: dto.agencyId ?? null,
        ticketId: dto.ticketId ?? null,
        templateId: dto.templateId ?? null,
        triggerEvent: dto.triggerEvent ?? null,
        channel: dto.channel,
        status: 'PENDING',
        maxRetries: dto.maxRetries ?? 3,
      },
    });

    // 3. Create recipient records
    const recipientRecords = await Promise.all(
      dto.recipients.map((r) =>
        this.prisma.notificationRecipient.create({
          data: {
            notificationId: notification.id,
            recipientUserId: r.recipientUserId ?? null,
            recipientEmail: r.recipientEmail ?? null,
            recipientPhone: r.recipientPhone ?? null,
            deliveryStatus: 'PENDING',
          },
        }),
      ),
    );

    // 4. Dispatch based on channel
    const results = await this.dispatch(
      notification.id,
      dto.channel,
      recipientRecords,
      subject,
      body,
      dto,
    );

    // 5. Update notification status based on results
    const allSuccess = results.every((r) => r.success);
    const anySuccess = results.some((r) => r.success);

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: allSuccess ? 'SENT' : anySuccess ? 'SENT' : 'FAILED',
        sentAt: anySuccess ? new Date() : null,
      },
    });

    return this.prisma.notification.findUnique({
      where: { id: notification.id },
      include: {
        recipients: true,
        deliveryLogs: true,
      },
    });
  }

  // ============================================
  // Channel Dispatch
  // ============================================

  private async dispatch(
    notificationId: string,
    channel: string,
    recipients: Array<{
      id: string;
      recipientEmail?: string | null;
      recipientPhone?: string | null;
      recipientUserId?: string | null;
    }>,
    subject: string,
    body: string,
    dto: SendNotificationDto,
  ): Promise<Array<{ recipientId: string; success: boolean; error?: string }>> {
    const results: Array<{
      recipientId: string;
      success: boolean;
      error?: string;
    }> = [];

    switch (channel) {
      case 'EMAIL':
        for (const recipient of recipients) {
          const email = recipient.recipientEmail ?? await this.resolveEmail(recipient.recipientUserId);
          if (!email) {
            await this.logDelivery(notificationId, recipient.id, 1, 'FAILED', 'No email address');
            results.push({ recipientId: recipient.id, success: false, error: 'No email address' });
            continue;
          }
          const result = await this.brevoProvider.sendEmail({
            to: [{ email }],
            subject,
            htmlContent: body,
          });
          const deliveryStatus = result.success ? 'DELIVERED' : 'FAILED';
          await this.logDelivery(
            notificationId,
            recipient.id,
            1,
            deliveryStatus,
            result.success ? result.messageId : result.error,
          );
          await this.logEmail(
            notificationId,
            email,
            subject,
            body,
            result.messageId,
            deliveryStatus,
          );
          await this.updateRecipientStatus(recipient.id, deliveryStatus);
          results.push({
            recipientId: recipient.id,
            success: result.success,
            error: result.error,
          });
        }
        break;

      case 'SMS':
        for (const recipient of recipients) {
          const phone = recipient.recipientPhone ?? await this.resolvePhone(recipient.recipientUserId);
          if (!phone) {
            await this.logDelivery(notificationId, recipient.id, 1, 'FAILED', 'No phone number');
            results.push({ recipientId: recipient.id, success: false, error: 'No phone number' });
            continue;
          }
          const normalizedPhone = BongaProvider.normalizeMsisdn(phone);
          const result = await this.bongaProvider.sendSms({
            phoneNumber: normalizedPhone,
            message: body,
          });
          const deliveryStatus = result.success ? 'DELIVERED' : 'FAILED';
          await this.logDelivery(
            notificationId,
            recipient.id,
            1,
            deliveryStatus,
            result.success ? result.messageId : result.error,
          );
          await this.logSms(
            notificationId,
            normalizedPhone,
            body,
            result.messageId,
            deliveryStatus,
          );
          await this.updateRecipientStatus(recipient.id, deliveryStatus);
          results.push({
            recipientId: recipient.id,
            success: result.success,
            error: result.error,
          });
        }
        break;

      case 'PUSH':
        // Push notification - store as push log, actual push integration is configurable
        for (const recipient of recipients) {
          await this.logPush(notificationId, null, subject, body, 'PENDING');
          await this.logDelivery(notificationId, recipient.id, 1, 'PENDING', 'Push queued');
          results.push({ recipientId: recipient.id, success: true });
        }
        break;

      case 'IN_APP':
        // In-app notifications are stored as records; clients poll or use websockets
        for (const recipient of recipients) {
          await this.logDelivery(
            notificationId,
            recipient.id,
            1,
            'DELIVERED',
            'In-app notification stored',
          );
          await this.updateRecipientStatus(recipient.id, 'DELIVERED');
          results.push({ recipientId: recipient.id, success: true });
        }
        break;

      case 'WEBHOOK':
        const webhookUrl = dto.webhookUrl;
        if (!webhookUrl) {
          for (const recipient of recipients) {
            await this.logDelivery(notificationId, recipient.id, 1, 'FAILED', 'No webhook URL');
            results.push({ recipientId: recipient.id, success: false, error: 'No webhook URL' });
          }
          break;
        }
        try {
          const webhookPayload = dto.webhookPayload ?? {
            notificationId,
            channel,
            subject,
            body,
            recipients: recipients.map((r) => ({
              userId: r.recipientUserId,
              email: r.recipientEmail,
              phone: r.recipientPhone,
            })),
          };
          const response = await axios.post(webhookUrl, webhookPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
          });
          await this.logWebhook(
            notificationId,
            webhookUrl,
            webhookPayload,
            response.status,
            JSON.stringify(response.data),
          );
          for (const recipient of recipients) {
            await this.logDelivery(
              notificationId,
              recipient.id,
              1,
              'DELIVERED',
              `Webhook status: ${response.status}`,
            );
            await this.updateRecipientStatus(recipient.id, 'DELIVERED');
            results.push({ recipientId: recipient.id, success: true });
          }
        } catch (err: any) {
          const errorMsg = err.response
            ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
            : err.message;
          await this.logWebhook(
            notificationId,
            webhookUrl,
            dto.webhookPayload ?? {},
            err.response?.status ?? 0,
            errorMsg,
          );
          for (const recipient of recipients) {
            await this.logDelivery(
              notificationId,
              recipient.id,
              1,
              'FAILED',
              errorMsg,
            );
            results.push({
              recipientId: recipient.id,
              success: false,
              error: errorMsg,
            });
          }
        }
        break;

      default:
        this.logger.warn(`Unknown notification channel: ${channel}`);
        for (const recipient of recipients) {
          results.push({
            recipientId: recipient.id,
            success: false,
            error: `Unknown channel: ${channel}`,
          });
        }
    }

    return results;
  }

  // ============================================
  // Retry Processing (cron-based)
  // ============================================

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processRetries() {
    // Fetch failed/retrying notifications that still have retries remaining.
    // We filter retryCount < maxRetries in application code because maxRetries
    // is a per-record value, not a global constant.
    const failedNotifications = await this.prisma.notification.findMany({
      where: {
        status: { in: ['FAILED', 'RETRYING'] },
      },
      include: {
        recipients: {
          where: { deliveryStatus: { in: ['FAILED', 'PENDING'] } },
        },
        template: true,
      },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    const retryable = failedNotifications.filter(
      (n) => n.retryCount < n.maxRetries,
    );

    if (retryable.length === 0) return;

    this.logger.log(`Processing ${retryable.length} notifications for retry`);

    for (const notification of retryable) {
      // Mark as retrying
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'RETRYING',
          retryCount: { increment: 1 },
        },
      });

      // Resolve content
      let subject = '';
      let body = '';
      if (notification.template) {
        subject = notification.template.subjectTemplate ?? '';
        body = notification.template.bodyTemplate;
      }

      // Re-dispatch to failed recipients
      const results = await this.dispatch(
        notification.id,
        notification.channel,
        notification.recipients,
        subject,
        body,
        {
          channel: notification.channel as any,
          recipients: [],
        },
      );

      const allSuccess = results.every((r) => r.success);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: allSuccess ? 'SENT' : 'FAILED',
          sentAt: allSuccess ? new Date() : undefined,
        },
      });
    }
  }

  // ============================================
  // Notification Queries
  // ============================================

  async findNotifications(query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.agencyId) where.agencyId = query.agencyId;
    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;

    // When scoped to a specific recipient, filter via the recipients join table
    if (query.recipientUserId) {
      where.recipients = { some: { recipientUserId: query.recipientUserId } };
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          recipients: true,
          template: {
            select: { id: true, templateName: true, channel: true },
          },
          ticket: {
            select: { id: true, ticketNumber: true, subject: true },
          },
          agency: {
            select: { id: true, agencyName: true, agencyCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    // Count unread: IN_APP recipient records not yet delivered (deliveredAt is null)
    let unreadCount = 0;
    if (query.recipientUserId) {
      unreadCount = await this.prisma.notificationRecipient.count({
        where: {
          recipientUserId: query.recipientUserId,
          deliveredAt: null,
          notification: { channel: 'IN_APP' },
        },
      });
    }

    return {
      items,
      unreadCount,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findNotificationById(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        recipients: true,
        deliveryLogs: {
          orderBy: { attemptedAt: 'desc' },
        },
        smsLogs: {
          orderBy: { sentAt: 'desc' },
        },
        emailLogs: {
          orderBy: { sentAt: 'desc' },
        },
        pushLogs: {
          orderBy: { sentAt: 'desc' },
        },
        webhookLogs: {
          orderBy: { sentAt: 'desc' },
        },
        template: true,
        ticket: {
          select: { id: true, ticketNumber: true, subject: true },
        },
        agency: {
          select: { id: true, agencyName: true, agencyCode: true },
        },
      },
    });
    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    return notification;
  }

  // ============================================
  // Notification Template CRUD
  // ============================================

  async createTemplate(dto: CreateNotificationTemplateDto) {
    return this.prisma.notificationTemplate.create({
      data: {
        agencyId: dto.agencyId ?? null,
        templateName: dto.templateName,
        channel: dto.channel,
        subjectTemplate: dto.subjectTemplate ?? null,
        bodyTemplate: dto.bodyTemplate,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findTemplates(query: QueryNotificationTemplatesDto) {
    const where: any = {};
    if (query.agencyId) where.agencyId = query.agencyId;
    if (query.channel) where.channel = query.channel;

    return this.prisma.notificationTemplate.findMany({
      where,
      include: {
        agency: { select: { id: true, agencyName: true, agencyCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTemplate(id: string, dto: UpdateNotificationTemplateDto) {
    const existing = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Notification template ${id} not found`);
    }

    return this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...(dto.templateName !== undefined && { templateName: dto.templateName }),
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.subjectTemplate !== undefined && {
          subjectTemplate: dto.subjectTemplate,
        }),
        ...(dto.bodyTemplate !== undefined && { bodyTemplate: dto.bodyTemplate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Interpolate template variables in the format {{variableName}}.
   */
  private interpolate(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  /**
   * Resolve a user's email address by their user ID.
   */
  private async resolveEmail(userId?: string | null): Promise<string | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  }

  /**
   * Resolve a user's phone number by their user ID.
   */
  private async resolvePhone(userId?: string | null): Promise<string | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true },
    });
    return user?.phoneNumber ?? null;
  }

  private async logDelivery(
    notificationId: string,
    recipientId: string,
    attemptNumber: number,
    status: string,
    providerResponse?: string,
  ) {
    await this.prisma.notificationDeliveryLog.create({
      data: {
        notificationId,
        recipientId,
        attemptNumber,
        deliveryStatus: status as any,
        providerResponse: providerResponse ?? null,
      },
    });
  }

  private async updateRecipientStatus(recipientId: string, status: string) {
    await this.prisma.notificationRecipient.update({
      where: { id: recipientId },
      data: {
        deliveryStatus: status as any,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      },
    });
  }

  private async logEmail(
    notificationId: string,
    recipientEmail: string,
    subject: string,
    body: string,
    providerMessageId?: string,
    deliveryStatus?: string,
  ) {
    await this.prisma.emailLog.create({
      data: {
        notificationId,
        recipientEmail,
        subject,
        messageBody: body,
        providerName: 'BREVO',
        providerMessageId: providerMessageId ?? null,
        deliveryStatus: deliveryStatus ?? 'PENDING',
      },
    });
  }

  private async logSms(
    notificationId: string,
    phoneNumber: string,
    message: string,
    providerMessageId?: string,
    deliveryStatus?: string,
  ) {
    await this.prisma.smsLog.create({
      data: {
        notificationId,
        phoneNumber,
        messageBody: message,
        providerName: 'BONGA_SMS',
        providerMessageId: providerMessageId ?? null,
        deliveryStatus: deliveryStatus ?? 'PENDING',
      },
    });
  }

  private async logPush(
    notificationId: string,
    deviceToken: string | null,
    title: string,
    body: string,
    deliveryStatus: string,
  ) {
    await this.prisma.pushLog.create({
      data: {
        notificationId,
        deviceToken,
        messageTitle: title,
        messageBody: body,
        deliveryStatus,
      },
    });
  }

  private async logWebhook(
    notificationId: string,
    targetUrl: string,
    payload: any,
    responseStatus: number,
    responseBody: string,
  ) {
    await this.prisma.webhookLog.create({
      data: {
        notificationId,
        targetUrl,
        payload,
        responseStatus,
        responseBody,
      },
    });
  }
}
