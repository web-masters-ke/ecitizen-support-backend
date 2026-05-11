import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { TicketStatusName, TicketPriorityName } from '@prisma/client';
import {
  QueryDashboardMetricsDto,
  QuerySlaReportDto,
  QueryAgencyPerformanceDto,
  QueryTicketMetricsHourlyDto,
  QueryTicketMetricsDailyDto,
  QueryUserPerformanceDto,
  CreateExportRequestDto,
  ExportFormat,
  QuerySnapshotsDto,
  QueryIncomingThreadsDto,
} from './dto/reporting.dto';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── DASHBOARD METRICS (NATIONAL OVERVIEW) ────────────────────────────────

  async getDashboardMetrics(query: QueryDashboardMetricsDto) {
    const agencyFilter = query.agencyId
      ? { agencyId: query.agencyId }
      : {};

    // Resolve status/priority name filters to IDs. Names are Prisma enums —
    // upper-case the incoming string and look it up. Unknown values resolve
    // to null, which silently disables that filter.
    const statusEnum = query.status
      ? (query.status.toUpperCase() as TicketStatusName)
      : null;
    const priorityEnum = query.priority
      ? (query.priority.toUpperCase() as TicketPriorityName)
      : null;
    const [statusRow, priorityRow] = await Promise.all([
      statusEnum
        ? this.prisma.ticketStatus.findFirst({
            where: { name: statusEnum },
            select: { id: true },
          })
        : Promise.resolve(null),
      priorityEnum
        ? this.prisma.ticketPriorityLevel.findFirst({
            where: { name: priorityEnum },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query.startDate) dateFilter.gte = new Date(query.startDate);
    if (query.endDate) {
      // Treat endDate as inclusive end-of-day
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    // Filters applied to every ticket query
    const ticketBaseFilter = {
      ...agencyFilter,
      ...createdAtFilter,
      isDeleted: false,
      ...(statusRow ? { statusId: statusRow.id } : {}),
      ...(priorityRow ? { priorityId: priorityRow.id } : {}),
    };

    // Get current open ticket statuses
    const openStatuses = await this.prisma.ticketStatus.findMany({
      where: {
        isClosedStatus: false,
        name: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED', 'REOPENED'] },
      },
      select: { id: true },
    });
    const openStatusIds = openStatuses.map((s) => s.id);

    const resolvedStatus = await this.prisma.ticketStatus.findFirst({
      where: { name: 'RESOLVED' },
      select: { id: true },
    });

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // When a specific status filter is set, "open" counts should reflect that filter
    // (i.e. drop the openStatusIds constraint since the caller already asked for a status).
    const openStatusConstraint = statusRow ? {} : { statusId: { in: openStatusIds } };
    const resolved24hConstraint = statusRow
      ? {}
      : resolvedStatus
        ? { statusId: resolvedStatus.id }
        : null;

    // Run all aggregation queries in parallel
    const [
      totalOpen,
      resolvedIn24h,
      totalSlaTracked,
      slaCompliant,
      activeEscalated,
      avgResolutionResult,
      totalTickets,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByChannel,
    ] = await Promise.all([
      // Total open tickets
      this.prisma.ticket.count({
        where: {
          ...ticketBaseFilter,
          ...openStatusConstraint,
        },
      }),

      // Resolved in last 24 hours
      resolved24hConstraint
        ? this.prisma.ticket.count({
            where: {
              ...ticketBaseFilter,
              ...resolved24hConstraint,
              resolvedAt: { gte: twentyFourHoursAgo },
            },
          })
        : 0,

      // Total SLA tracked (scoped to current ticket filter)
      this.prisma.slaTracking.count({
        where: {
          ticket: { ...ticketBaseFilter },
        },
      }),

      // SLA compliant (both response and resolution met)
      this.prisma.slaTracking.count({
        where: {
          ticket: { ...ticketBaseFilter },
          OR: [
            { responseMet: true, resolutionMet: true },
            { responseBreached: false, resolutionBreached: false },
          ],
        },
      }),

      // Active escalated tickets
      this.prisma.ticket.count({
        where: {
          ...ticketBaseFilter,
          isEscalated: true,
          ...openStatusConstraint,
        },
      }),

      // Average resolution time (for resolved tickets)
      this.prisma.ticket.findMany({
        where: {
          ...ticketBaseFilter,
          resolvedAt: { not: null },
        },
        select: { createdAt: true, resolvedAt: true },
        take: 10000, // Limit for performance
      }),

      // Total tickets matching the filter
      this.prisma.ticket.count({
        where: ticketBaseFilter,
      }),

      // Tickets grouped by status
      this.prisma.ticket.groupBy({
        by: ['statusId'],
        where: ticketBaseFilter,
        _count: { _all: true },
      }),

      // Tickets grouped by priority
      this.prisma.ticket.groupBy({
        by: ['priorityId'],
        where: ticketBaseFilter,
        _count: { _all: true },
      }),

      // Tickets grouped by channel
      this.prisma.ticket.groupBy({
        by: ['channel'],
        where: ticketBaseFilter,
        _count: { _all: true },
      }),
    ]);

    // Calculate average resolution time in minutes
    let avgResolutionMinutes: number | null = null;
    if (avgResolutionResult.length > 0) {
      const totalMinutes = avgResolutionResult.reduce((sum, t) => {
        if (t.resolvedAt) {
          const diff =
            (t.resolvedAt.getTime() - t.createdAt.getTime()) / (1000 * 60);
          return sum + diff;
        }
        return sum;
      }, 0);
      avgResolutionMinutes = Math.round(
        (totalMinutes / avgResolutionResult.length) * 100,
      ) / 100;
    }

    const slaCompliancePercentage =
      totalSlaTracked > 0
        ? Math.round((slaCompliant / totalSlaTracked) * 10000) / 100
        : null;

    // Resolve status names for the breakdown
    const statusIds = ticketsByStatus.map((s) => s.statusId);
    const statuses = await this.prisma.ticketStatus.findMany({
      where: { id: { in: statusIds } },
      select: { id: true, name: true },
    });
    const statusMap = new Map(statuses.map((s) => [s.id, s.name]));

    // Resolve priority names
    const priorityIds = ticketsByPriority
      .map((p) => p.priorityId)
      .filter(Boolean) as string[];
    const priorities = await this.prisma.ticketPriorityLevel.findMany({
      where: { id: { in: priorityIds } },
      select: { id: true, name: true },
    });
    const priorityMap = new Map(priorities.map((p) => [p.id, p.name]));

    return {
      overview: {
        totalOpenTickets: totalOpen,
        resolvedInLast24Hours: resolvedIn24h,
        slaCompliancePercentage,
        activeIncidents: activeEscalated,
        avgResolutionMinutes,
        totalTickets,
      },
      breakdowns: {
        byStatus: ticketsByStatus.map((s) => ({
          status: statusMap.get(s.statusId) || s.statusId,
          count: s._count._all,
        })),
        byPriority: ticketsByPriority.map((p) => ({
          priority: p.priorityId
            ? priorityMap.get(p.priorityId) || p.priorityId
            : 'UNASSIGNED',
          count: p._count._all,
        })),
        byChannel: ticketsByChannel.map((c) => ({
          channel: c.channel,
          count: c._count._all,
        })),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── SLA REPORT ──────────────────────────────────────────────────────────────

  async getSlaReport(query: QuerySlaReportDto) {
    const where: any = {};
    if (query.agencyId) where.agencyId = query.agencyId;

    if (query.startDate || query.endDate) {
      where.dateBucket = {};
      if (query.startDate)
        where.dateBucket.gte = new Date(query.startDate);
      if (query.endDate) where.dateBucket.lte = new Date(query.endDate);
    }

    const slaMetrics = await this.prisma.slaPerformanceMetric.findMany({
      where,
      include: {
        agency: { select: { id: true, agencyName: true } },
      },
      orderBy: { dateBucket: 'desc' },
    });

    // Compute aggregates
    const totals = slaMetrics.reduce(
      (acc, m) => {
        acc.totalSlaTracked += m.totalSlaTracked || 0;
        acc.responseMet += m.responseMet || 0;
        acc.responseBreached += m.responseBreached || 0;
        acc.resolutionMet += m.resolutionMet || 0;
        acc.resolutionBreached += m.resolutionBreached || 0;
        return acc;
      },
      {
        totalSlaTracked: 0,
        responseMet: 0,
        responseBreached: 0,
        resolutionMet: 0,
        resolutionBreached: 0,
      },
    );

    const responseComplianceRate =
      totals.totalSlaTracked > 0
        ? Math.round(
            (totals.responseMet / totals.totalSlaTracked) * 10000,
          ) / 100
        : null;

    const resolutionComplianceRate =
      totals.totalSlaTracked > 0
        ? Math.round(
            (totals.resolutionMet / totals.totalSlaTracked) * 10000,
          ) / 100
        : null;

    return {
      summary: {
        ...totals,
        responseComplianceRate,
        resolutionComplianceRate,
      },
      dailyBreakdown: slaMetrics.map((m) => ({
        id: Number(m.id),
        agencyId: m.agencyId,
        agencyName: m.agency?.agencyName,
        dateBucket: m.dateBucket,
        totalSlaTracked: m.totalSlaTracked,
        responseMet: m.responseMet,
        responseBreached: m.responseBreached,
        resolutionMet: m.resolutionMet,
        resolutionBreached: m.resolutionBreached,
        avgBreachDurationMinutes: m.avgBreachDurationMinutes
          ? Number(m.avgBreachDurationMinutes)
          : null,
      })),
    };
  }

  // ─── AGENCY PERFORMANCE ──────────────────────────────────────────────────────

  async getAgencyPerformance(query: QueryAgencyPerformanceDto) {
    // ── Live per-agency aggregation ───────────────────────────────────────
    // The AgencyPerformanceMetric rollup table is populated by a scheduled
    // job that may not have run on this environment. To keep the dashboard
    // useful regardless of rollup state, compute stats directly from tickets.

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query.startDate) dateFilter.gte = new Date(query.startDate);
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    const ticketDateFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    const ticketWhere: any = {
      isDeleted: false,
      agencyId: query.agencyId ? query.agencyId : { not: null },
      ...ticketDateFilter,
    };

    const [resolvedStatuses, openStatuses] = await Promise.all([
      this.prisma.ticketStatus.findMany({
        where: { name: { in: ['RESOLVED', 'CLOSED'] } },
        select: { id: true },
      }),
      this.prisma.ticketStatus.findMany({
        where: { isClosedStatus: false },
        select: { id: true },
      }),
    ]);
    const resolvedStatusIds = resolvedStatuses.map((s) => s.id);
    const openStatusIds = openStatuses.map((s) => s.id);

    const [totalByAgency, resolvedByAgency, slaRows] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['agencyId'],
        where: ticketWhere,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['agencyId'],
        where: { ...ticketWhere, statusId: { in: resolvedStatusIds } },
        _count: { _all: true },
      }),
      this.prisma.slaTracking.findMany({
        where: { ticket: ticketWhere },
        select: {
          responseBreached: true,
          resolutionBreached: true,
          ticket: { select: { agencyId: true } },
        },
        take: 100_000,
      }),
    ]);

    const slaTotalMap = new Map<string, number>();
    const slaCompliantMap = new Map<string, number>();
    for (const row of slaRows) {
      const aid = row.ticket?.agencyId;
      if (!aid) continue;
      slaTotalMap.set(aid, (slaTotalMap.get(aid) ?? 0) + 1);
      if (!row.responseBreached && !row.resolutionBreached) {
        slaCompliantMap.set(aid, (slaCompliantMap.get(aid) ?? 0) + 1);
      }
    }

    const agencyIds = totalByAgency.map((r) => r.agencyId).filter(Boolean) as string[];
    const agencies = agencyIds.length
      ? await this.prisma.agency.findMany({
          where: { id: { in: agencyIds } },
          select: { id: true, agencyName: true, agencyCode: true },
        })
      : [];
    const agencyMap = new Map(agencies.map((a) => [a.id, a]));

    // Avg resolution time per agency. Computed in JS from a single ticket scan,
    // capped to keep memory bounded.
    const resolvedTickets = await this.prisma.ticket.findMany({
      where: {
        ...ticketWhere,
        statusId: { in: resolvedStatusIds },
        resolvedAt: { not: null },
      },
      select: { agencyId: true, createdAt: true, resolvedAt: true },
      take: 50_000,
    });
    const resolutionAgg = new Map<string, { total: number; count: number }>();
    for (const t of resolvedTickets) {
      if (!t.agencyId || !t.resolvedAt) continue;
      const minutes = (t.resolvedAt.getTime() - t.createdAt.getTime()) / 60_000;
      const acc = resolutionAgg.get(t.agencyId) ?? { total: 0, count: 0 };
      acc.total += minutes;
      acc.count += 1;
      resolutionAgg.set(t.agencyId, acc);
    }

    const resolvedMap = new Map(resolvedByAgency.map((r) => [r.agencyId, r._count._all]));

    const live = totalByAgency
      .filter((row) => row.agencyId)
      .map((row) => {
        const agencyId = row.agencyId as string;
        const total = row._count._all;
        const resolved = resolvedMap.get(agencyId) ?? 0;
        const slaTotal = slaTotalMap.get(agencyId) ?? 0;
        const slaCompliant = slaCompliantMap.get(agencyId) ?? 0;
        const res = resolutionAgg.get(agencyId);
        const agency = agencyMap.get(agencyId);
        return {
          agencyId,
          agencyName: agency?.agencyName ?? 'Unknown agency',
          agencyCode: agency?.agencyCode ?? null,
          totalTickets: total,
          resolvedTickets: resolved,
          openTickets: Math.max(0, total - resolved),
          avgResolutionMinutes: res && res.count > 0 ? Math.round((res.total / res.count) * 100) / 100 : null,
          slaComplianceRate: slaTotal > 0 ? Math.round((slaCompliant / slaTotal) * 10000) / 100 : null,
        };
      })
      .sort((a, b) => b.totalTickets - a.totalTickets);

    const limit = query.limit && query.limit > 0 ? query.limit : 50;
    const performanceMetrics = live.slice(0, limit);

    // Optional historical metrics (kept for callers that ask by date range)
    const where: any = {};
    if (query.agencyId) where.agencyId = query.agencyId;
    if (query.startDate || query.endDate) {
      if (query.startDate) where.reportingPeriodStart = { gte: new Date(query.startDate) };
      if (query.endDate) where.reportingPeriodEnd = { lte: new Date(query.endDate) };
    }
    const metrics = await this.prisma.agencyPerformanceMetric.findMany({
      where,
      include: {
        agency: { select: { id: true, agencyName: true, agencyCode: true } },
      },
      orderBy: { reportingPeriodEnd: 'desc' },
    });

    // If specific agency, also get live stats
    let liveStats: any = null;
    if (query.agencyId) {
      const openStatuses = await this.prisma.ticketStatus.findMany({
        where: { isClosedStatus: false },
        select: { id: true },
      });
      const openStatusIds = openStatuses.map((s) => s.id);

      const [
        openCount,
        resolvedCount,
        escalatedCount,
        totalCount,
      ] = await Promise.all([
        this.prisma.ticket.count({
          where: {
            agencyId: query.agencyId,
            statusId: { in: openStatusIds },
            isDeleted: false,
          },
        }),
        this.prisma.ticket.count({
          where: {
            agencyId: query.agencyId,
            resolvedAt: { not: null },
            isDeleted: false,
          },
        }),
        this.prisma.ticket.count({
          where: {
            agencyId: query.agencyId,
            isEscalated: true,
            isDeleted: false,
          },
        }),
        this.prisma.ticket.count({
          where: {
            agencyId: query.agencyId,
            isDeleted: false,
          },
        }),
      ]);

      liveStats = {
        currentOpenTickets: openCount,
        totalResolved: resolvedCount,
        totalEscalated: escalatedCount,
        totalTicketsAllTime: totalCount,
        resolutionRate:
          totalCount > 0
            ? Math.round((resolvedCount / totalCount) * 10000) / 100
            : 0,
      };
    }

    return {
      performanceMetrics,
      historicalMetrics: metrics.map((m) => ({
        id: Number(m.id),
        agency: m.agency,
        reportingPeriodStart: m.reportingPeriodStart,
        reportingPeriodEnd: m.reportingPeriodEnd,
        totalTickets: m.totalTickets,
        avgResponseTime: m.avgResponseTime ? Number(m.avgResponseTime) : null,
        avgResolutionTime: m.avgResolutionTime ? Number(m.avgResolutionTime) : null,
        slaCompliancePercentage: m.slaCompliancePercentage ? Number(m.slaCompliancePercentage) : null,
        escalationRatePercentage: m.escalationRatePercentage ? Number(m.escalationRatePercentage) : null,
        citizenSatisfactionScore: m.citizenSatisfactionScore ? Number(m.citizenSatisfactionScore) : null,
      })),
      liveStats,
    };
  }

  // ─── INCOMING THREADS (Pesaflow-format ticket export) ─────────────────────

  async getIncomingThreads(query: QueryIncomingThreadsDto) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query.startDate) dateFilter.gte = new Date(query.startDate);
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const where: any = { isDeleted: false };
    if (query.agencyId) where.agencyId = query.agencyId;
    if (Object.keys(dateFilter).length) where.createdAt = dateFilter;

    if (query.status) {
      const statusRow = await this.prisma.ticketStatus.findFirst({
        where: { name: query.status.toUpperCase() as TicketStatusName },
        select: { id: true },
      });
      if (statusRow) where.statusId = statusRow.id;
    }

    if (query.channel) {
      where.channel = query.channel.toUpperCase();
    }

    if (query.search) {
      where.OR = [
        { ticketNumber: { contains: query.search, mode: 'insensitive' } },
        { subject: { contains: query.search, mode: 'insensitive' } },
        { creator: {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        } },
      ];
    }

    const limit = query.limit && query.limit > 0 ? query.limit : 200;
    const offset = query.offset && query.offset > 0 ? query.offset : 0;

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          creator: { select: { firstName: true, lastName: true, email: true } },
          assignee: { select: { firstName: true, lastName: true, email: true } },
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
        skip: offset,
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    const fullName = (u?: { firstName?: string | null; lastName?: string | null } | null) => {
      if (!u) return '';
      const fn = u.firstName ?? '';
      const ln = u.lastName ?? '';
      return `${fn} ${ln}`.trim();
    };
    const initials = (u?: { firstName?: string | null; lastName?: string | null } | null) => {
      if (!u) return '-';
      const fi = (u.firstName ?? '').charAt(0).toUpperCase();
      const li = (u.lastName ?? '').charAt(0).toUpperCase();
      const out = [fi, li].filter(Boolean).join(' ');
      return out || '-';
    };
    const formatDuration = (ms: number): string => {
      if (!Number.isFinite(ms) || ms <= 0) return '-';
      const totalSec = Math.floor(ms / 1000);
      const days = Math.floor(totalSec / 86_400);
      const hours = Math.floor((totalSec % 86_400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      const seconds = totalSec % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    const now = Date.now();
    const rows = tickets.map((t) => {
      const isViolated = !!(t.slaTracking?.responseBreached || t.slaTracking?.resolutionBreached);
      const breachRefMs = t.slaTracking?.resolutionDueAt?.getTime() ?? null;
      const agentResponseMs = t.firstResponseAt
        ? t.firstResponseAt.getTime() - t.createdAt.getTime()
        : null;
      const systemResponseMs = t.slaTracking?.responseDueAt
        ? t.slaTracking.responseDueAt.getTime() - t.createdAt.getTime()
        : null;

      const creatorName = fullName(t.creator) || 'Citizen';
      const fromField = t.creator?.email
        ? `"${creatorName}"<${t.creator.email}>`
        : creatorName;

      return {
        ticketId: t.ticketNumber,
        subject: t.subject,
        ticketOwner: initials(t.assignee),
        contactName: creatorName,
        eventOwner: fullName(t.assignee) || 'Unassigned',
        from: fromField,
        receivedTime: t.createdAt,
        responseStatus: t.firstResponseAt ? 'Responded' : 'Pending',
        respondedBy: t.firstResponseAt ? initials(t.assignee) : '-',
        agentRespondedTime: t.firstResponseAt,
        agentResponseTime: agentResponseMs != null ? formatDuration(agentResponseMs) : '-',
        systemResponseTime: systemResponseMs != null ? formatDuration(systemResponseMs) : '-',
        isViolated,
        violatedTime: isViolated && breachRefMs ? new Date(breachRefMs).toISOString() : '-',
        ownerDuringViolation: isViolated ? (fullName(t.assignee) || 'Unassigned') : '-',
        breachTime: isViolated && breachRefMs ? formatDuration(now - breachRefMs) : '-',
        status: t.status?.name ?? '-',
        channel: t.channel,
      };
    });

    return {
      rows,
      pagination: { total, limit, offset, returned: rows.length },
      columns: [
        'TICKET ID', 'SUBJECT', 'TICKET OWNER', 'CONTACT NAME', 'EVENT OWNER',
        'FROM', 'RECEIVED TIME', 'RESPONSE STATUS', 'RESPONDED BY',
        'AGENT RESPONDED TIME', 'AGENT RESPONSE TIME', 'SYSTEM RESPONSE TIME',
        'IS_VIOLATED', 'VIOLATED TIME', 'OWNER DURING VIOLATION',
        'BREACH TIME', 'STATUS', 'CHANNEL',
      ],
    };
  }

  // ─── TICKET METRICS HOURLY ─────────────────────────────────────────────────

  async getTicketMetricsHourly(query: QueryTicketMetricsHourlyDto) {
    const where: any = {};
    if (query.agencyId) where.agencyId = query.agencyId;

    if (query.startDate || query.endDate) {
      where.hourBucket = {};
      if (query.startDate)
        where.hourBucket.gte = new Date(query.startDate);
      if (query.endDate) where.hourBucket.lte = new Date(query.endDate);
    }

    const page = query.page || 1;
    const limit = query.limit || 24;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.ticketMetricHourly.findMany({
        where,
        include: {
          agency: { select: { id: true, agencyName: true } },
        },
        orderBy: { hourBucket: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ticketMetricHourly.count({ where }),
    ]);

    return {
      data: data.map((m) => ({
        id: Number(m.id),
        agencyId: m.agencyId,
        agencyName: m.agency?.agencyName,
        hourBucket: m.hourBucket,
        ticketsCreated: m.ticketsCreated,
        ticketsResolved: m.ticketsResolved,
        ticketsClosed: m.ticketsClosed,
        ticketsEscalated: m.ticketsEscalated,
        ticketsReopened: m.ticketsReopened,
        avgFirstResponseMinutes: m.avgFirstResponseMinutes
          ? Number(m.avgFirstResponseMinutes)
          : null,
        avgResolutionMinutes: m.avgResolutionMinutes
          ? Number(m.avgResolutionMinutes)
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── TICKET METRICS DAILY ─────────────────────────────────────────────────

  async getTicketMetricsDaily(query: QueryTicketMetricsDailyDto) {
    const where: any = {};
    if (query.agencyId) where.agencyId = query.agencyId;

    if (query.startDate || query.endDate) {
      where.dateBucket = {};
      if (query.startDate)
        where.dateBucket.gte = new Date(query.startDate);
      if (query.endDate) where.dateBucket.lte = new Date(query.endDate);
    }

    const page = query.page || 1;
    const limit = query.limit || 30;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.ticketMetricDaily.findMany({
        where,
        include: {
          agency: { select: { id: true, agencyName: true } },
        },
        orderBy: { dateBucket: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ticketMetricDaily.count({ where }),
    ]);

    return {
      data: data.map((m) => ({
        id: Number(m.id),
        agencyId: m.agencyId,
        agencyName: m.agency?.agencyName,
        dateBucket: m.dateBucket,
        ticketsCreated: m.ticketsCreated,
        ticketsResolved: m.ticketsResolved,
        ticketsClosed: m.ticketsClosed,
        openTickets: m.openTickets,
        escalatedTickets: m.escalatedTickets,
        breachedResponse: m.breachedResponse,
        breachedResolution: m.breachedResolution,
        avgFirstResponseMinutes: m.avgFirstResponseMinutes
          ? Number(m.avgFirstResponseMinutes)
          : null,
        avgResolutionMinutes: m.avgResolutionMinutes
          ? Number(m.avgResolutionMinutes)
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── USER PERFORMANCE ──────────────────────────────────────────────────────

  async getUserPerformance(query: QueryUserPerformanceDto) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        userType: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User "${query.userId}" not found`);
    }

    const where: any = { userId: query.userId };
    if (query.startDate || query.endDate) {
      where.dateBucket = {};
      if (query.startDate)
        where.dateBucket.gte = new Date(query.startDate);
      if (query.endDate) where.dateBucket.lte = new Date(query.endDate);
    }

    // Get stored metrics
    const dailyMetrics = await this.prisma.userActivityMetric.findMany({
      where,
      orderBy: { dateBucket: 'desc' },
    });

    // Also compute live stats from tickets
    const [
      assignedCount,
      resolvedCount,
      escalationsHandled,
    ] = await Promise.all([
      this.prisma.ticket.count({
        where: { currentAssigneeId: query.userId, isDeleted: false },
      }),
      this.prisma.ticket.count({
        where: {
          currentAssigneeId: query.userId,
          resolvedAt: { not: null },
          isDeleted: false,
        },
      }),
      this.prisma.escalationEvent.count({
        where: { escalatedToUserId: query.userId },
      }),
    ]);

    // Calculate totals from daily metrics
    const totals = dailyMetrics.reduce(
      (acc, m) => {
        acc.ticketsAssigned += m.ticketsAssigned;
        acc.ticketsResolved += m.ticketsResolved;
        acc.escalationsHandled += m.escalationsHandled;
        return acc;
      },
      { ticketsAssigned: 0, ticketsResolved: 0, escalationsHandled: 0 },
    );

    const avgResolutionTime = dailyMetrics.length > 0
      ? dailyMetrics.reduce((sum, m) => {
          return sum + (m.avgResolutionTimeMinutes ? Number(m.avgResolutionTimeMinutes) : 0);
        }, 0) / dailyMetrics.filter((m) => m.avgResolutionTimeMinutes !== null).length || null
      : null;

    return {
      user,
      summary: {
        totalAssigned: totals.ticketsAssigned || assignedCount,
        totalResolved: totals.ticketsResolved || resolvedCount,
        totalEscalationsHandled: totals.escalationsHandled || escalationsHandled,
        avgResolutionTimeMinutes: avgResolutionTime
          ? Math.round(avgResolutionTime * 100) / 100
          : null,
        resolutionRate:
          (totals.ticketsAssigned || assignedCount) > 0
            ? Math.round(
                ((totals.ticketsResolved || resolvedCount) /
                  (totals.ticketsAssigned || assignedCount)) *
                  10000,
              ) / 100
            : 0,
      },
      liveStats: {
        currentlyAssigned: assignedCount,
        totalResolved: resolvedCount,
        escalationsHandled,
      },
      dailyBreakdown: dailyMetrics.map((m) => ({
        id: Number(m.id),
        dateBucket: m.dateBucket,
        ticketsAssigned: m.ticketsAssigned,
        ticketsResolved: m.ticketsResolved,
        avgResolutionTimeMinutes: m.avgResolutionTimeMinutes
          ? Number(m.avgResolutionTimeMinutes)
          : null,
        escalationsHandled: m.escalationsHandled,
      })),
    };
  }

  // ─── EXPORT ────────────────────────────────────────────────────────────────

  async createExport(dto: CreateExportRequestDto) {
    const format = dto.format || ExportFormat.CSV;

    // Gather the data based on report type
    let reportData: any;
    let reportTitle: string;

    switch (dto.reportType) {
      case 'DASHBOARD':
        reportData = await this.getDashboardMetrics({
          agencyId: dto.agencyId,
        });
        reportTitle = 'Dashboard Metrics';
        break;

      case 'SLA':
        reportData = await this.getSlaReport({
          agencyId: dto.agencyId,
          startDate: dto.startDate,
          endDate: dto.endDate,
        });
        reportTitle = 'SLA Performance Report';
        break;

      case 'AGENCY_PERFORMANCE':
        reportData = await this.getAgencyPerformance({
          agencyId: dto.agencyId,
          startDate: dto.startDate,
          endDate: dto.endDate,
        });
        reportTitle = 'Agency Performance Report';
        break;

      case 'TICKET_METRICS':
        reportData = await this.getTicketMetricsDaily({
          agencyId: dto.agencyId,
          startDate: dto.startDate,
          endDate: dto.endDate,
        });
        reportTitle = 'Ticket Metrics Report';
        break;

      case 'USER_PERFORMANCE':
        if (!dto.userId) {
          throw new NotFoundException('userId is required for user performance export');
        }
        reportData = await this.getUserPerformance({
          userId: dto.userId,
          startDate: dto.startDate,
          endDate: dto.endDate,
        });
        reportTitle = 'User Performance Report';
        break;

      default:
        throw new NotFoundException(`Unknown report type: ${dto.reportType}`);
    }

    // For CSV format, convert data to CSV string
    let exportContent: string;
    if (format === ExportFormat.CSV) {
      exportContent = this.convertToCSV(reportData);
    } else {
      exportContent = JSON.stringify(reportData, null, 2);
    }

    // Store as a dashboard snapshot for record
    const snapshot = await this.prisma.dashboardSnapshot.create({
      data: {
        agencyId: dto.agencyId,
        snapshotType: `export_${dto.reportType.toLowerCase()}`,
        snapshotPayload: {
          reportTitle,
          format,
          requestedBy: dto.requestedBy,
          requestedAt: new Date().toISOString(),
          recordCount: Array.isArray(reportData?.data)
            ? reportData.data.length
            : 1,
        },
      },
    });

    return {
      exportId: snapshot.id,
      reportTitle,
      format,
      generatedAt: new Date().toISOString(),
      recordCount: Array.isArray(reportData?.data)
        ? reportData.data.length
        : 1,
      data: reportData,
      csv: format === ExportFormat.CSV ? exportContent : undefined,
    };
  }

  private convertToCSV(data: any): string {
    // Handle different data structures
    let rows: Record<string, any>[];

    if (Array.isArray(data)) {
      rows = data;
    } else if (data?.data && Array.isArray(data.data)) {
      rows = data.data;
    } else if (data?.dailyBreakdown && Array.isArray(data.dailyBreakdown)) {
      rows = data.dailyBreakdown;
    } else if (data?.performanceMetrics && Array.isArray(data.performanceMetrics)) {
      rows = data.performanceMetrics;
    } else {
      // For single object data, wrap in array
      rows = [data];
    }

    if (rows.length === 0) return '';

    // Extract headers from first row, flattening nested objects
    const flattenObject = (
      obj: any,
      prefix = '',
    ): Record<string, any> => {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}_${key}` : key;
        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          !(value instanceof Date)
        ) {
          Object.assign(result, flattenObject(value, newKey));
        } else {
          result[newKey] = value;
        }
      }
      return result;
    };

    const flatRows = rows.map((row) => flattenObject(row));
    const headers = [...new Set(flatRows.flatMap((r) => Object.keys(r)))];

    const csvLines = [
      headers.join(','),
      ...flatRows.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            const str = String(val);
            // Escape commas and quotes in CSV
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(','),
      ),
    ];

    return csvLines.join('\n');
  }

  // ─── SNAPSHOTS ─────────────────────────────────────────────────────────────

  async getSnapshots(query: QuerySnapshotsDto) {
    const where: any = {};
    if (query.agencyId) where.agencyId = query.agencyId;
    if (query.snapshotType) where.snapshotType = query.snapshotType;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.dashboardSnapshot.findMany({
        where,
        include: {
          agency: { select: { id: true, agencyName: true } },
        },
        orderBy: { generatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dashboardSnapshot.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
