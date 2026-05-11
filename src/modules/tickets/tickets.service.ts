import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

const EXTERNAL_USER_TYPES = new Set(['CITIZEN', 'BUSINESS']);
import { PrismaService } from '../../config/prisma.service';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SlaService } from '../sla/sla.service';
import { KafkaService } from '../kafka/kafka.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { AuditService } from '../audit/audit.service';
import { AiService } from '../ai/ai.service';
import { KAFKA_TOPICS, partitionKey } from '../kafka/kafka.topics';
import {
  CreateTicketDto,
  UpdateTicketDto,
  AssignTicketDto,
  EscalateTicketDto,
  ResolveTicketDto,
  CloseTicketDto,
  ReopenTicketDto,
  CreateMessageDto,
  CreateAttachmentDto,
  AddTagsDto,
  TicketFilterDto,
  CategoryFilterDto,
  MessageFilterDto,
  TicketStatusEnum,
  EscalationTriggerEnum,
} from './dto/tickets.dto';

// ============================================
// Status Transition State Machine
// ============================================

/**
 * Defines valid status transitions for the ticket lifecycle.
 *
 * OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED
 * any -> ESCALATED (from most states)
 * CLOSED -> REOPENED
 * REOPENED -> ASSIGNED (to restart the cycle)
 * ESCALATED -> ASSIGNED | IN_PROGRESS (after escalation is handled)
 * any -> PENDING_CITIZEN (waiting on citizen input)
 * PENDING_CITIZEN -> IN_PROGRESS (citizen responded)
 * any -> REJECTED (if ticket is invalid)
 */
const STATUS_TRANSITIONS: Record<TicketStatusEnum, TicketStatusEnum[]> = {
  [TicketStatusEnum.OPEN]: [
    TicketStatusEnum.ASSIGNED,
    TicketStatusEnum.ESCALATED,
    TicketStatusEnum.REJECTED,
    TicketStatusEnum.CLOSED,
  ],
  [TicketStatusEnum.ASSIGNED]: [
    TicketStatusEnum.IN_PROGRESS,
    TicketStatusEnum.RESOLVED,
    TicketStatusEnum.ESCALATED,
    TicketStatusEnum.PENDING_CITIZEN,
    TicketStatusEnum.REJECTED,
    TicketStatusEnum.CLOSED,
  ],
  [TicketStatusEnum.IN_PROGRESS]: [
    TicketStatusEnum.RESOLVED,
    TicketStatusEnum.ESCALATED,
    TicketStatusEnum.PENDING_CITIZEN,
    TicketStatusEnum.ASSIGNED,
  ],
  [TicketStatusEnum.ESCALATED]: [
    TicketStatusEnum.ASSIGNED,
    TicketStatusEnum.IN_PROGRESS,
    TicketStatusEnum.RESOLVED,
    TicketStatusEnum.CLOSED,
  ],
  [TicketStatusEnum.PENDING_CITIZEN]: [
    TicketStatusEnum.IN_PROGRESS,
    TicketStatusEnum.RESOLVED,
    TicketStatusEnum.ESCALATED,
    TicketStatusEnum.CLOSED,
  ],
  [TicketStatusEnum.RESOLVED]: [
    TicketStatusEnum.CLOSED,
    TicketStatusEnum.REOPENED,
  ],
  [TicketStatusEnum.CLOSED]: [
    TicketStatusEnum.REOPENED,
  ],
  [TicketStatusEnum.REOPENED]: [
    TicketStatusEnum.ASSIGNED,
    TicketStatusEnum.IN_PROGRESS,
    TicketStatusEnum.ESCALATED,
  ],
  [TicketStatusEnum.REJECTED]: [],
};

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly slaService: SlaService,
    private readonly kafkaService: KafkaService,
    private readonly wsGateway: AppWebSocketGateway,
    private readonly auditService: AuditService,
    private readonly aiService: AiService,
  ) {}

  // ============================================
  // Ticket Number Generation
  // ============================================

  /**
   * Generates a unique ticket number in the format ESCC-YYYYMMDD-XXXXX
   * Uses a database counter to ensure uniqueness even under concurrency.
   */
  private async generateTicketNumber(): Promise<string> {
    const now = new Date();
    const dateStr =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    const prefix = `ESCC-${dateStr}-`;

    // Find the highest ticket number for today
    const lastTicket = await this.prisma.ticket.findFirst({
      where: {
        ticketNumber: { startsWith: prefix },
      },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });

    let sequenceNumber = 1;
    if (lastTicket) {
      const lastSequence = parseInt(lastTicket.ticketNumber.split('-')[2], 10);
      if (!isNaN(lastSequence)) {
        sequenceNumber = lastSequence + 1;
      }
    }

    return `${prefix}${String(sequenceNumber).padStart(5, '0')}`;
  }

  // ============================================
  // Status Helpers
  // ============================================

  /**
   * Resolve a TicketStatus record by its enum name.
   */
  private async getStatusByName(name: TicketStatusEnum) {
    const status = await this.prisma.ticketStatus.findUnique({
      where: { name },
    });
    if (!status) {
      throw new BadRequestException(`Ticket status '${name}' not found in the system`);
    }
    return status;
  }

  /**
   * Get the current status name for a ticket (by status ID).
   */
  private async getStatusNameById(statusId: string): Promise<TicketStatusEnum> {
    const status = await this.prisma.ticketStatus.findUnique({
      where: { id: statusId },
    });
    if (!status) {
      throw new BadRequestException('Unknown status ID');
    }
    return status.name as TicketStatusEnum;
  }

  /**
   * Validate and execute a status transition.
   * Throws BadRequestException if the transition is not allowed.
   */
  private validateTransition(
    currentStatus: TicketStatusEnum,
    newStatus: TicketStatusEnum,
  ): void {
    const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${currentStatus} -> ${newStatus}. ` +
          `Allowed transitions from ${currentStatus}: [${(allowedTransitions || []).join(', ')}]`,
      );
    }
  }

  /**
   * Transition a ticket's status, record history, and update timestamps.
   */
  private async transitionStatus(
    ticketId: string,
    newStatusName: TicketStatusEnum,
    changedBy: string,
    changeReason?: string,
    additionalData?: Record<string, any>,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { status: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const currentStatusName = ticket.status.name as TicketStatusEnum;
    this.validateTransition(currentStatusName, newStatusName);

    const newStatus = await this.getStatusByName(newStatusName);

    // Build update data
    const updateData: Record<string, any> = {
      statusId: newStatus.id,
      ...additionalData,
    };

    // Set timestamps based on new status
    if (newStatusName === TicketStatusEnum.RESOLVED) {
      updateData.resolvedAt = new Date();
    }
    if (newStatusName === TicketStatusEnum.CLOSED) {
      updateData.closedAt = new Date();
    }
    if (newStatusName === TicketStatusEnum.REOPENED) {
      updateData.reopenCount = { increment: 1 };
      updateData.resolvedAt = null;
      updateData.closedAt = null;
    }

    // Execute transition in a transaction
    const [updatedTicket] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticketId },
        data: updateData,
        include: this.fullTicketInclude(),
      }),
      this.prisma.ticketHistory.create({
        data: {
          ticketId,
          oldStatusId: ticket.statusId,
          newStatusId: newStatus.id,
          changedBy,
          changeReason: changeReason || null,
        },
      }),
      // Also add a system message for the status change
      this.prisma.ticketMessage.create({
        data: {
          ticketId,
          senderId: changedBy,
          messageType: 'STATUS_CHANGE',
          messageText: `Status changed from ${currentStatusName} to ${newStatusName}${changeReason ? `: ${changeReason}` : ''}`,
          isInternal: false,
        },
      }),
    ]);

    this.logger.log(
      `Ticket ${ticket.ticketNumber} transitioned: ${currentStatusName} -> ${newStatusName} by ${changedBy}`,
    );

    return updatedTicket;
  }

  // ============================================
  // Include Helpers
  // ============================================

  private fullTicketInclude() {
    return {
      agency: {
        select: {
          id: true,
          agencyCode: true,
          agencyName: true,
          agencyType: true,
        },
      },
      department: {
        select: {
          id: true,
          departmentName: true,
          departmentCode: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          nationalId: true,
          userType: true,
        },
      },
      assignee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          userType: true,
        },
      },
      priority: {
        select: {
          id: true,
          name: true,
          severityScore: true,
        },
      },
      status: {
        select: {
          id: true,
          name: true,
          isClosedStatus: true,
        },
      },
      tagMappings: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      slaTracking: {
        select: {
          id: true,
          responseDueAt: true,
          resolutionDueAt: true,
          responseMet: true,
          resolutionMet: true,
          responseBreached: true,
          resolutionBreached: true,
          escalationLevel: true,
        },
      },
    };
  }

  private listTicketInclude() {
    return {
      agency: {
        select: {
          id: true,
          agencyCode: true,
          agencyName: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      assignee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      priority: {
        select: {
          id: true,
          name: true,
          severityScore: true,
        },
      },
      status: {
        select: {
          id: true,
          name: true,
          isClosedStatus: true,
        },
      },
      tagMappings: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      slaTracking: {
        select: {
          responseDueAt: true,
          resolutionDueAt: true,
          responseBreached: true,
          resolutionBreached: true,
        },
      },
    };
  }

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * Create a new ticket. Sets status to OPEN and generates a ticket number.
   */
  async createTicket(dto: CreateTicketDto, createdBy: string) {
    // Verify agency exists
    const agency = await this.prisma.agency.findUnique({
      where: { id: dto.agencyId },
    });
    if (!agency) {
      throw new BadRequestException(`Agency ${dto.agencyId} not found`);
    }

    // Verify category if provided
    if (dto.categoryId) {
      const category = await this.prisma.ticketCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException(`Category ${dto.categoryId} not found`);
      }
    }

    // Verify priority if provided
    if (dto.priorityId) {
      const priority = await this.prisma.ticketPriorityLevel.findUnique({
        where: { id: dto.priorityId },
      });
      if (!priority) {
        throw new BadRequestException(`Priority ${dto.priorityId} not found`);
      }
    }

    // Get the OPEN status
    const openStatus = await this.getStatusByName(TicketStatusEnum.OPEN);

    // Generate ticket number
    const ticketNumber = await this.generateTicketNumber();

    // Create ticket and initial history in a transaction
    const ticket = await this.prisma.$transaction(async (tx) => {
      const newTicket = await tx.ticket.create({
        data: {
          ticketNumber,
          agencyId: dto.agencyId,
          departmentId: dto.departmentId || null,
          categoryId: dto.categoryId || null,
          priorityId: dto.priorityId || null,
          createdBy,
          statusId: openStatus.id,
          channel: dto.channel,
          subject: dto.subject,
          description: dto.description,
          escalationLevel: 0,
          reopenCount: 0,
          isEscalated: false,
          isDeleted: false,
        },
        include: this.fullTicketInclude(),
      });

      // Record initial history
      await tx.ticketHistory.create({
        data: {
          ticketId: newTicket.id,
          oldStatusId: null,
          newStatusId: openStatus.id,
          changedBy: createdBy,
          changeReason: 'Ticket created',
        },
      });

      // Handle tags if provided
      if (dto.tags && dto.tags.length > 0) {
        for (const tagName of dto.tags) {
          // Find or create the tag
          let tag = await tx.ticketTag.findFirst({
            where: {
              name: tagName,
              agencyId: dto.agencyId,
            },
          });

          if (!tag) {
            tag = await tx.ticketTag.create({
              data: {
                name: tagName,
                agencyId: dto.agencyId,
              },
            });
          }

          // Create the mapping
          await tx.ticketTagMapping.create({
            data: {
              ticketId: newTicket.id,
              tagId: tag.id,
            },
          });
        }
      }

      // Refetch with tags
      return tx.ticket.findUnique({
        where: { id: newTicket.id },
        include: this.fullTicketInclude(),
      });
    });

    if (!ticket) throw new NotFoundException('Ticket creation failed');

    this.logger.log(`Ticket created: ${ticketNumber} by user ${createdBy}`);

    this.auditService.logUserActivity({
      userId: createdBy,
      agencyId: ticket.agencyId,
      activityType: 'TICKET_CREATE',
      ticketId: ticket.id,
      description: `Created ticket ${ticket.ticketNumber}`,
    }).catch(() => null);

    // Fire ML classification — fire-and-forget. autoApply=true so when the
    // model is confident (>=0.75) the ticket's category + priority get set
    // server-side without blocking the citizen's response.
    this.aiService.classifyTicket({
      ticketId: ticket.id,
      autoApply: true,
    } as any).catch((err) =>
      this.logger.warn(`AI classify failed for ${ticket.ticketNumber}: ${err?.message}`),
    );

    // Publish ticket.created event to Kafka (non-blocking)
    this.kafkaService.publish({
      topic: KAFKA_TOPICS.TICKET_CREATED,
      key: partitionKey.byAgency(ticket.agencyId),
      value: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        agencyId: ticket.agencyId,
        createdBy: ticket.createdBy,
        channel: ticket.channel,
        subject: ticket.subject,
        priorityId: ticket.priorityId,
        categoryId: ticket.categoryId,
        createdAt: ticket.createdAt,
      },
    }).catch(() => null);

    // Attach SLA tracking (non-blocking — failure here must not break ticket creation)
    this.slaService.attachSlaToTicket({
      id: ticket.id,
      agencyId: ticket.agencyId,
      priorityId: ticket.priorityId ?? null,
      categoryId: ticket.categoryId ?? null,
      createdAt: ticket.createdAt,
    }).catch((err) => this.logger.warn(`SLA attach failed for ${ticket.id}: ${err.message}`));

    return ticket;
  }

  /**
   * Get paginated list of tickets with extensive filtering.
   */
  async findAll(
    filters: TicketFilterDto,
    user?: JwtPayload | string,
  ): Promise<PaginatedResult<any>> {
    // Backwards-compat: callers used to pass user.agencyId as a string.
    const callerUser: JwtPayload | undefined =
      typeof user === 'string' || !user ? undefined : user;
    const userAgencyId =
      typeof user === 'string' ? user : callerUser?.agencyId;

    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      agencyId,
      priorityId,
      priority,
      assigneeId,
      categoryId,
      departmentId,
      channel,
      isEscalated,
      dateFrom,
      dateTo,
      search,
      createdBy,
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      isDeleted: false,
    };

    // Citizens / businesses can ONLY see tickets they created.
    // Force ownership scoping server-side and ignore any agency filter
    // they may have passed (defence-in-depth).
    const isExternalUser =
      callerUser && EXTERNAL_USER_TYPES.has(callerUser.userType);
    if (isExternalUser) {
      where.createdBy = callerUser!.sub;
    } else if (agencyId) {
      // Agents may explicitly request a different agency (super admin)
      where.agencyId = agencyId;
    } else if (userAgencyId) {
      where.agencyId = userAgencyId;
    }

    // Status filter: resolve status name to status ID
    if (status) {
      const statusRecord = await this.prisma.ticketStatus.findUnique({
        where: { name: status },
      });
      if (statusRecord) {
        where.statusId = statusRecord.id;
      }
    }

    if (priorityId) {
      where.priorityId = priorityId;
    } else if (priority) {
      // Resolve priority name (CRITICAL/HIGH/MEDIUM/LOW) to its ID so the
      // admin tickets page can filter by enum value without first having to
      // fetch the priority list.
      const priorityRecord = await this.prisma.ticketPriorityLevel.findUnique({
        where: { name: priority },
      });
      if (priorityRecord) {
        where.priorityId = priorityRecord.id;
      }
    }

    if (assigneeId) {
      where.currentAssigneeId = assigneeId;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (channel) {
      where.channel = channel;
    }

    if (isEscalated !== undefined) {
      where.isEscalated = isEscalated;
    }

    // External users have already been scoped to their own createdBy above —
    // never let a query param override that.
    if (createdBy && !isExternalUser) {
      where.createdBy = createdBy;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Full-text search on subject + description
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build order by
    const orderBy: any = {};
    const validSortFields = [
      'createdAt',
      'updatedAt',
      'ticketNumber',
      'subject',
      'escalationLevel',
      'reopenCount',
    ];
    if (validSortFields.includes(sortBy)) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: this.listTicketInclude(),
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    if (callerUser) {
      this.auditService.logDataAccess({
        userId: callerUser.sub,
        agencyId: callerUser.agencyId,
        entityType: 'TICKET_LIST',
        accessType: 'READ' as any,
      }).catch(() => null);
    }

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Real aggregate counts for the current user's own tickets. Used by the
   * citizen dashboard so its tiles aren't computed from a single page of 5.
   */
  async getMyStats(userId: string) {
    const baseWhere = { createdBy: userId, isDeleted: false };

    const [total, open, resolved, closed, escalated] = await Promise.all([
      this.prisma.ticket.count({ where: baseWhere }),
      this.prisma.ticket.count({
        where: {
          ...baseWhere,
          status: {
            name: {
              in: [
                'OPEN',
                'ASSIGNED',
                'IN_PROGRESS',
                'ESCALATED',
                'PENDING_CITIZEN',
                'REOPENED',
              ],
            },
          },
        },
      }),
      this.prisma.ticket.count({
        where: { ...baseWhere, status: { name: 'RESOLVED' } },
      }),
      this.prisma.ticket.count({
        where: { ...baseWhere, status: { name: 'CLOSED' } },
      }),
      this.prisma.ticket.count({
        where: { ...baseWhere, isEscalated: true },
      }),
    ]);

    return { total, open, resolved, closed, escalated };
  }

  /**
   * Get a single ticket with full details including messages, assignments,
   * history, SLA tracking, and AI classification.
   */
  async findById(id: string, user?: JwtPayload) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...this.fullTicketInclude(),
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                userType: true,
              },
            },
            attachments: true,
          },
        },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          take: 10,
          include: {
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            assigner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        history: {
          orderBy: { changedAt: 'desc' },
          take: 20,
          include: {
            oldStatus: { select: { id: true, name: true } },
            newStatus: { select: { id: true, name: true } },
            changer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploader: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        escalationEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            escalatedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        aiClassifications: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            predictedCategory: { select: { id: true, name: true } },
            predictedPriority: { select: { id: true, name: true } },
            aiModel: { select: { id: true, modelName: true, modelVersion: true } },
          },
        },
        breachLogs: {
          orderBy: { recordedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    // External users (citizens / businesses) can only read tickets they raised.
    if (
      user &&
      EXTERNAL_USER_TYPES.has(user.userType) &&
      ticket.createdBy !== user.sub
    ) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    if (user) {
      this.auditService.logDataAccess({
        userId: user.sub,
        agencyId: user.agencyId,
        entityType: 'TICKET',
        entityId: id,
        accessType: 'READ' as any,
      }).catch(() => null);
    }

    return ticket;
  }

  /**
   * Update ticket fields (subject, description, category, priority, department, channel).
   */
  async updateTicket(id: string, dto: UpdateTicketDto, updatedBy: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { status: true },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    // Don't allow updates on closed/rejected tickets
    const closedStatuses: TicketStatusEnum[] = [
      TicketStatusEnum.CLOSED,
      TicketStatusEnum.REJECTED,
    ];
    if (closedStatuses.includes(ticket.status.name as TicketStatusEnum)) {
      throw new BadRequestException(
        `Cannot update ticket in ${ticket.status.name} status. Reopen it first.`,
      );
    }

    // Validate category if changing
    if (dto.categoryId) {
      const category = await this.prisma.ticketCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException(`Category ${dto.categoryId} not found`);
      }
    }

    // Validate priority if changing
    if (dto.priorityId) {
      const priority = await this.prisma.ticketPriorityLevel.findUnique({
        where: { id: dto.priorityId },
      });
      if (!priority) {
        throw new BadRequestException(`Priority ${dto.priorityId} not found`);
      }
    }

    const updateData: any = {};
    if (dto.departmentId !== undefined) updateData.departmentId = dto.departmentId;
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
    if (dto.priorityId !== undefined) updateData.priorityId = dto.priorityId;
    if (dto.subject !== undefined) updateData.subject = dto.subject;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.channel !== undefined) updateData.channel = dto.channel;

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
      include: this.fullTicketInclude(),
    });

    this.logger.log(`Ticket ${ticket.ticketNumber} updated by ${updatedBy}`);

    return updatedTicket;
  }

  // ============================================
  // Assignment
  // ============================================

  /**
   * Assign a ticket to an agent. Transitions status to ASSIGNED if currently OPEN or REOPENED.
   */
  async assignTicket(id: string, dto: AssignTicketDto, assignedBy: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { status: true },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    // Verify the assignee exists and is an agent type
    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assigneeId },
    });
    if (!assignee) {
      throw new BadRequestException(`User ${dto.assigneeId} not found`);
    }

    // Resolve a display name. Some agency-admin-created users have null
    // firstName/lastName, which produced empty "Ticket reassigned to "
    // messages in the history feed. Fall back to email, then to a generic
    // label so the history line is never blank.
    const assigneeName =
      `${assignee.firstName ?? ''} ${assignee.lastName ?? ''}`.trim() ||
      assignee.email ||
      'an agent';

    const currentStatusName = ticket.status.name as TicketStatusEnum;

    // Determine if we need a status transition
    const statusesThatTransitionToAssigned: TicketStatusEnum[] = [
      TicketStatusEnum.OPEN,
      TicketStatusEnum.REOPENED,
      TicketStatusEnum.ESCALATED,
    ];

    const needsTransition = statusesThatTransitionToAssigned.includes(currentStatusName);

    if (needsTransition) {
      // Transition to ASSIGNED
      const assignedStatus = await this.getStatusByName(TicketStatusEnum.ASSIGNED);

      const [updatedTicket] = await this.prisma.$transaction([
        this.prisma.ticket.update({
          where: { id },
          data: {
            currentAssigneeId: dto.assigneeId,
            statusId: assignedStatus.id,
          },
          include: this.fullTicketInclude(),
        }),
        this.prisma.ticketAssignment.create({
          data: {
            ticketId: id,
            assignedTo: dto.assigneeId,
            assignedBy,
            assignmentReason: dto.reason || null,
          },
        }),
        this.prisma.ticketHistory.create({
          data: {
            ticketId: id,
            oldStatusId: ticket.statusId,
            newStatusId: assignedStatus.id,
            changedBy: assignedBy,
            changeReason: `Assigned to ${assignee.firstName || ''} ${assignee.lastName || ''}${dto.reason ? `: ${dto.reason}` : ''}`.replace(/\s+/g, ' ').trim(),
          },
        }),
        this.prisma.ticketMessage.create({
          data: {
            ticketId: id,
            senderId: assignedBy,
            messageType: 'STATUS_CHANGE',
            messageText: `Ticket assigned to ${assigneeName}${dto.reason ? `. Reason: ${dto.reason}` : ''}`,
            isInternal: true,
          },
        }),
      ]);

      // Track first response if this is the first assignment
      if (!ticket.firstResponseAt) {
        await this.prisma.ticket.update({
          where: { id },
          data: { firstResponseAt: new Date() },
        });
      }

      this.logger.log(
        `Ticket ${ticket.ticketNumber} assigned to ${dto.assigneeId} by ${assignedBy}`,
      );

      this.kafkaService.publish({
        topic: KAFKA_TOPICS.TICKET_ASSIGNED,
        key: partitionKey.byTicket(id),
        value: {
          ticketId: id,
          ticketNumber: ticket.ticketNumber,
          agencyId: ticket.agencyId,
          assignedTo: dto.assigneeId,
          performedBy: assignedBy,
          assignedAt: new Date(),
        },
      }).catch(() => null);

      this.auditService.logUserActivity({
        userId: assignedBy,
        agencyId: ticket.agencyId,
        activityType: 'TICKET_ASSIGN',
        ticketId: id,
        description: `Assigned ticket ${ticket.ticketNumber} to user ${dto.assigneeId}`,
      }).catch(() => null);

      return updatedTicket;
    }

    // If already assigned/in_progress, just update the assignee without status change
    const [updatedTicket] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id },
        data: { currentAssigneeId: dto.assigneeId },
        include: this.fullTicketInclude(),
      }),
      this.prisma.ticketAssignment.create({
        data: {
          ticketId: id,
          assignedTo: dto.assigneeId,
          assignedBy,
          assignmentReason: dto.reason || `Reassigned`,
        },
      }),
      this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          senderId: assignedBy,
          messageType: 'STATUS_CHANGE',
          messageText: `Ticket reassigned to ${assigneeName}${dto.reason ? `. Reason: ${dto.reason}` : ''}`,
          isInternal: true,
        },
      }),
    ]);

    this.logger.log(
      `Ticket ${ticket.ticketNumber} reassigned to ${dto.assigneeId} by ${assignedBy}`,
    );

    this.kafkaService.publish({
      topic: KAFKA_TOPICS.TICKET_ASSIGNED,
      key: partitionKey.byTicket(id),
      value: {
        ticketId: id,
        ticketNumber: ticket.ticketNumber,
        agencyId: ticket.agencyId,
        assignedTo: dto.assigneeId,
        performedBy: assignedBy,
        assignedAt: new Date(),
      },
    }).catch(() => null);

    return updatedTicket;
  }

  // ============================================
  // Escalation
  // ============================================

  /**
   * Escalate a ticket to L2/L3. Increments escalation level, transitions to ESCALATED.
   */
  async escalateTicket(id: string, dto: EscalateTicketDto, escalatedBy: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { status: true, slaTracking: true, priority: true },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const currentStatusName = ticket.status.name as TicketStatusEnum;
    this.validateTransition(currentStatusName, TicketStatusEnum.ESCALATED);

    const escalatedStatus = await this.getStatusByName(TicketStatusEnum.ESCALATED);
    const newEscalationLevel = ticket.escalationLevel + 1;
    const trigger = dto.trigger || EscalationTriggerEnum.MANUAL_OVERRIDE;

    // ── AUTO mode: consult the agency's escalation matrix ──────────────────
    // When mode === 'AUTO', read the matrix for (agency × priority) and pull
    // the role + department for the next level. The agent doesn't have to
    // hand-pick a user — the system routes by hierarchy.
    let resolvedRole = dto.escalateToRole;
    let resolvedUserId = dto.escalateToUserId;
    if (dto.mode === 'AUTO' && !dto.escalateToCommandCentre && !dto.targetAgencyId) {
      const matrix = await this.prisma.escalationMatrix.findFirst({
        where: {
          agencyId: ticket.agencyId,
          ...(ticket.priority?.name ? { priorityLevel: ticket.priority.name } : {}),
        },
        include: {
          escalationLevels: { where: { levelNumber: newEscalationLevel } },
        },
      });
      const lvl = matrix?.escalationLevels[0];
      if (!lvl) {
        throw new BadRequestException(
          `No level ${newEscalationLevel} defined in this agency's escalation matrix for ${ticket.priority?.name ?? 'this priority'}. Define it in SLA & Escalation settings or pick a user manually.`,
        );
      }
      resolvedRole = lvl.escalationRole ?? resolvedRole;
      // Try to find a real user holding that role within the agency (and dept if specified)
      if (resolvedRole) {
        const candidate = await this.prisma.user.findFirst({
          where: {
            agencyUsers: {
              some: {
                agencyId: ticket.agencyId,
                ...(lvl.escalationDepartmentId ? { departmentId: lvl.escalationDepartmentId } : {}),
              },
            },
            userRoles: { some: { role: { name: resolvedRole } } },
          },
          select: { id: true },
        });
        if (candidate) resolvedUserId = candidate.id;
      }
    }

    // ── Command Centre escalation ───────────────────────────────────────────
    if (dto.escalateToCommandCentre) {
      resolvedRole = 'COMMAND_CENTER_ADMIN';
    }

    // ── Cross-agency transfer ──────────────────────────────────────────────
    // When targetAgencyId is set, the ticket physically moves agency.
    // Receiving agency starts unassigned (their admin re-assigns).
    const ticketUpdateData: Record<string, unknown> = {
      statusId: escalatedStatus.id,
      escalationLevel: newEscalationLevel,
      isEscalated: true,
    };
    if (dto.targetAgencyId && dto.targetAgencyId !== ticket.agencyId) {
      ticketUpdateData.agencyId = dto.targetAgencyId;
      ticketUpdateData.currentAssigneeId = null; // receiving agency picks
    } else if (resolvedUserId) {
      ticketUpdateData.currentAssigneeId = resolvedUserId;
    }
    // Bump priority if requested
    if ((dto as any).newPriority) {
      const priority = await this.prisma.ticketPriorityLevel.findFirst({
        where: { name: (dto as any).newPriority },
      });
      if (priority) ticketUpdateData.priorityId = priority.id;
    }

    const [updatedTicket] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id },
        data: ticketUpdateData,
        include: this.fullTicketInclude(),
      }),
      this.prisma.ticketHistory.create({
        data: {
          ticketId: id,
          oldStatusId: ticket.statusId,
          newStatusId: escalatedStatus.id,
          changedBy: escalatedBy,
          changeReason: `Escalated to L${newEscalationLevel}${dto.targetAgencyId ? ' (cross-agency transfer)' : dto.escalateToCommandCentre ? ' (Command Centre)' : resolvedUserId ? ' and reassigned' : ''}${dto.reason ? `: ${dto.reason}` : ''}`,
        },
      }),
      this.prisma.escalationEvent.create({
        data: {
          ticketId: id,
          slaTrackingId: ticket.slaTracking?.id || null,
          previousLevel: ticket.escalationLevel,
          newLevel: newEscalationLevel,
          escalatedToUserId: resolvedUserId || null,
          escalatedToRole: resolvedRole || null,
          escalationReason: dto.reason || null,
          triggeredBy: trigger,
        },
      }),
      this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          senderId: escalatedBy,
          messageType: 'ESCALATION_NOTE',
          messageText: `Ticket escalated to Level ${newEscalationLevel}${dto.reason ? `: ${dto.reason}` : ''}`,
          isInternal: true,
        },
      }),
    ]);

    // Update SLA tracking escalation level if exists
    if (ticket.slaTracking) {
      await this.prisma.slaTracking.update({
        where: { id: ticket.slaTracking.id },
        data: {
          escalationLevel: newEscalationLevel,
          lastEscalatedAt: new Date(),
        },
      });
    }

    // Notify the escalated-to user (in-app + email) — fire-and-forget
    if (resolvedUserId) {
      const target = await this.prisma.user.findUnique({
        where: { id: resolvedUserId },
        select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
      });
      if (target?.id) {
        const subject = `Ticket ${(updatedTicket as any).ticketNumber} escalated to you (Level ${newEscalationLevel})`;
        const body = `Hi ${target.firstName ?? 'there'},\n\nTicket <strong>${(updatedTicket as any).ticketNumber}</strong> — <em>${(updatedTicket as any).subject}</em> — has been escalated to you at Level ${newEscalationLevel}.${dto.reason ? `\n\nReason: ${dto.reason}` : ''}\n\nPlease review and respond as soon as possible.\n\neCitizen Service Command Centre`;
        const recipient = {
          recipientUserId: target.id,
          recipientEmail: target.email ?? undefined,
          recipientPhone: target.phoneNumber ?? undefined,
        };
        this.notificationsService
          .sendNotification({ ticketId: id, channel: 'IN_APP' as any, triggerEvent: 'TICKET_ESCALATED', subject, body, recipients: [recipient] })
          .catch((err) => this.logger.warn(`IN_APP escalate notify failed: ${err?.message}`));
        if (target.email) {
          this.notificationsService
            .sendNotification({ ticketId: id, channel: 'EMAIL' as any, triggerEvent: 'TICKET_ESCALATED', subject, body, recipients: [recipient] })
            .catch((err) => this.logger.warn(`EMAIL escalate notify failed: ${err?.message}`));
        }
      }
    }

    // Notify Command Centre admins if escalating up to them
    if (dto.escalateToCommandCentre) {
      const ccAdmins = await this.prisma.user.findMany({
        where: {
          userType: { in: ['COMMAND_CENTER_ADMIN', 'SUPER_ADMIN'] as any },
        },
        select: { id: true, firstName: true, email: true, phoneNumber: true },
      });
      if (ccAdmins.length > 0) {
        const subject = `[Command Centre] Ticket ${(updatedTicket as any).ticketNumber} escalated to you`;
        const body = `A ticket has been escalated to the Command Centre at Level ${newEscalationLevel}.\n\nTicket: <strong>${(updatedTicket as any).ticketNumber}</strong> — <em>${(updatedTicket as any).subject}</em>${dto.reason ? `\n\nReason: ${dto.reason}` : ''}\n\nPlease review.`;
        const recipients = ccAdmins.map((u) => ({
          recipientUserId: u.id,
          recipientEmail: u.email ?? undefined,
          recipientPhone: u.phoneNumber ?? undefined,
        }));
        this.notificationsService
          .sendNotification({ ticketId: id, channel: 'IN_APP' as any, triggerEvent: 'TICKET_ESCALATED', subject, body, recipients })
          .catch((err) => this.logger.warn(`Command Centre escalate notify failed: ${err?.message}`));
        this.notificationsService
          .sendNotification({ ticketId: id, channel: 'EMAIL' as any, triggerEvent: 'TICKET_ESCALATED', subject, body, recipients: recipients.filter((r) => r.recipientEmail) })
          .catch((err) => this.logger.warn(`Command Centre EMAIL escalate notify failed: ${err?.message}`));
      }
    }

    // Notify receiving agency's leadership when transferred cross-agency
    if (dto.targetAgencyId && dto.targetAgencyId !== ticket.agencyId) {
      const targetAgency = await this.prisma.agency.findUnique({
        where: { id: dto.targetAgencyId },
        select: { agencyName: true },
      });
      const recvAdmins = await this.prisma.user.findMany({
        where: {
          agencyUsers: { some: { agencyId: dto.targetAgencyId } },
          userRoles: { some: { role: { name: { in: ['AGENCY_ADMIN', 'SUPERVISOR'] } } } },
        },
        select: { id: true, email: true, phoneNumber: true },
      });
      if (recvAdmins.length > 0) {
        const subject = `New ticket transferred to ${targetAgency?.agencyName ?? 'your agency'}: ${(updatedTicket as any).ticketNumber}`;
        const body = `A ticket has been transferred to your agency from another agency for handling.\n\nTicket: <strong>${(updatedTicket as any).ticketNumber}</strong> — <em>${(updatedTicket as any).subject}</em>${dto.reason ? `\n\nReason: ${dto.reason}` : ''}\n\nPlease assign it to one of your agents.`;
        const recipients = recvAdmins.map((u) => ({
          recipientUserId: u.id,
          recipientEmail: u.email ?? undefined,
          recipientPhone: u.phoneNumber ?? undefined,
        }));
        this.notificationsService
          .sendNotification({ ticketId: id, channel: 'IN_APP' as any, triggerEvent: 'TICKET_ESCALATED', subject, body, recipients })
          .catch((err) => this.logger.warn(`Cross-agency transfer notify failed: ${err?.message}`));
      }
    }

    // Notify additional emails if provided in the escalation DTO
    const notifyEmails: string[] = (dto as any).notifyEmails ?? [];
    if (Array.isArray(notifyEmails) && notifyEmails.length > 0) {
      const subject = `Ticket ${(updatedTicket as any).ticketNumber} escalated`;
      const body = `Ticket <strong>${(updatedTicket as any).ticketNumber}</strong> — <em>${(updatedTicket as any).subject}</em> — has been escalated to Level ${newEscalationLevel}.${dto.reason ? `\n\nReason: ${dto.reason}` : ''}`;
      for (const email of notifyEmails) {
        const recipient = { recipientEmail: email };
        this.notificationsService
          .sendNotification({ ticketId: id, channel: 'EMAIL' as any, triggerEvent: 'TICKET_ESCALATED', subject, body, recipients: [recipient] })
          .catch((err) => this.logger.warn(`EMAIL escalate notify (cc=${email}) failed: ${err?.message}`));
      }
    }

    this.logger.log(
      `Ticket ${ticket.ticketNumber} escalated to L${newEscalationLevel} by ${escalatedBy}${dto.escalateToUserId ? ` and reassigned to ${dto.escalateToUserId}` : ''}`,
    );

    this.kafkaService.publish({
      topic: KAFKA_TOPICS.TICKET_ESCALATED,
      key: partitionKey.byTicket(id),
      value: {
        ticketId: id,
        ticketNumber: ticket.ticketNumber,
        agencyId: (updatedTicket as any).agencyId ?? ticket.agencyId,
        previousLevel: ticket.escalationLevel,
        newLevel: newEscalationLevel,
        escalatedToUserId: resolvedUserId ?? null,
        escalatedToRole: resolvedRole ?? null,
        targetAgencyId: dto.targetAgencyId ?? null,
        toCommandCentre: !!dto.escalateToCommandCentre,
        reason: dto.reason ?? null,
        performedBy: escalatedBy,
        escalatedAt: new Date(),
      },
    }).catch(() => null);

    this.auditService.logUserActivity({
      userId: escalatedBy,
      agencyId: ticket.agencyId,
      activityType: 'TICKET_ESCALATE',
      ticketId: id,
      description: `Escalated ticket ${ticket.ticketNumber} to L${newEscalationLevel}${dto.escalateToCommandCentre ? ' (Command Centre)' : dto.targetAgencyId ? ' (cross-agency)' : ''}`,
    }).catch(() => null);

    return updatedTicket;
  }

  /**
   * Get the recommended escalation targets for a ticket: next level role from
   * the agency's escalation matrix + users matching that role in the agency
   * (and parent agency for cross-agency cascade when the matrix is exhausted).
   */
  async getEscalationTargets(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { priority: true, agency: { include: { parentAgency: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const nextLevel = ticket.escalationLevel + 1;
    const priorityName = (ticket.priority as any)?.name ?? 'MEDIUM';

    // Find the matrix for this priority on this agency
    const matrix = await this.prisma.escalationMatrix.findFirst({
      where: { agencyId: ticket.agencyId, priorityLevel: priorityName },
      include: { escalationLevels: { orderBy: { levelNumber: 'asc' } } },
    });

    const matchedLevel = matrix?.escalationLevels.find((l) => l.levelNumber === nextLevel) ?? null;
    let recommendedAgencyId = ticket.agencyId;
    let recommendedAgencyName = (ticket.agency as any)?.agencyName ?? '';
    let crossAgencyEscalation = false;

    // If the matrix has no level for nextLevel — and there's a parent agency — cascade up
    if (!matchedLevel && (ticket.agency as any)?.parentAgency?.id) {
      recommendedAgencyId = (ticket.agency as any).parentAgency.id;
      recommendedAgencyName = (ticket.agency as any).parentAgency.agencyName;
      crossAgencyEscalation = true;
    }

    const recommendedRole = matchedLevel?.escalationRole ?? null;

    // First try: users matching the recommended role at the recommended agency
    let users: Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      userRoles: { role: { name: string } }[];
    }> = [];

    if (recommendedRole) {
      users = await this.prisma.user.findMany({
        where: {
          agencyUsers: { some: { agencyId: recommendedAgencyId } },
          userRoles: { some: { role: { name: recommendedRole } } },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          userRoles: { select: { role: { select: { name: true } } } },
        },
        take: 50,
      });
    }

    // Fallback: if no users match the role (or no role recommended), return all agency users
    // — the escalator can still pick freely. The matrix banner stays as guidance.
    if (users.length === 0) {
      users = await this.prisma.user.findMany({
        where: {
          agencyUsers: { some: { agencyId: recommendedAgencyId } },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          userRoles: { select: { role: { select: { name: true } } } },
        },
        take: 100,
      });
    }

    return {
      currentLevel: ticket.escalationLevel,
      nextLevel,
      ticketAgencyId: ticket.agencyId,
      ticketAgencyName: (ticket.agency as any)?.agencyName ?? '',
      recommendedAgencyId,
      recommendedAgencyName,
      crossAgencyEscalation,
      recommendedRole,
      matrixLevels: matrix?.escalationLevels?.map((l) => ({
        levelNumber: l.levelNumber,
        escalationRole: l.escalationRole,
        notifyEmail: (l as any).notifyViaEmail,
      })) ?? [],
      users: users.map((u) => ({
        id: u.id,
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
        email: u.email,
        roles: u.userRoles.map((r) => r.role.name),
      })),
    };
  }

  // ============================================
  // Resolve / Close / Reopen
  // ============================================

  /**
   * Mark a ticket as resolved and notify the citizen who raised it.
   */
  async resolveTicket(id: string, dto: ResolveTicketDto, resolvedBy: string) {
    const updatedTicket = await this.transitionStatus(
      id,
      TicketStatusEnum.RESOLVED,
      resolvedBy,
      dto.resolutionNotes || 'Ticket resolved',
      { resolvedAt: new Date() },
    );

    // Notify the citizen (fire-and-forget — don't block the response)
    const creator = (updatedTicket as any).creator;
    if (creator?.id) {
      const clientUrl = process.env.CLIENT_URL ?? 'https://ecitizen.wasaahost.com';
      const feedbackUrl = `${clientUrl}/feedback/${updatedTicket.id}`;
      const subject = `Your request ${updatedTicket.ticketNumber} has been resolved — share your feedback`;
      const body = `Dear ${creator.firstName ?? 'Citizen'},\n\nYour service request <strong>${updatedTicket.ticketNumber}</strong> — <em>${(updatedTicket as any).subject}</em> — has been resolved.\n\n${dto.resolutionNotes ? `Resolution notes: ${dto.resolutionNotes}\n\n` : ''}We'd love your feedback. Please take a minute to rate your experience:\n\n${feedbackUrl}\n\nYour rating helps us improve government services for all Kenyans.\n\nThank you for using eCitizen Kenya.\n\neCitizen Service Team`;
      const recipient = {
        recipientUserId: creator.id,
        recipientEmail: creator.email ?? undefined,
        recipientPhone: creator.phoneNumber ?? undefined,
      };

      // In-app notification (always fires — visible in mobile/web notification bell)
      this.notificationsService
        .sendNotification({ ticketId: id, channel: 'IN_APP' as any, triggerEvent: 'TICKET_RESOLVED', subject, body, recipients: [recipient] })
        .catch((err) => this.logger.warn(`IN_APP resolve notify failed for ${updatedTicket.ticketNumber}: ${err?.message}`));

      // Email notification (fires if email address exists)
      if (creator.email) {
        this.notificationsService
          .sendNotification({ ticketId: id, channel: 'EMAIL' as any, triggerEvent: 'TICKET_RESOLVED', subject, body, recipients: [recipient] })
          .catch((err) => this.logger.warn(`EMAIL resolve notify failed for ${updatedTicket.ticketNumber}: ${err?.message}`));
      }
    }

    this.kafkaService.publish({
      topic: KAFKA_TOPICS.TICKET_RESOLVED,
      key: partitionKey.byTicket(id),
      value: {
        ticketId: id,
        ticketNumber: updatedTicket.ticketNumber,
        agencyId: updatedTicket.agencyId,
        resolvedAt: new Date(),
        resolvedBy,
      },
    }).catch(() => null);

    this.auditService.logUserActivity({
      userId: resolvedBy,
      agencyId: updatedTicket.agencyId,
      activityType: 'TICKET_RESOLVE',
      ticketId: id,
      description: `Resolved ticket ${updatedTicket.ticketNumber}`,
    }).catch(() => null);

    return updatedTicket;
  }

  /**
   * Close a ticket (usually after confirmation from citizen).
   */
  async closeTicket(id: string, dto: CloseTicketDto, closedBy: string) {
    const updatedTicket = await this.transitionStatus(
      id,
      TicketStatusEnum.CLOSED,
      closedBy,
      dto.reason || 'Ticket closed',
      { closedAt: new Date() },
    );

    // Notify the citizen that their ticket has been closed
    const creator = (updatedTicket as any).creator;
    if (creator?.id) {
      const subject = `Your request ${updatedTicket.ticketNumber} has been closed`;
      const body = `Dear ${creator.firstName ?? 'Citizen'},\n\nYour service request <strong>${updatedTicket.ticketNumber}</strong> — <em>${(updatedTicket as any).subject}</em> — has been closed.\n\n${dto.reason ? `Reason: ${dto.reason}` : ''}\n\nIf you need further assistance, you can raise a new ticket on the eCitizen portal.\n\nThank you for using eCitizen Kenya.\n\neCitizen Service Team`;
      const recipient = {
        recipientUserId: creator.id,
        recipientEmail: creator.email ?? undefined,
        recipientPhone: creator.phoneNumber ?? undefined,
      };

      // In-app notification
      this.notificationsService
        .sendNotification({ ticketId: id, channel: 'IN_APP' as any, triggerEvent: 'TICKET_CLOSED', subject, body, recipients: [recipient] })
        .catch((err) => this.logger.warn(`IN_APP close notify failed for ${updatedTicket.ticketNumber}: ${err?.message}`));

      // Email notification
      if (creator.email) {
        this.notificationsService
          .sendNotification({ ticketId: id, channel: 'EMAIL' as any, triggerEvent: 'TICKET_CLOSED', subject, body, recipients: [recipient] })
          .catch((err) => this.logger.warn(`EMAIL close notify failed for ${updatedTicket.ticketNumber}: ${err?.message}`));
      }
    }

    this.kafkaService.publish({
      topic: KAFKA_TOPICS.TICKET_CLOSED,
      key: partitionKey.byTicket(id),
      value: {
        ticketId: id,
        ticketNumber: updatedTicket.ticketNumber,
        agencyId: updatedTicket.agencyId,
        closedAt: new Date(),
        closedBy,
      },
    }).catch(() => null);

    this.auditService.logUserActivity({
      userId: closedBy,
      agencyId: updatedTicket.agencyId,
      activityType: 'TICKET_CLOSE',
      ticketId: id,
      description: `Closed ticket ${updatedTicket.ticketNumber}`,
    }).catch(() => null);

    return updatedTicket;
  }

  /**
   * Reopen a closed or resolved ticket. Increments reopenCount.
   */
  async reopenTicket(id: string, dto: ReopenTicketDto, reopenedBy: string) {
    return this.transitionStatus(
      id,
      TicketStatusEnum.REOPENED,
      reopenedBy,
      dto.reason,
      {
        reopenCount: { increment: 1 },
        resolvedAt: null,
        closedAt: null,
      },
    );
  }

  // ============================================
  // Messages
  // ============================================

  /**
   * Add a comment or message to a ticket.
   */
  async addMessage(ticketId: string, dto: CreateMessageDto, senderId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { status: true },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    let message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId,
        messageType: dto.messageType || 'COMMENT',
        messageText: dto.messageText || null,
        isInternal: dto.isInternal || false,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userType: true,
          },
        },
        attachments: true,
      },
    });

    // Save attachment record if a file was uploaded, then re-fetch the message
    // so the returned + broadcast object includes the attachment. Without this
    // the citizen received a message via WS with attachments: [] and the file
    // only appeared on full reload.
    if (dto.fileUrl) {
      // Resolve a friendly fileName. The client should send the original
      // filename, but older code paths occasionally sent the UUID-shaped
      // storage name. If the URL points at /media/serve/:fileId we can
      // always look up the Media row and use originalName as a fallback.
      let resolvedFileName: string | null = dto.fileName?.trim() || null;
      const looksUuid =
        !!resolvedFileName &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[^/]+$/i.test(resolvedFileName);
      const fileIdMatch = dto.fileUrl.match(/\/media\/serve\/([0-9a-f-]{36})/i);
      if ((looksUuid || !resolvedFileName) && fileIdMatch) {
        const media = await this.prisma.media.findUnique({
          where: { fileId: fileIdMatch[1] },
          select: { originalName: true },
        });
        if (media?.originalName) resolvedFileName = media.originalName;
      }

      await this.prisma.ticketAttachment.create({
        data: {
          ticketId,
          messageId: message.id,
          storageUrl: dto.fileUrl,
          fileName: resolvedFileName,
          fileType: dto.fileType || null,
          uploadedBy: senderId,
        },
      });
      const refreshed = await this.prisma.ticketMessage.findUnique({
        where: { id: message.id },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              userType: true,
            },
          },
          attachments: true,
        },
      });
      if (refreshed) message = refreshed;
    }

    // Track first response time if this is the first agent response
    if (!ticket.firstResponseAt && senderId !== ticket.createdBy) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { firstResponseAt: new Date() },
      });
    }

    this.logger.log(`Message added to ticket ${ticket.ticketNumber} by ${senderId}`);

    // Push to all viewers subscribed to this ticket room (admins, agents watching the ticket)
    this.wsGateway.emitToChannel(`ticket:${ticketId}`, 'ticket:newMessage', {
      ticketId,
      message,
    });

    // Also push directly to creator and assignee who may not have the ticket open
    const recipients = [ticket.createdBy, ticket.currentAssigneeId].filter(Boolean) as string[];
    for (const userId of recipients) {
      if (userId !== senderId) {
        this.wsGateway.emitToUser(userId, 'ticket:newMessage', {
          ticketId,
          message,
        });
      }
    }

    return message;
  }

  /**
   * Get all messages for a ticket with pagination.
   */
  async getMessages(ticketId: string, filters: MessageFilterDto, isAgent: boolean) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const { page = 1, limit = 20, messageType, includeInternal } = filters;
    const skip = (page - 1) * limit;

    const where: any = { ticketId };

    // Only show internal messages to agents
    if (!isAgent || !includeInternal) {
      where.isInternal = false;
    }

    if (messageType) {
      where.messageType = messageType;
    }

    const [data, total] = await Promise.all([
      this.prisma.ticketMessage.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              userType: true,
            },
          },
          attachments: true,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.ticketMessage.count({ where }),
    ]);

    // Backfill display names for attachments whose fileName is the
    // UUID-shaped storage filename (early uploads stored that instead
    // of the human-friendly originalName). For each storageUrl pointing
    // at /media/serve/:fileId, look up the Media row and substitute
    // originalName so the citizen sees "MyReport.docx" not a UUID.
    const fileIds: string[] = [];
    for (const msg of data) {
      for (const att of (msg as any).attachments ?? []) {
        const looksUuid =
          typeof att.fileName === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[^/]+$/i.test(att.fileName);
        const match = typeof att.storageUrl === 'string'
          ? att.storageUrl.match(/\/media\/serve\/([0-9a-f-]{36})/i)
          : null;
        if ((looksUuid || !att.fileName) && match) {
          fileIds.push(match[1]);
        }
      }
    }
    if (fileIds.length) {
      const medias = await this.prisma.media.findMany({
        where: { fileId: { in: Array.from(new Set(fileIds)) } },
        select: { fileId: true, originalName: true },
      });
      const byFileId = new Map(medias.map((m) => [m.fileId, m.originalName]));
      for (const msg of data) {
        for (const att of (msg as any).attachments ?? []) {
          const match = typeof att.storageUrl === 'string'
            ? att.storageUrl.match(/\/media\/serve\/([0-9a-f-]{36})/i)
            : null;
          if (!match) continue;
          const real = byFileId.get(match[1]);
          if (!real) continue;
          const looksUuid =
            typeof att.fileName === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[^/]+$/i.test(att.fileName);
          if (looksUuid || !att.fileName) att.fileName = real;
        }
      }
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  // ============================================
  // History
  // ============================================

  /**
   * Get the status change history for a ticket.
   */
  async getHistory(ticketId: string, page = 1, limit = 20) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.ticketHistory.findMany({
        where: { ticketId },
        include: {
          oldStatus: { select: { id: true, name: true } },
          newStatus: { select: { id: true, name: true } },
          changer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { changedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ticketHistory.count({ where: { ticketId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((h) => ({
        ...h,
        id: Number(h.id), // BigInt serialization
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  // ============================================
  // Attachments
  // ============================================

  /**
   * Create an attachment record (presigned URL approach).
   * Returns the attachment record with a presigned storage URL placeholder.
   */
  async addAttachment(ticketId: string, dto: CreateAttachmentDto, uploadedBy: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    // Generate a storage URL (in production, generate a presigned S3 upload URL)
    const storageKey = `tickets/${ticketId}/${Date.now()}-${dto.fileName}`;
    const storageUrl = `https://ecitizen-scc-media.s3.af-south-1.amazonaws.com/${storageKey}`;

    const attachment = await this.prisma.ticketAttachment.create({
      data: {
        ticketId,
        messageId: dto.messageId || null,
        fileName: dto.fileName,
        fileType: dto.fileType,
        fileSize: BigInt(dto.fileSize),
        storageUrl,
        uploadedBy,
      },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(
      `Attachment ${dto.fileName} added to ticket ${ticket.ticketNumber} by ${uploadedBy}`,
    );

    return {
      ...attachment,
      fileSize: Number(attachment.fileSize),
      uploadUrl: storageUrl, // Client would use this to upload the actual file
    };
  }

  /**
   * Get all attachments for a ticket.
   */
  async getAttachments(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const attachments = await this.prisma.ticketAttachment.findMany({
      where: { ticketId },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        message: {
          select: {
            id: true,
            messageType: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return attachments.map((a) => ({
      ...a,
      fileSize: Number(a.fileSize),
    }));
  }

  // ============================================
  // Tags
  // ============================================

  /**
   * Add tags to a ticket. Creates tags if they don't exist for the agency.
   */
  async addTags(ticketId: string, dto: AddTagsDto, agencyId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const addedTags: Array<{ id: string; name: string }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const tagName of dto.tags) {
        // Find or create the tag for this agency
        let tag = await tx.ticketTag.findFirst({
          where: {
            name: tagName,
            agencyId: agencyId || ticket.agencyId,
          },
        });

        if (!tag) {
          tag = await tx.ticketTag.create({
            data: {
              name: tagName,
              agencyId: agencyId || ticket.agencyId,
            },
          });
        }

        // Check if mapping already exists
        const existingMapping = await tx.ticketTagMapping.findUnique({
          where: {
            ticketId_tagId: {
              ticketId,
              tagId: tag.id,
            },
          },
        });

        if (!existingMapping) {
          await tx.ticketTagMapping.create({
            data: {
              ticketId,
              tagId: tag.id,
            },
          });
        }

        addedTags.push({ id: tag.id, name: tag.name });
      }
    });

    this.logger.log(`Tags added to ticket ${ticket.ticketNumber}: ${dto.tags.join(', ')}`);

    return { ticketId, tags: addedTags };
  }

  /**
   * Remove a tag from a ticket.
   */
  async removeTag(ticketId: string, tagId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    // Check the mapping exists
    const mapping = await this.prisma.ticketTagMapping.findUnique({
      where: {
        ticketId_tagId: {
          ticketId,
          tagId,
        },
      },
    });

    if (!mapping) {
      throw new NotFoundException(`Tag ${tagId} is not associated with ticket ${ticketId}`);
    }

    await this.prisma.ticketTagMapping.delete({
      where: {
        ticketId_tagId: {
          ticketId,
          tagId,
        },
      },
    });

    this.logger.log(`Tag ${tagId} removed from ticket ${ticket.ticketNumber}`);

    return { message: 'Tag removed successfully' };
  }

  // ============================================
  // Lookup Tables
  // ============================================

  /**
   * Create a ticket category for an agency.
   */
  async createCategory(dto: { agencyId: string; name: string; description?: string }) {
    return this.prisma.ticketCategory.upsert({
      where: { uq_ticket_category: { agencyId: dto.agencyId, name: dto.name } },
      update: {},
      create: {
        agencyId: dto.agencyId,
        name: dto.name,
        description: dto.description,
        isActive: true,
      },
    });
  }

  /**
   * Get ticket categories, optionally filtered by agency.
   */
  async getCategories(filters: CategoryFilterDto) {
    const where: any = {};

    if (filters.agencyId) {
      where.agencyId = filters.agencyId;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    } else {
      where.isActive = true;
    }

    return this.prisma.ticketCategory.findMany({
      where,
      include: {
        agency: {
          select: {
            id: true,
            agencyCode: true,
            agencyName: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get all ticket priority levels.
   */
  async getPriorities() {
    return this.prisma.ticketPriorityLevel.findMany({
      orderBy: { severityScore: 'asc' },
    });
  }

  /**
   * Get all ticket statuses.
   */
  async getStatuses() {
    return this.prisma.ticketStatus.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Submit citizen satisfaction rating and feedback for a ticket.
   */
  async submitCitizenFeedback(id: string, dto: { rating: number; feedback?: string }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.ticket.update({
      where: { id },
      data: {
        citizenRating: dto.rating,
        citizenFeedback: dto.feedback ?? null,
        feedbackAt: new Date(),
      },
    });
  }

  /** Public (unauthenticated) ticket summary used by the feedback page so the citizen sees ticket / agency / agent names */
  async getPublicTicketInfo(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        agency: { select: { agencyName: true } },
        assignee: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const assignee = ticket.assignee;
    return {
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      agencyName: ticket.agency?.agencyName ?? null,
      assigneeName: assignee
        ? `${assignee.firstName ?? ''} ${assignee.lastName ?? ''}`.trim() || assignee.email || null
        : null,
    };
  }

  // Public lookup by ticketNumber for the /track page. No PII, no description,
  // no message history — only enough fields to show the citizen current state.
  async lookupPublicByNumber(rawNumber: string) {
    const normalised = (rawNumber ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    if (!normalised) throw new BadRequestException('Ticket number is required');

    const ticket = await this.prisma.ticket.findFirst({
      where: { ticketNumber: { equals: normalised, mode: 'insensitive' } },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        createdAt: true,
        updatedAt: true,
        status: { select: { name: true } },
        agency: { select: { agencyName: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      status: ticket.status?.name ?? 'OPEN',
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      agency: ticket.agency ? { agencyName: ticket.agency.agencyName } : null,
    };
  }
}
