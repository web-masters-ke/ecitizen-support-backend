import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  DateRangeDto,
  SlaOverrideDto,
  TicketReassignDto,
  TicketPriorityChangeDto,
  TicketSearchDto,
  CreateRoleDto,
  SetPermissionsDto,
  UpdateSlaPolicyDto,
  UpdateEscalationPolicyDto,
} from './dto/admin.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // DASHBOARD METRICS
  // ============================================

  /**
   * National overview dashboard metrics
   */
  async getDashboardMetrics(dto: DateRangeDto) {
    const dateFilter = this.buildDateFilter(dto);
    const agencyFilter = dto.agencyId ? { agencyId: dto.agencyId } : {};

    // Parallel queries for performance
    const [
      totalTickets,
      openTickets,
      resolvedTickets,
      closedTickets,
      escalatedTickets,
      totalAgencies,
      activeAgents,
      ticketsByChannel,
      ticketsByPriority,
      avgMetrics,
      slaCompliance,
      ticketTrend,
    ] = await Promise.all([
      // Total tickets
      this.prisma.ticket.count({
        where: { ...agencyFilter, ...dateFilter, isDeleted: false },
      }),
      // Open tickets (status name = OPEN, ASSIGNED, IN_PROGRESS, REOPENED)
      this.prisma.ticket.count({
        where: {
          ...agencyFilter,
          ...dateFilter,
          isDeleted: false,
          status: { name: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'] } },
        },
      }),
      // Resolved
      this.prisma.ticket.count({
        where: {
          ...agencyFilter,
          ...dateFilter,
          isDeleted: false,
          status: { name: 'RESOLVED' },
        },
      }),
      // Closed
      this.prisma.ticket.count({
        where: {
          ...agencyFilter,
          ...dateFilter,
          isDeleted: false,
          status: { name: 'CLOSED' },
        },
      }),
      // Escalated
      this.prisma.ticket.count({
        where: { ...agencyFilter, ...dateFilter, isDeleted: false, isEscalated: true },
      }),
      // Total agencies
      this.prisma.agency.count({ where: { isActive: true } }),
      // Active agents
      this.prisma.user.count({
        where: {
          isActive: true,
          userType: { in: ['AGENCY_AGENT', 'SERVICE_PROVIDER_AGENT'] },
        },
      }),
      // Tickets by channel
      this.prisma.ticket.groupBy({
        by: ['channel'],
        where: { ...agencyFilter, ...dateFilter, isDeleted: false },
        _count: true,
      }),
      // Tickets by priority
      this.prisma.ticket.findMany({
        where: { ...agencyFilter, ...dateFilter, isDeleted: false, priorityId: { not: null } },
        select: {
          priority: { select: { name: true } },
        },
      }),
      // Placeholder: average response/resolution times are computed below from ticket timestamps
      Promise.resolve(null),
      // SLA compliance
      this.prisma.slaTracking.findMany({
        where: {
          ticket: { ...agencyFilter, ...dateFilter, isDeleted: false },
        },
        select: {
          responseMet: true,
          resolutionMet: true,
          responseBreached: true,
          resolutionBreached: true,
        },
      }),
      // Ticket trend (last 30 days using daily metrics)
      this.prisma.ticketMetricDaily.findMany({
        where: {
          ...(dto.agencyId ? { agencyId: dto.agencyId } : {}),
          dateBucket: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { dateBucket: 'asc' },
        select: {
          dateBucket: true,
          ticketsCreated: true,
        },
      }),
    ]);

    // Process channel counts
    const channelCounts: Record<string, number> = {};
    for (const item of ticketsByChannel) {
      channelCounts[item.channel] = item._count;
    }

    // Process priority counts
    const priorityCounts: Record<string, number> = {};
    for (const item of ticketsByPriority) {
      const name = item.priority?.name || 'UNSET';
      priorityCounts[name] = (priorityCounts[name] || 0) + 1;
    }

    // Calculate SLA compliance percentage
    const totalSla = slaCompliance.length;
    const metCount = slaCompliance.filter(
      (s) => s.responseMet !== false && s.resolutionMet !== false,
    ).length;
    const slaCompliancePercentage =
      totalSla > 0 ? Math.round((metCount / totalSla) * 10000) / 100 : 100;

    // Calculate average times from resolved tickets
    const resolvedTicketsWithTimes = await this.prisma.ticket.findMany({
      where: {
        ...agencyFilter,
        ...dateFilter,
        isDeleted: false,
        firstResponseAt: { not: null },
      },
      select: {
        createdAt: true,
        firstResponseAt: true,
        resolvedAt: true,
      },
    });

    let avgResponseTime = 0;
    let avgResolutionTime = 0;

    if (resolvedTicketsWithTimes.length > 0) {
      const responseTimes = resolvedTicketsWithTimes
        .filter((t) => t.firstResponseAt)
        .map((t) => (t.firstResponseAt!.getTime() - t.createdAt.getTime()) / 60000);

      const resolutionTimes = resolvedTicketsWithTimes
        .filter((t) => t.resolvedAt)
        .map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 60000);

      if (responseTimes.length > 0) {
        avgResponseTime =
          Math.round(
            (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 100,
          ) / 100;
      }

      if (resolutionTimes.length > 0) {
        avgResolutionTime =
          Math.round(
            (resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) * 100,
          ) / 100;
      }
    }

    return {
      totalTickets,
      openTickets,
      resolvedTickets,
      closedTickets,
      escalatedTickets,
      averageResponseTimeMinutes: avgResponseTime,
      averageResolutionTimeMinutes: avgResolutionTime,
      slaCompliancePercentage,
      totalAgencies,
      activeAgents,
      ticketsByChannel: channelCounts,
      ticketsByPriority: priorityCounts,
      ticketTrend: ticketTrend.map((t) => ({
        date: t.dateBucket.toISOString().split('T')[0],
        count: t.ticketsCreated,
      })),
    };
  }

  /**
   * SLA summary across all agencies
   */
  async getSlaSummary(dto: DateRangeDto) {
    const dateFilter = this.buildDateFilter(dto);

    const slaData = await this.prisma.slaTracking.findMany({
      where: {
        ticket: { ...dateFilter, isDeleted: false },
      },
      include: {
        ticket: {
          select: {
            agencyId: true,
            agency: { select: { agencyName: true } },
          },
        },
      },
    });

    const totalTracked = slaData.length;
    const responseMet = slaData.filter((s) => s.responseMet === true).length;
    const responseBreached = slaData.filter((s) => s.responseBreached).length;
    const resolutionMet = slaData.filter((s) => s.resolutionMet === true).length;
    const resolutionBreached = slaData.filter((s) => s.resolutionBreached).length;

    const overallCompliancePercentage =
      totalTracked > 0
        ? Math.round(
            (slaData.filter((s) => !s.responseBreached && !s.resolutionBreached).length /
              totalTracked) *
              10000,
          ) / 100
        : 100;

    // Breakdown by agency
    const agencyMap = new Map<string, { name: string; total: number; breached: number }>();
    for (const s of slaData) {
      const aid = s.ticket.agencyId;
      const existing = agencyMap.get(aid) || {
        name: s.ticket.agency.agencyName,
        total: 0,
        breached: 0,
      };
      existing.total += 1;
      if (s.responseBreached || s.resolutionBreached) {
        existing.breached += 1;
      }
      agencyMap.set(aid, existing);
    }

    const agencyBreakdown = Array.from(agencyMap.entries()).map(([agencyId, data]) => ({
      agencyId,
      agencyName: data.name,
      compliancePercentage:
        data.total > 0
          ? Math.round(((data.total - data.breached) / data.total) * 10000) / 100
          : 100,
      totalTracked: data.total,
      breached: data.breached,
    }));

    return {
      totalTracked,
      responseMet,
      responseBreached,
      resolutionMet,
      resolutionBreached,
      overallCompliancePercentage,
      agencyBreakdown,
    };
  }

  /**
   * Escalation summary
   */
  async getEscalationSummary(dto: DateRangeDto) {
    const dateFilter: any = {};
    if (dto.startDate) {
      dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(dto.startDate) };
    }
    if (dto.endDate) {
      dateFilter.createdAt = { ...dateFilter.createdAt, lte: new Date(dto.endDate) };
    }

    const [escalations, escalationsByTrigger, escalationsByAgency] = await Promise.all([
      this.prisma.escalationEvent.findMany({
        where: dateFilter,
        include: {
          ticket: {
            select: {
              ticketNumber: true,
              subject: true,
              agencyId: true,
              agency: { select: { agencyName: true } },
              status: { select: { name: true } },
            },
          },
          escalatedTo: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.escalationEvent.groupBy({
        by: ['triggeredBy'],
        where: dateFilter,
        _count: true,
      }),
      this.prisma.escalationEvent.findMany({
        where: dateFilter,
        include: {
          ticket: {
            select: {
              agencyId: true,
              agency: { select: { agencyName: true } },
            },
          },
        },
      }),
    ]);

    const triggerCounts: Record<string, number> = {};
    for (const item of escalationsByTrigger) {
      triggerCounts[item.triggeredBy] = item._count;
    }

    // Count by agency
    const agencyCountMap = new Map<string, { name: string; count: number }>();
    for (const e of escalationsByAgency) {
      const aid = e.ticket.agencyId;
      const existing = agencyCountMap.get(aid) || {
        name: e.ticket.agency.agencyName,
        count: 0,
      };
      existing.count += 1;
      agencyCountMap.set(aid, existing);
    }

    const totalEscalations = escalations.length;
    const pendingEscalations = escalations.filter(
      (e) => e.ticket.status.name !== 'RESOLVED' && e.ticket.status.name !== 'CLOSED',
    ).length;
    const resolvedEscalations = totalEscalations - pendingEscalations;

    return {
      totalEscalations,
      pendingEscalations,
      resolvedEscalations,
      escalationsByTrigger: triggerCounts,
      escalationsByAgency: Array.from(agencyCountMap.entries()).map(
        ([agencyId, data]) => ({
          agencyId,
          agencyName: data.name,
          count: data.count,
        }),
      ),
      recentEscalations: escalations.slice(0, 20),
    };
  }

  /**
   * AI classification and recommendation metrics
   */
  async getAiMetrics(dto: DateRangeDto) {
    const dateFilter: any = {};
    if (dto.startDate) {
      dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(dto.startDate) };
    }
    if (dto.endDate) {
      dateFilter.createdAt = { ...dateFilter.createdAt, lte: new Date(dto.endDate) };
    }

    const [
      totalClassifications,
      autoApplied,
      manualOverrides,
      avgConfidence,
      classificationsByCategory,
      totalRecommendations,
      appliedRecommendations,
    ] = await Promise.all([
      this.prisma.aiClassificationLog.count({ where: dateFilter }),
      this.prisma.aiClassificationLog.count({
        where: { ...dateFilter, autoApplied: true },
      }),
      this.prisma.aiClassificationLog.count({
        where: { ...dateFilter, manualOverride: true },
      }),
      this.prisma.aiClassificationLog.aggregate({
        where: dateFilter,
        _avg: { confidenceScore: true },
      }),
      this.prisma.aiClassificationLog.findMany({
        where: { ...dateFilter, predictedCategoryId: { not: null } },
        include: {
          predictedCategory: { select: { name: true } },
        },
      }),
      this.prisma.aiRecommendation.count({ where: dateFilter }),
      this.prisma.aiRecommendation.count({
        where: { ...dateFilter, applied: true },
      }),
    ]);

    // Count classifications by category
    const categoryCounts: Record<string, number> = {};
    for (const item of classificationsByCategory) {
      const name = item.predictedCategory?.name || 'Unknown';
      categoryCounts[name] = (categoryCounts[name] || 0) + 1;
    }

    // Accuracy rate: auto-applied that weren't manually overridden
    const accuracyRate =
      totalClassifications > 0
        ? Math.round(
            ((autoApplied - manualOverrides) /
              Math.max(autoApplied, 1)) *
              10000,
          ) / 100
        : 0;

    return {
      totalClassifications,
      autoApplied,
      manualOverrides,
      averageConfidenceScore: avgConfidence._avg.confidenceScore
        ? Number(avgConfidence._avg.confidenceScore)
        : 0,
      classificationsByCategory: categoryCounts,
      accuracyRate: Math.max(0, accuracyRate),
      totalRecommendations,
      appliedRecommendations,
    };
  }

  // ============================================
  // TICKET OPERATIONS
  // ============================================

  /**
   * Override SLA deadlines for a ticket with justification
   */
  async overrideSla(ticketId: string, dto: SlaOverrideDto, adminUserId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { slaTracking: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    if (!ticket.slaTracking) {
      throw new BadRequestException('Ticket does not have SLA tracking');
    }

    const updateData: any = {};
    const ticketUpdateData: any = {};

    if (dto.newResponseDueAt) {
      updateData.responseDueAt = new Date(dto.newResponseDueAt);
      ticketUpdateData.slaResponseDueAt = new Date(dto.newResponseDueAt);
    }

    if (dto.newResolutionDueAt) {
      updateData.resolutionDueAt = new Date(dto.newResolutionDueAt);
      ticketUpdateData.slaResolutionDueAt = new Date(dto.newResolutionDueAt);
    }

    // Update SLA tracking
    const updatedSla = await this.prisma.slaTracking.update({
      where: { id: ticket.slaTracking.id },
      data: updateData,
    });

    // Update ticket SLA dates
    if (Object.keys(ticketUpdateData).length > 0) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: ticketUpdateData,
      });
    }

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        entityType: 'SLA_TRACKING',
        entityId: ticket.slaTracking.id,
        actionType: 'SLA_OVERRIDE',
        oldValue: {
          responseDueAt: ticket.slaTracking.responseDueAt.toISOString(),
          resolutionDueAt: ticket.slaTracking.resolutionDueAt.toISOString(),
        },
        newValue: {
          responseDueAt: updatedSla.responseDueAt.toISOString(),
          resolutionDueAt: updatedSla.resolutionDueAt.toISOString(),
          justification: dto.justification,
        },
        performedBy: adminUserId,
        performedByRole: 'COMMAND_CENTER_ADMIN',
      },
    });

    this.logger.log(
      `SLA override for ticket ${ticketId} by admin ${adminUserId}: ${dto.justification}`,
    );

    return {
      ticketId,
      slaTrackingId: updatedSla.id,
      newResponseDueAt: updatedSla.responseDueAt,
      newResolutionDueAt: updatedSla.resolutionDueAt,
      justification: dto.justification,
      overriddenBy: adminUserId,
    };
  }

  /**
   * Cross-agency ticket reassignment
   */
  async reassignTicket(ticketId: string, dto: TicketReassignDto, adminUserId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        status: true,
        agency: { select: { agencyName: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    // Verify target agency exists
    const targetAgency = await this.prisma.agency.findUnique({
      where: { id: dto.targetAgencyId },
    });

    if (!targetAgency) {
      throw new NotFoundException(`Target agency ${dto.targetAgencyId} not found`);
    }

    // Verify assignee if provided
    if (dto.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
      });
      if (!assignee) {
        throw new NotFoundException(`Assignee ${dto.assigneeId} not found`);
      }
    }

    // Update ticket
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        agencyId: dto.targetAgencyId,
        departmentId: dto.targetDepartmentId || null,
        currentAssigneeId: dto.assigneeId || null,
      },
      include: {
        agency: { select: { agencyName: true } },
        assignee: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    // Record assignment
    await this.prisma.ticketAssignment.create({
      data: {
        ticketId,
        assignedTo: dto.assigneeId || null,
        assignedBy: adminUserId,
        assignmentReason: `Cross-agency reassignment: ${dto.reason}`,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        entityType: 'TICKET',
        entityId: ticketId,
        actionType: 'CROSS_AGENCY_REASSIGN',
        oldValue: {
          agencyId: ticket.agencyId,
          agencyName: ticket.agency.agencyName,
        },
        newValue: {
          agencyId: dto.targetAgencyId,
          agencyName: targetAgency.agencyName,
          assigneeId: dto.assigneeId,
          reason: dto.reason,
        },
        performedBy: adminUserId,
        performedByRole: 'COMMAND_CENTER_ADMIN',
      },
    });

    this.logger.log(
      `Ticket ${ticketId} reassigned from ${ticket.agency.agencyName} to ${targetAgency.agencyName} by admin ${adminUserId}`,
    );

    return updated;
  }

  /**
   * Change ticket priority
   */
  async changeTicketPriority(
    ticketId: string,
    dto: TicketPriorityChangeDto,
    adminUserId: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { priority: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const newPriority = await this.prisma.ticketPriorityLevel.findUnique({
      where: { id: dto.priorityId },
    });

    if (!newPriority) {
      throw new NotFoundException(`Priority level ${dto.priorityId} not found`);
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { priorityId: dto.priorityId },
      include: { priority: true },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        entityType: 'TICKET',
        entityId: ticketId,
        actionType: 'PRIORITY_CHANGE',
        oldValue: {
          priorityId: ticket.priorityId,
          priorityName: ticket.priority?.name || 'UNSET',
        },
        newValue: {
          priorityId: dto.priorityId,
          priorityName: newPriority.name,
          reason: dto.reason,
        },
        performedBy: adminUserId,
        performedByRole: 'COMMAND_CENTER_ADMIN',
      },
    });

    this.logger.log(
      `Ticket ${ticketId} priority changed to ${newPriority.name} by admin ${adminUserId}`,
    );

    return updated;
  }

  /**
   * Cross-agency ticket search
   */
  async searchTickets(dto: TicketSearchDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: any = { isDeleted: false };

    if (dto.ticketNumber) {
      where.ticketNumber = { contains: dto.ticketNumber, mode: 'insensitive' };
    }

    if (dto.query) {
      where.OR = [
        { subject: { contains: dto.query, mode: 'insensitive' } },
        { description: { contains: dto.query, mode: 'insensitive' } },
      ];
    }

    if (dto.agencyId) {
      where.agencyId = dto.agencyId;
    }

    if (dto.status) {
      where.status = { name: dto.status };
    }

    if (dto.priority) {
      where.priority = { name: dto.priority };
    }

    if (dto.channel) {
      where.channel = dto.channel;
    }

    if (dto.assigneeId) {
      where.currentAssigneeId = dto.assigneeId;
    }

    if (dto.escalatedOnly) {
      where.isEscalated = true;
    }

    if (dto.createdAfter || dto.createdBefore) {
      where.createdAt = {};
      if (dto.createdAfter) {
        where.createdAt.gte = new Date(dto.createdAfter);
      }
      if (dto.createdBefore) {
        where.createdAt.lte = new Date(dto.createdBefore);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          agency: { select: { agencyCode: true, agencyName: true } },
          department: { select: { departmentName: true } },
          category: { select: { name: true } },
          creator: { select: { firstName: true, lastName: true, email: true } },
          assignee: { select: { firstName: true, lastName: true, email: true } },
          priority: { select: { name: true, severityScore: true } },
          status: { select: { name: true } },
          slaTracking: {
            select: {
              responseDueAt: true,
              resolutionDueAt: true,
              responseBreached: true,
              resolutionBreached: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
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

  // ============================================
  // ROLES & PERMISSIONS
  // ============================================

  /**
   * List all roles
   */
  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { userRoles: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a custom role
   */
  async createRole(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Role with name "${dto.name}" already exists`);
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        isSystemRole: dto.isSystemRole || false,
      },
    });
  }

  /**
   * Set permissions for a role (replaces all existing permissions)
   */
  async setRolePermissions(roleId: string, dto: SetPermissionsDto) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    // Verify all permission IDs exist
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    });

    if (permissions.length !== dto.permissionIds.length) {
      const foundIds = permissions.map((p) => p.id);
      const missing = dto.permissionIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`Permissions not found: ${missing.join(', ')}`);
    }

    // Delete existing permissions and create new ones in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      if (dto.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }
    });

    // Return updated role with permissions
    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
  }

  /**
   * List all permissions
   */
  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  // ============================================
  // POLICIES
  // ============================================

  /**
   * Update or create global SLA policy
   */
  async updateSlaPolicy(dto: UpdateSlaPolicyDto, adminUserId: string) {
    // Check if policy exists
    const existing = await this.prisma.slaPolicy.findFirst({
      where: {
        agencyId: dto.agencyId,
        policyName: dto.policyName,
      },
    });

    let policy: any;

    if (existing) {
      policy = await this.prisma.slaPolicy.update({
        where: { id: existing.id },
        data: {
          description: dto.description ?? existing.description,
          isActive: dto.isActive ?? existing.isActive,
          appliesBusinessHours:
            dto.appliesBusinessHours ?? existing.appliesBusinessHours,
        },
      });
    } else {
      policy = await this.prisma.slaPolicy.create({
        data: {
          agencyId: dto.agencyId,
          policyName: dto.policyName,
          description: dto.description || null,
          isActive: dto.isActive ?? true,
          appliesBusinessHours: dto.appliesBusinessHours ?? true,
        },
      });
    }

    // Update rules if provided
    if (dto.rules && dto.rules.length > 0) {
      // Delete existing rules
      await this.prisma.slaRule.deleteMany({
        where: { slaPolicyId: policy.id },
      });

      // Create new rules
      await this.prisma.slaRule.createMany({
        data: dto.rules.map((rule) => ({
          slaPolicyId: policy.id,
          priorityId: rule.priorityId || null,
          categoryId: rule.categoryId || null,
          responseTimeMinutes: rule.responseTimeMinutes,
          resolutionTimeMinutes: rule.resolutionTimeMinutes,
          escalationAfterMinutes: rule.escalationAfterMinutes || null,
        })),
      });
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        entityType: 'SLA_POLICY',
        entityId: policy.id,
        actionType: existing ? 'UPDATE' : 'CREATE',
        newValue: dto as any,
        performedBy: adminUserId,
        performedByRole: 'COMMAND_CENTER_ADMIN',
      },
    });

    // Return full policy with rules
    return this.prisma.slaPolicy.findUnique({
      where: { id: policy.id },
      include: {
        slaRules: {
          include: {
            priority: { select: { name: true } },
            category: { select: { name: true } },
          },
        },
        agency: { select: { agencyCode: true, agencyName: true } },
      },
    });
  }

  /**
   * Update escalation policy (escalation matrix)
   */
  async updateEscalationPolicy(
    dto: UpdateEscalationPolicyDto,
    adminUserId: string,
  ) {
    // Check if matrix exists
    const existing = await this.prisma.escalationMatrix.findFirst({
      where: {
        agencyId: dto.agencyId,
        priorityLevel: dto.priorityLevel,
      },
    });

    let matrix: any;

    if (existing) {
      matrix = await this.prisma.escalationMatrix.update({
        where: { id: existing.id },
        data: {
          maxResponseTimeMinutes: dto.maxResponseTimeMinutes,
          maxResolutionTimeMinutes: dto.maxResolutionTimeMinutes,
          autoEscalationEnabled:
            dto.autoEscalationEnabled ?? existing.autoEscalationEnabled,
        },
      });
    } else {
      matrix = await this.prisma.escalationMatrix.create({
        data: {
          agencyId: dto.agencyId,
          priorityLevel: dto.priorityLevel,
          maxResponseTimeMinutes: dto.maxResponseTimeMinutes,
          maxResolutionTimeMinutes: dto.maxResolutionTimeMinutes,
          autoEscalationEnabled: dto.autoEscalationEnabled ?? true,
        },
      });
    }

    // Update levels if provided
    if (dto.levels && dto.levels.length > 0) {
      // Delete existing levels
      await this.prisma.escalationLevel.deleteMany({
        where: { escalationMatrixId: matrix.id },
      });

      // Create new levels
      await this.prisma.escalationLevel.createMany({
        data: dto.levels.map((level) => ({
          escalationMatrixId: matrix.id,
          levelNumber: level.levelNumber,
          escalationRole: level.escalationRole || null,
          escalationDepartmentId: level.escalationDepartmentId || null,
          notifyViaEmail: level.notifyViaEmail ?? true,
          notifyViaSms: level.notifyViaSms ?? false,
        })),
      });
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        entityType: 'ESCALATION_MATRIX',
        entityId: matrix.id,
        actionType: existing ? 'UPDATE' : 'CREATE',
        newValue: dto as any,
        performedBy: adminUserId,
        performedByRole: 'COMMAND_CENTER_ADMIN',
      },
    });

    return this.prisma.escalationMatrix.findUnique({
      where: { id: matrix.id },
      include: {
        escalationLevels: {
          orderBy: { levelNumber: 'asc' },
        },
        agency: { select: { agencyCode: true, agencyName: true } },
      },
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private buildDateFilter(dto: DateRangeDto): any {
    const filter: any = {};
    if (dto.startDate || dto.endDate) {
      filter.createdAt = {};
      if (dto.startDate) {
        filter.createdAt.gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        filter.createdAt.lte = new Date(dto.endDate);
      }
    }
    return filter;
  }
}
