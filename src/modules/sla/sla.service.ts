import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@config/prisma.service';
import { KafkaService } from '../kafka/kafka.service';
import { NotificationsService } from '../notifications/notifications.service';
import { KAFKA_TOPICS, partitionKey } from '../kafka/kafka.topics';
import {
  CreateSlaPolicyDto,
  UpdateSlaPolicyDto,
  CreateSlaRuleDto,
  CreateEscalationMatrixDto,
  SetEscalationLevelsDto,
  QueryBreachesDto,
} from './dto/sla.dto';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaService: KafkaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ============================================
  // SLA Policy CRUD
  // ============================================

  async createPolicy(dto: CreateSlaPolicyDto) {
    return this.prisma.slaPolicy.create({
      data: {
        agencyId: dto.agencyId,
        policyName: dto.policyName,
        description: dto.description,
        isActive: dto.isActive ?? true,
        appliesBusinessHours: dto.appliesBusinessHours ?? true,
      },
      include: { slaRules: true },
    });
  }

  async findPolicies(agencyId?: string) {
    const where: any = {};
    if (agencyId) {
      where.agencyId = agencyId;
    }
    return this.prisma.slaPolicy.findMany({
      where,
      include: {
        slaRules: {
          include: { priority: true, category: true },
        },
        agency: { select: { id: true, agencyName: true, agencyCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPolicyById(id: string) {
    const policy = await this.prisma.slaPolicy.findUnique({
      where: { id },
      include: {
        slaRules: {
          include: { priority: true, category: true },
        },
        agency: { select: { id: true, agencyName: true, agencyCode: true } },
      },
    });
    if (!policy) {
      throw new NotFoundException(`SLA Policy ${id} not found`);
    }
    return policy;
  }

  async updatePolicy(id: string, dto: UpdateSlaPolicyDto) {
    await this.findPolicyById(id);
    return this.prisma.slaPolicy.update({
      where: { id },
      data: {
        ...(dto.policyName !== undefined && { policyName: dto.policyName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.appliesBusinessHours !== undefined && {
          appliesBusinessHours: dto.appliesBusinessHours,
        }),
      },
      include: { slaRules: true },
    });
  }

  async deletePolicy(id: string) {
    await this.findPolicyById(id);
    // Soft archive — preserve audit trail for already-tracked tickets.
    await this.prisma.slaPolicy.update({
      where: { id },
      data: {
        isActive: false,
        archivedAt: new Date(),
      },
    });
  }

  // ============================================
  // Change Request approval workflow
  // ============================================

  async submitChangeRequest(args: {
    agencyId: string;
    action: 'CREATE' | 'UPDATE' | 'ARCHIVE';
    targetPolicyId?: string;
    payload: Record<string, unknown>;
    requestReason?: string;
    requestedBy: string;
  }) {
    if (args.action !== 'CREATE' && !args.targetPolicyId) {
      throw new BadRequestException('targetPolicyId is required for UPDATE / ARCHIVE');
    }
    // Validate UUID shape before hitting Prisma so we return a clean 400
    // instead of letting a Prisma "Inconsistent column data: Error creating UUID"
    // stacktrace bubble up to the API consumer.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (args.targetPolicyId && !uuidRe.test(args.targetPolicyId)) {
      throw new BadRequestException('targetPolicyId must be a valid UUID');
    }
    if (args.targetPolicyId) {
      // Confirm the policy exists and belongs to the same agency to avoid
      // cross-agency tampering via crafted IDs.
      const policy = await this.prisma.slaPolicy.findUnique({
        where: { id: args.targetPolicyId },
        select: { id: true, agencyId: true },
      });
      if (!policy) throw new NotFoundException('Target SLA policy not found');
      if (policy.agencyId !== args.agencyId) {
        throw new BadRequestException('Target policy does not belong to the selected agency');
      }
    }
    return this.prisma.slaChangeRequest.create({
      data: {
        agencyId: args.agencyId,
        targetPolicyId: args.targetPolicyId,
        action: args.action as any,
        payload: args.payload as any,
        requestReason: args.requestReason,
        requestedBy: args.requestedBy,
      },
    });
  }

  async listChangeRequests(args: { status?: string; agencyId?: string }) {
    return this.prisma.slaChangeRequest.findMany({
      where: {
        ...(args.status ? { status: args.status as any } : {}),
        ...(args.agencyId ? { agencyId: args.agencyId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async approveChangeRequest(id: string, reviewerId: string, comment?: string) {
    const req = await this.prisma.slaChangeRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException(`SLA change request ${id} not found`);
    if (req.status !== 'PENDING') {
      throw new NotFoundException(`Change request ${id} already ${req.status.toLowerCase()}`);
    }
    const payload = (req.payload ?? {}) as Record<string, any>;

    // Replay the requested change atomically with the approval transition.
    if (req.action === 'CREATE') {
      await this.prisma.slaPolicy.create({
        data: {
          agencyId: req.agencyId,
          policyName: payload.policyName,
          description: payload.description ?? null,
          isActive: payload.isActive ?? true,
          appliesBusinessHours: payload.appliesBusinessHours ?? true,
        },
      });
    } else if (req.action === 'UPDATE' && req.targetPolicyId) {
      await this.prisma.slaPolicy.update({
        where: { id: req.targetPolicyId },
        data: {
          ...(payload.policyName !== undefined ? { policyName: payload.policyName } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
          ...(payload.appliesBusinessHours !== undefined ? { appliesBusinessHours: payload.appliesBusinessHours } : {}),
        },
      });
    } else if (req.action === 'ARCHIVE' && req.targetPolicyId) {
      await this.prisma.slaPolicy.update({
        where: { id: req.targetPolicyId },
        data: {
          isActive: false,
          archivedAt: new Date(),
          archivedBy: reviewerId,
        },
      });
    }

    return this.prisma.slaChangeRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewerComment: comment ?? null,
      },
    });
  }

  async rejectChangeRequest(id: string, reviewerId: string, comment?: string) {
    const req = await this.prisma.slaChangeRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException(`SLA change request ${id} not found`);
    if (req.status !== 'PENDING') {
      throw new NotFoundException(`Change request ${id} already ${req.status.toLowerCase()}`);
    }
    return this.prisma.slaChangeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewerComment: comment ?? null,
      },
    });
  }

  async deleteRule(policyId: string, ruleId: string) {
    const rule = await this.prisma.slaRule.findFirst({
      where: { id: ruleId, slaPolicyId: policyId },
    });
    if (!rule) {
      throw new NotFoundException(
        `SLA rule ${ruleId} not found in policy ${policyId}`,
      );
    }
    await this.prisma.slaRule.delete({ where: { id: ruleId } });
  }

  async addRule(policyId: string, dto: CreateSlaRuleDto) {
    await this.findPolicyById(policyId);
    return this.prisma.slaRule.create({
      data: {
        slaPolicyId: policyId,
        priorityId: dto.priorityId,
        categoryId: dto.categoryId,
        responseTimeMinutes: dto.responseTimeMinutes,
        resolutionTimeMinutes: dto.resolutionTimeMinutes,
        escalationAfterMinutes: dto.escalationAfterMinutes,
      },
      include: { priority: true, category: true },
    });
  }

  // ============================================
  // SLA Tracking
  // ============================================

  async getTrackingForTicket(ticketId: string) {
    const tracking = await this.prisma.slaTracking.findUnique({
      where: { ticketId },
      include: {
        slaPolicy: true,
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            agencyId: true,
            priorityId: true,
            categoryId: true,
            firstResponseAt: true,
            resolvedAt: true,
          },
        },
        escalationEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        breachLogs: {
          orderBy: { recordedAt: 'desc' },
          take: 10,
        },
      },
    });
    // "No tracking yet" is a valid state — happens when the ticket's agency
    // has no SLA policy with a rule matching the ticket's priority/category.
    // Return null so the frontend can render the SLA panel as not-configured
    // instead of treating it as a 404 error.
    if (!tracking) {
      return null;
    }

    // Compute live status
    const now = new Date();
    const responseOverdue =
      !tracking.responseMet &&
      !tracking.responseBreached &&
      now > tracking.responseDueAt;
    const resolutionOverdue =
      !tracking.resolutionMet &&
      !tracking.resolutionBreached &&
      now > tracking.resolutionDueAt;

    return {
      ...tracking,
      liveStatus: {
        responseOverdue,
        resolutionOverdue,
        responseTimeRemaining: responseOverdue
          ? 0
          : Math.max(
              0,
              Math.round(
                (tracking.responseDueAt.getTime() - now.getTime()) / 60000,
              ),
            ),
        resolutionTimeRemaining: resolutionOverdue
          ? 0
          : Math.max(
              0,
              Math.round(
                (tracking.resolutionDueAt.getTime() - now.getTime()) / 60000,
              ),
            ),
      },
    };
  }

  /**
   * attachSlaToTicket - called when a ticket is created.
   * Finds the matching SLA policy and rule for the ticket's agency, priority, and category.
   * Creates an sla_tracking record with calculated due dates.
   */
  async attachSlaToTicket(ticket: {
    id: string;
    agencyId: string;
    priorityId?: string | null;
    categoryId?: string | null;
    createdAt: Date;
  }) {
    // Find the active SLA policy for this agency
    const policy = await this.prisma.slaPolicy.findFirst({
      where: {
        agencyId: ticket.agencyId,
        isActive: true,
      },
      include: {
        slaRules: {
          include: { priority: true, category: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!policy || policy.slaRules.length === 0) {
      this.logger.warn(
        `No active SLA policy found for agency ${ticket.agencyId}`,
      );
      return null;
    }

    // Find the best matching rule:
    // 1. Exact match on both priority and category
    // 2. Match on priority only
    // 3. Match on category only
    // 4. Catch-all rule (no priority, no category)
    const rule = this.findBestMatchingRule(
      policy.slaRules,
      ticket.priorityId,
      ticket.categoryId,
    );

    if (!rule) {
      this.logger.warn(
        `No matching SLA rule found in policy ${policy.id} for ticket ${ticket.id}`,
      );
      return null;
    }

    // Calculate due dates
    const baseTime = ticket.createdAt;
    const responseDueAt = await this.calculateDueDate(
      baseTime,
      rule.responseTimeMinutes,
      policy.appliesBusinessHours,
      ticket.agencyId,
    );
    const resolutionDueAt = await this.calculateDueDate(
      baseTime,
      rule.resolutionTimeMinutes,
      policy.appliesBusinessHours,
      ticket.agencyId,
    );

    // Create tracking record
    const tracking = await this.prisma.slaTracking.create({
      data: {
        ticketId: ticket.id,
        slaPolicyId: policy.id,
        responseDueAt,
        resolutionDueAt,
      },
    });

    // Update the ticket with SLA due dates
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        slaResponseDueAt: responseDueAt,
        slaResolutionDueAt: resolutionDueAt,
      },
    });

    this.logger.log(
      `SLA attached to ticket ${ticket.id}: response due ${responseDueAt.toISOString()}, resolution due ${resolutionDueAt.toISOString()}`,
    );

    return tracking;
  }

  /**
   * checkApproachingBreaches - Cron job that runs every minute.
   * Notifies the assigned agent ~30 minutes before responseDueAt or
   * resolutionDueAt, exactly once per tracking row (gated by
   * response_warning_at / resolution_warning_at).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkApproachingBreaches() {
    const WARN_LEAD_MINUTES = 30;
    const now = new Date();
    const warnHorizon = new Date(now.getTime() + WARN_LEAD_MINUTES * 60_000);

    const rows = await this.prisma.slaTracking.findMany({
      where: {
        OR: [
          {
            responseWarningAt: null,
            responseMet: null,
            responseBreached: false,
            responseDueAt: { gt: now, lte: warnHorizon },
          },
          {
            resolutionWarningAt: null,
            resolutionMet: null,
            resolutionBreached: false,
            resolutionDueAt: { gt: now, lte: warnHorizon },
          },
        ],
      },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            currentAssigneeId: true,
            agencyId: true,
          },
        },
      },
    });

    for (const t of rows) {
      const responseInWindow =
        !t.responseWarningAt &&
        t.responseMet === null &&
        !t.responseBreached &&
        t.responseDueAt > now &&
        t.responseDueAt <= warnHorizon;
      const resolutionInWindow =
        !t.resolutionWarningAt &&
        t.resolutionMet === null &&
        !t.resolutionBreached &&
        t.resolutionDueAt > now &&
        t.resolutionDueAt <= warnHorizon;
      if (!responseInWindow && !resolutionInWindow) continue;

      const assigneeId = t.ticket.currentAssigneeId;
      if (!assigneeId) {
        // Mark as warned anyway to avoid loop; agency admins still see breach later.
        await this.prisma.slaTracking.update({
          where: { id: t.id },
          data: {
            ...(responseInWindow ? { responseWarningAt: now } : {}),
            ...(resolutionInWindow ? { resolutionWarningAt: now } : {}),
          },
        });
        continue;
      }

      const agent = await this.prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true, firstName: true, email: true, phoneNumber: true },
      });
      if (agent?.id) {
        const which = responseInWindow ? 'response' : 'resolution';
        const dueAt = responseInWindow ? t.responseDueAt : t.resolutionDueAt;
        const minsLeft = Math.max(0, Math.round((dueAt.getTime() - now.getTime()) / 60000));
        const subject = `⏰ Ticket ${t.ticket.ticketNumber} ${which} due in ~${minsLeft} min`;
        const body = `Hi ${agent.firstName ?? 'there'},\n\nTicket <strong>${t.ticket.ticketNumber}</strong> — <em>${t.ticket.subject}</em> — is approaching its ${which} SLA.\n\nDue at: ${dueAt.toISOString()}\n\nPlease action it before the SLA breaches.\n\neCitizen Service Command Centre`;
        const recipient = {
          recipientUserId: agent.id,
          recipientEmail: agent.email ?? undefined,
          recipientPhone: agent.phoneNumber ?? undefined,
        };
        this.notificationsService
          .sendNotification({ ticketId: t.ticket.id, channel: 'IN_APP' as any, triggerEvent: 'SLA_APPROACHING', subject, body, recipients: [recipient] })
          .catch((err) => this.logger.warn(`SLA-warning IN_APP failed: ${err?.message}`));
        if (agent.email) {
          this.notificationsService
            .sendNotification({ ticketId: t.ticket.id, channel: 'EMAIL' as any, triggerEvent: 'SLA_APPROACHING', subject, body, recipients: [recipient] })
            .catch((err) => this.logger.warn(`SLA-warning EMAIL failed: ${err?.message}`));
        }
      }

      await this.prisma.slaTracking.update({
        where: { id: t.id },
        data: {
          ...(responseInWindow ? { responseWarningAt: now } : {}),
          ...(resolutionInWindow ? { resolutionWarningAt: now } : {}),
        },
      });
    }
  }

  /**
   * checkBreaches - Cron job that runs every minute.
   * Scans sla_tracking records for breaches and creates breach_logs + triggers escalation.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkBreaches() {
    const now = new Date();
    this.logger.debug('Running SLA breach check...');

    // Find all tracking records that are not yet breached and are overdue
    const overdueResponse = await this.prisma.slaTracking.findMany({
      where: {
        responseBreached: false,
        responseMet: null,
        responseDueAt: { lt: now },
      },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            agencyId: true,
            createdBy: true,
            statusId: true,
            isEscalated: true,
            escalationLevel: true,
            firstResponseAt: true,
            status: true,
          },
        },
      },
    });

    const overdueResolution = await this.prisma.slaTracking.findMany({
      where: {
        resolutionBreached: false,
        resolutionMet: null,
        resolutionDueAt: { lt: now },
      },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            agencyId: true,
            createdBy: true,
            statusId: true,
            isEscalated: true,
            escalationLevel: true,
            resolvedAt: true,
            status: true,
          },
        },
      },
    });

    // Process response breaches
    for (const tracking of overdueResponse) {
      // Skip if ticket is already closed/resolved
      if (
        tracking.ticket.status?.isClosedStatus ||
        tracking.ticket.firstResponseAt
      ) {
        // Mark response as met if first response already happened
        if (tracking.ticket.firstResponseAt) {
          await this.prisma.slaTracking.update({
            where: { id: tracking.id },
            data: {
              responseMet:
                tracking.ticket.firstResponseAt <= tracking.responseDueAt,
            },
          });
        }
        continue;
      }

      const breachDuration = Math.round(
        (now.getTime() - tracking.responseDueAt.getTime()) / 60000,
      );

      await this.prisma.$transaction([
        // Mark as breached
        this.prisma.slaTracking.update({
          where: { id: tracking.id },
          data: {
            responseBreached: true,
            responseBreachAt: now,
          },
        }),
        // Create breach log
        this.prisma.breachLog.create({
          data: {
            ticketId: tracking.ticket.id,
            slaTrackingId: tracking.id,
            breachType: 'RESPONSE',
            breachTimestamp: now,
            breachDurationMinutes: breachDuration,
          },
        }),
      ]);

      this.logger.warn(
        `RESPONSE SLA breached for ticket ${tracking.ticket.ticketNumber} (${breachDuration} minutes overdue)`,
      );

      this.kafkaService.publish({
        topic: KAFKA_TOPICS.SLA_BREACHED,
        key: partitionKey.byTicket(tracking.ticket.id),
        value: {
          ticketId: tracking.ticket.id,
          ticketNumber: tracking.ticket.ticketNumber,
          agencyId: tracking.ticket.agencyId,
          breachType: 'RESPONSE',
          breachDurationMinutes: breachDuration,
          createdBy: tracking.ticket.createdBy,
        },
      }).catch(() => null);

      // Trigger escalation
      await this.triggerEscalation(tracking.ticket.id, tracking.id, 'RESPONSE');
    }

    // Process resolution breaches
    for (const tracking of overdueResolution) {
      if (
        tracking.ticket.status?.isClosedStatus ||
        tracking.ticket.resolvedAt
      ) {
        if (tracking.ticket.resolvedAt) {
          await this.prisma.slaTracking.update({
            where: { id: tracking.id },
            data: {
              resolutionMet:
                tracking.ticket.resolvedAt <= tracking.resolutionDueAt,
            },
          });
        }
        continue;
      }

      const breachDuration = Math.round(
        (now.getTime() - tracking.resolutionDueAt.getTime()) / 60000,
      );

      await this.prisma.$transaction([
        this.prisma.slaTracking.update({
          where: { id: tracking.id },
          data: {
            resolutionBreached: true,
            resolutionBreachAt: now,
          },
        }),
        this.prisma.breachLog.create({
          data: {
            ticketId: tracking.ticket.id,
            slaTrackingId: tracking.id,
            breachType: 'RESOLUTION',
            breachTimestamp: now,
            breachDurationMinutes: breachDuration,
          },
        }),
      ]);

      this.logger.warn(
        `RESOLUTION SLA breached for ticket ${tracking.ticket.ticketNumber} (${breachDuration} minutes overdue)`,
      );

      this.kafkaService.publish({
        topic: KAFKA_TOPICS.SLA_BREACHED,
        key: partitionKey.byTicket(tracking.ticket.id),
        value: {
          ticketId: tracking.ticket.id,
          ticketNumber: tracking.ticket.ticketNumber,
          agencyId: tracking.ticket.agencyId,
          breachType: 'RESOLUTION',
          breachDurationMinutes: breachDuration,
          createdBy: tracking.ticket.createdBy,
        },
      }).catch(() => null);

      await this.triggerEscalation(
        tracking.ticket.id,
        tracking.id,
        'RESOLUTION',
      );
    }

    if (overdueResponse.length > 0 || overdueResolution.length > 0) {
      this.logger.log(
        `Breach check complete: ${overdueResponse.length} response breaches, ${overdueResolution.length} resolution breaches`,
      );
    }
  }

  // ============================================
  // Escalation
  // ============================================

  private async triggerEscalation(
    ticketId: string,
    slaTrackingId: string,
    breachType: 'RESPONSE' | 'RESOLUTION',
  ) {
    const tracking = await this.prisma.slaTracking.findUnique({
      where: { id: slaTrackingId },
      include: {
        ticket: {
          select: {
            agencyId: true,
            escalationLevel: true,
            priority: { select: { name: true } },
          },
        },
      },
    });
    if (!tracking) return;

    const currentLevel = tracking.escalationLevel;
    const newLevel = currentLevel + 1;
    const priorityName = tracking.ticket.priority?.name;

    // Find the escalation matrix for this agency + the ticket's priority.
    // Without the priority filter we'd grab any matrix the agency has and
    // route on the wrong ladder.
    const matrix = await this.prisma.escalationMatrix.findFirst({
      where: {
        agencyId: tracking.ticket.agencyId,
        autoEscalationEnabled: true,
        ...(priorityName ? { priorityLevel: priorityName } : {}),
      },
      include: {
        escalationLevels: {
          where: { levelNumber: newLevel },
        },
      },
    });

    if (!matrix || matrix.escalationLevels.length === 0) {
      this.logger.debug(
        `No escalation level ${newLevel} defined for agency ${tracking.ticket.agencyId}`,
      );
      return;
    }

    const escalationLevel = matrix.escalationLevels[0];

    // Create escalation event
    await this.prisma.$transaction([
      this.prisma.escalationEvent.create({
        data: {
          ticketId,
          slaTrackingId,
          previousLevel: currentLevel,
          newLevel,
          escalatedToRole: escalationLevel.escalationRole,
          escalationReason: `${breachType} SLA breached - auto-escalation to level ${newLevel}`,
          triggeredBy: 'SYSTEM',
        },
      }),
      // Update SLA tracking escalation level
      this.prisma.slaTracking.update({
        where: { id: slaTrackingId },
        data: {
          escalationLevel: newLevel,
          lastEscalatedAt: new Date(),
        },
      }),
      // Update ticket escalation status
      this.prisma.ticket.update({
        where: { id: ticketId },
        data: {
          isEscalated: true,
          escalationLevel: newLevel,
        },
      }),
    ]);

    this.logger.log(
      `Ticket ${ticketId} escalated to level ${newLevel} due to ${breachType} breach`,
    );
  }

  // ============================================
  // Breach Queries
  // ============================================

  async findBreaches(query: QueryBreachesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.agencyId) {
      where.ticket = { agencyId: query.agencyId };
    }
    if (query.breachType) {
      where.breachType = query.breachType;
    }

    const [items, total] = await Promise.all([
      this.prisma.breachLog.findMany({
        where,
        include: {
          ticket: {
            select: {
              id: true,
              ticketNumber: true,
              subject: true,
              agencyId: true,
              agency: {
                select: { agencyName: true },
              },
            },
          },
          slaTracking: {
            select: {
              responseDueAt: true,
              resolutionDueAt: true,
              escalationLevel: true,
            },
          },
        },
        orderBy: { recordedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.breachLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // Escalation Matrix CRUD
  // ============================================

  async createEscalationMatrix(dto: CreateEscalationMatrixDto) {
    return this.prisma.escalationMatrix.create({
      data: {
        agencyId: dto.agencyId,
        priorityLevel: dto.priorityLevel,
        maxResponseTimeMinutes: dto.maxResponseTimeMinutes,
        maxResolutionTimeMinutes: dto.maxResolutionTimeMinutes,
        autoEscalationEnabled: dto.autoEscalationEnabled ?? true,
      },
      include: { escalationLevels: true },
    });
  }

  async findEscalationMatrices(agencyId?: string) {
    const where: any = {};
    if (agencyId) {
      where.agencyId = agencyId;
    }
    return this.prisma.escalationMatrix.findMany({
      where,
      include: {
        escalationLevels: {
          orderBy: { levelNumber: 'asc' },
        },
        agency: { select: { id: true, agencyName: true, agencyCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setEscalationLevels(matrixId: string, dto: SetEscalationLevelsDto) {
    const matrix = await this.prisma.escalationMatrix.findUnique({
      where: { id: matrixId },
    });
    if (!matrix) {
      throw new NotFoundException(`Escalation matrix ${matrixId} not found`);
    }

    // Delete existing levels and replace with new ones (transactional)
    await this.prisma.$transaction([
      this.prisma.escalationLevel.deleteMany({
        where: { escalationMatrixId: matrixId },
      }),
      ...dto.levels.map((level) =>
        this.prisma.escalationLevel.create({
          data: {
            escalationMatrixId: matrixId,
            levelNumber: level.levelNumber,
            escalationRole: level.escalationRole,
            escalationDepartmentId: level.escalationDepartmentId,
            notifyViaEmail: level.notifyViaEmail ?? true,
            notifyViaSms: level.notifyViaSms ?? false,
          },
        }),
      ),
    ]);

    return this.prisma.escalationMatrix.findUnique({
      where: { id: matrixId },
      include: {
        escalationLevels: {
          orderBy: { levelNumber: 'asc' },
        },
      },
    });
  }

  // ============================================
  // Business Hours & Due Date Calculation
  // ============================================

  /**
   * calculateDueDate - Computes the due date from a baseTime + minutes.
   * If appliesBusinessHours is true, only counts minutes during agency working hours,
   * accounting for calendar overrides (holidays, special working days).
   */
  async calculateDueDate(
    baseTime: Date,
    minutes: number,
    appliesBusinessHours: boolean,
    agencyId: string,
  ): Promise<Date> {
    if (!appliesBusinessHours) {
      return new Date(baseTime.getTime() + minutes * 60 * 1000);
    }

    // Fetch agency business hours
    const businessHours = await this.prisma.agencyBusinessHour.findMany({
      where: { agencyId, isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });

    if (businessHours.length === 0) {
      // No business hours configured, fall back to calendar time
      this.logger.warn(
        `No business hours configured for agency ${agencyId}, using calendar time`,
      );
      return new Date(baseTime.getTime() + minutes * 60 * 1000);
    }

    // Fetch calendar overrides for the next 90 days from baseTime
    const overrideLookAhead = new Date(
      baseTime.getTime() + 90 * 24 * 60 * 60 * 1000,
    );
    const calendarOverrides =
      await this.prisma.businessCalendarOverride.findMany({
        where: {
          agencyId,
          overrideDate: {
            gte: baseTime,
            lte: overrideLookAhead,
          },
        },
      });

    // Build a map of overrides by date string (YYYY-MM-DD)
    const overrideMap = new Map<
      string,
      { isWorkingDay: boolean; startTime?: string; endTime?: string }
    >();
    for (const override of calendarOverrides) {
      const dateKey = override.overrideDate.toISOString().split('T')[0];
      overrideMap.set(dateKey, {
        isWorkingDay: override.isWorkingDay,
        startTime: override.startTime ?? undefined,
        endTime: override.endTime ?? undefined,
      });
    }

    // Build a map of business hours by dayOfWeek
    const hoursMap = new Map<
      number,
      { startTime: string; endTime: string }
    >();
    for (const bh of businessHours) {
      hoursMap.set(bh.dayOfWeek, {
        startTime: bh.startTime,
        endTime: bh.endTime,
      });
    }

    let remainingMinutes = minutes;
    let cursor = new Date(baseTime);

    // Iterate day by day (or partial day), consuming business minutes
    const maxIterations = 365; // safety cap
    let iterations = 0;

    while (remainingMinutes > 0 && iterations < maxIterations) {
      iterations++;
      const dateKey = cursor.toISOString().split('T')[0];
      const dayOfWeek = cursor.getDay(); // 0=Sun, 1=Mon, ...

      // Check for calendar override
      const override = overrideMap.get(dateKey);
      let dayStart: string | undefined;
      let dayEnd: string | undefined;
      let isWorkingDay: boolean;

      if (override) {
        isWorkingDay = override.isWorkingDay;
        dayStart = override.startTime;
        dayEnd = override.endTime;
      } else {
        const hours = hoursMap.get(dayOfWeek);
        isWorkingDay = !!hours;
        dayStart = hours?.startTime;
        dayEnd = hours?.endTime;
      }

      if (!isWorkingDay || !dayStart || !dayEnd) {
        // Skip to start of next day
        cursor = this.startOfNextDay(cursor);
        continue;
      }

      // Parse start/end times for this day
      const dayStartDate = this.setTimeOnDate(cursor, dayStart);
      const dayEndDate = this.setTimeOnDate(cursor, dayEnd);

      // If cursor is before the working day start, move to start
      if (cursor < dayStartDate) {
        cursor = new Date(dayStartDate);
      }

      // If cursor is at or after the working day end, skip to next day
      if (cursor >= dayEndDate) {
        cursor = this.startOfNextDay(cursor);
        continue;
      }

      // Calculate available minutes in this working period
      const availableMinutes = Math.round(
        (dayEndDate.getTime() - cursor.getTime()) / 60000,
      );

      if (remainingMinutes <= availableMinutes) {
        // Enough time in this period
        cursor = new Date(cursor.getTime() + remainingMinutes * 60 * 1000);
        remainingMinutes = 0;
      } else {
        // Consume all available minutes and move to next day
        remainingMinutes -= availableMinutes;
        cursor = this.startOfNextDay(cursor);
      }
    }

    return cursor;
  }

  // ============================================
  // Private Helpers
  // ============================================

  private findBestMatchingRule(
    rules: Array<{
      id: string;
      priorityId: string | null;
      categoryId: string | null;
      responseTimeMinutes: number;
      resolutionTimeMinutes: number;
      escalationAfterMinutes: number | null;
    }>,
    ticketPriorityId?: string | null,
    ticketCategoryId?: string | null,
  ) {
    // 1. Exact match: both priority and category
    const exactMatch = rules.find(
      (r) =>
        r.priorityId === ticketPriorityId && r.categoryId === ticketCategoryId,
    );
    if (exactMatch) return exactMatch;

    // 2. Priority match only
    const priorityMatch = rules.find(
      (r) => r.priorityId === ticketPriorityId && r.categoryId === null,
    );
    if (priorityMatch) return priorityMatch;

    // 3. Category match only
    const categoryMatch = rules.find(
      (r) => r.categoryId === ticketCategoryId && r.priorityId === null,
    );
    if (categoryMatch) return categoryMatch;

    // 4. Catch-all rule (no priority, no category)
    const catchAll = rules.find(
      (r) => r.priorityId === null && r.categoryId === null,
    );
    return catchAll ?? rules[0]; // fallback to first rule
  }

  private startOfNextDay(date: Date): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private setTimeOnDate(date: Date, timeStr: string): Date {
    const parts = timeStr.split(':');
    const result = new Date(date);
    result.setHours(
      parseInt(parts[0], 10),
      parseInt(parts[1] || '0', 10),
      parseInt(parts[2] || '0', 10),
      0,
    );
    return result;
  }
}
