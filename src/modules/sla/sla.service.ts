import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@config/prisma.service';
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

  constructor(private readonly prisma: PrismaService) {}

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
    await this.prisma.slaRule.deleteMany({ where: { slaPolicyId: id } });
    await this.prisma.slaPolicy.delete({ where: { id } });
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
    if (!tracking) {
      throw new NotFoundException(`SLA tracking for ticket ${ticketId} not found`);
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
      include: { ticket: { select: { agencyId: true, escalationLevel: true } } },
    });
    if (!tracking) return;

    const currentLevel = tracking.escalationLevel;
    const newLevel = currentLevel + 1;

    // Find the escalation matrix for this agency
    const matrix = await this.prisma.escalationMatrix.findFirst({
      where: {
        agencyId: tracking.ticket.agencyId,
        autoEscalationEnabled: true,
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
