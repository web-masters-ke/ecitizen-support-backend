import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PaginatedResult } from '../../common/dto/pagination.dto';
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

  constructor(private readonly prisma: PrismaService) {}

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

    this.logger.log(`Ticket created: ${ticketNumber} by user ${createdBy}`);

    return ticket;
  }

  /**
   * Get paginated list of tickets with extensive filtering.
   */
  async findAll(
    filters: TicketFilterDto,
    userAgencyId?: string,
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      agencyId,
      priorityId,
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

    // Agency scoping: if user has an agencyId, scope to that agency
    // unless they explicitly request a different one (for super admins)
    if (agencyId) {
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

    if (createdBy) {
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
   * Get a single ticket with full details including messages, assignments,
   * history, SLA tracking, and AI classification.
   */
  async findById(id: string) {
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
            changeReason: `Assigned to ${assignee.firstName || ''} ${assignee.lastName || ''}: ${dto.reason || 'No reason provided'}`.trim(),
          },
        }),
        this.prisma.ticketMessage.create({
          data: {
            ticketId: id,
            senderId: assignedBy,
            messageType: 'STATUS_CHANGE',
            messageText: `Ticket assigned to ${assignee.firstName || ''} ${assignee.lastName || ''}${dto.reason ? `. Reason: ${dto.reason}` : ''}`.trim(),
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
          messageText: `Ticket reassigned to ${assignee.firstName || ''} ${assignee.lastName || ''}${dto.reason ? `. Reason: ${dto.reason}` : ''}`.trim(),
          isInternal: true,
        },
      }),
    ]);

    this.logger.log(
      `Ticket ${ticket.ticketNumber} reassigned to ${dto.assigneeId} by ${assignedBy}`,
    );

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
      include: { status: true, slaTracking: true },
    });

    if (!ticket || ticket.isDeleted) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const currentStatusName = ticket.status.name as TicketStatusEnum;
    this.validateTransition(currentStatusName, TicketStatusEnum.ESCALATED);

    const escalatedStatus = await this.getStatusByName(TicketStatusEnum.ESCALATED);
    const newEscalationLevel = ticket.escalationLevel + 1;
    const trigger = dto.trigger || EscalationTriggerEnum.MANUAL_OVERRIDE;

    const [updatedTicket] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id },
        data: {
          statusId: escalatedStatus.id,
          escalationLevel: newEscalationLevel,
          isEscalated: true,
        },
        include: this.fullTicketInclude(),
      }),
      this.prisma.ticketHistory.create({
        data: {
          ticketId: id,
          oldStatusId: ticket.statusId,
          newStatusId: escalatedStatus.id,
          changedBy: escalatedBy,
          changeReason: `Escalated to L${newEscalationLevel}: ${dto.reason || 'No reason provided'}`,
        },
      }),
      this.prisma.escalationEvent.create({
        data: {
          ticketId: id,
          slaTrackingId: ticket.slaTracking?.id || null,
          previousLevel: ticket.escalationLevel,
          newLevel: newEscalationLevel,
          escalatedToUserId: dto.escalateToUserId || null,
          escalatedToRole: dto.escalateToRole || null,
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

    this.logger.log(
      `Ticket ${ticket.ticketNumber} escalated to L${newEscalationLevel} by ${escalatedBy}`,
    );

    return updatedTicket;
  }

  // ============================================
  // Resolve / Close / Reopen
  // ============================================

  /**
   * Mark a ticket as resolved.
   */
  async resolveTicket(id: string, dto: ResolveTicketDto, resolvedBy: string) {
    return this.transitionStatus(
      id,
      TicketStatusEnum.RESOLVED,
      resolvedBy,
      dto.resolutionNotes || 'Ticket resolved',
      { resolvedAt: new Date() },
    );
  }

  /**
   * Close a ticket (usually after confirmation from citizen).
   */
  async closeTicket(id: string, dto: CloseTicketDto, closedBy: string) {
    return this.transitionStatus(
      id,
      TicketStatusEnum.CLOSED,
      closedBy,
      dto.reason || 'Ticket closed',
      { closedAt: new Date() },
    );
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

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId,
        messageType: dto.messageType || 'COMMENT',
        messageText: dto.messageText,
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
      },
    });

    // Track first response time if this is the first agent response
    if (!ticket.firstResponseAt && senderId !== ticket.createdBy) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { firstResponseAt: new Date() },
      });
    }

    this.logger.log(`Message added to ticket ${ticket.ticketNumber} by ${senderId}`);

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
}
