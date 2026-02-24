import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  CreateAuditLogDto,
  QueryAuditLogsDto,
  CreateUserActivityLogDto,
  QueryUserActivityDto,
  CreateDataAccessLogDto,
  QueryDataAccessDto,
  ExportAuditLogsDto,
} from './dto/audit.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

  async createAuditLog(dto: CreateAuditLogDto) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          actionType: dto.actionType,
          oldValue: dto.oldValue || undefined,
          newValue: dto.newValue || undefined,
          performedBy: dto.performedBy,
          performedByRole: dto.performedByRole,
          ipAddress: dto.ipAddress,
        },
        include: {
          performer: {
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
    } catch (error) {
      // Audit logging should never break the calling operation
      this.logger.error(
        `Failed to create audit log: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async getAuditLogs(query: QueryAuditLogsDto) {
    const where: any = {};

    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actionType) where.actionType = query.actionType;
    if (query.performedBy) where.performedBy = query.performedBy;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate)
        where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          performer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              userType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: data.map((log) => ({
        ...log,
        id: Number(log.id), // Convert BigInt for JSON serialization
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAuditLogById(id: number) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id: BigInt(id) },
      include: {
        performer: {
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

    if (!log) {
      throw new NotFoundException(`Audit log with ID "${id}" not found`);
    }

    return {
      ...log,
      id: Number(log.id),
    };
  }

  // ─── USER ACTIVITY LOGS ───────────────────────────────────────────────────

  async logUserActivity(dto: CreateUserActivityLogDto) {
    try {
      return await this.prisma.userActivityLog.create({
        data: {
          userId: dto.userId,
          agencyId: dto.agencyId,
          activityType: dto.activityType,
          ticketId: dto.ticketId,
          description: dto.description,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          agency: {
            select: { id: true, agencyName: true },
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to log user activity: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async getUserActivity(query: QueryUserActivityDto) {
    const where: any = { userId: query.userId };

    if (query.activityType) where.activityType = query.activityType;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate)
        where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.userActivityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          agency: {
            select: { id: true, agencyName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userActivityLog.count({ where }),
    ]);

    // Build activity summary
    const activitySummary = await this.prisma.userActivityLog.groupBy({
      by: ['activityType'],
      where: { userId: query.userId },
      _count: { _all: true },
      orderBy: { _count: { activityType: 'desc' } },
    });

    return {
      data: data.map((log) => ({
        ...log,
        id: Number(log.id),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: activitySummary.map((s) => ({
        activityType: s.activityType,
        count: s._count._all,
      })),
    };
  }

  // ─── DATA ACCESS LOGS ─────────────────────────────────────────────────────

  async logDataAccess(dto: CreateDataAccessLogDto) {
    try {
      return await this.prisma.dataAccessLog.create({
        data: {
          userId: dto.userId,
          agencyId: dto.agencyId,
          entityType: dto.entityType,
          entityId: dto.entityId,
          fieldAccessed: dto.fieldAccessed,
          accessType: dto.accessType as any,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          agency: {
            select: { id: true, agencyName: true },
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to log data access: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async getDataAccessLogs(query: QueryDataAccessDto) {
    const where: any = { userId: query.userId };

    if (query.entityType) where.entityType = query.entityType;
    if (query.accessType) where.accessType = query.accessType;

    if (query.startDate || query.endDate) {
      where.accessedAt = {};
      if (query.startDate)
        where.accessedAt.gte = new Date(query.startDate);
      if (query.endDate) where.accessedAt.lte = new Date(query.endDate);
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.dataAccessLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          agency: {
            select: { id: true, agencyName: true },
          },
        },
        orderBy: { accessedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dataAccessLog.count({ where }),
    ]);

    // Build access summary
    const accessSummary = await this.prisma.dataAccessLog.groupBy({
      by: ['accessType'],
      where: { userId: query.userId },
      _count: { _all: true },
    });

    const entitySummary = await this.prisma.dataAccessLog.groupBy({
      by: ['entityType'],
      where: { userId: query.userId },
      _count: { _all: true },
      orderBy: { _count: { entityType: 'desc' } },
    });

    return {
      data: data.map((log) => ({
        ...log,
        id: Number(log.id),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        byAccessType: accessSummary.map((s) => ({
          accessType: s.accessType,
          count: s._count._all,
        })),
        byEntityType: entitySummary.map((s) => ({
          entityType: s.entityType,
          count: s._count._all,
        })),
      },
    };
  }

  // ─── EXPORT ────────────────────────────────────────────────────────────────

  async exportAuditLogs(query: ExportAuditLogsDto) {
    const where: any = {};

    if (query.entityType) where.entityType = query.entityType;
    if (query.performedBy) where.performedBy = query.performedBy;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate)
        where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        performer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000, // Cap export at 10k records
    });

    return {
      exportedAt: new Date().toISOString(),
      totalRecords: logs.length,
      data: logs.map((log) => ({
        id: Number(log.id),
        entityType: log.entityType,
        entityId: log.entityId,
        actionType: log.actionType,
        oldValue: log.oldValue,
        newValue: log.newValue,
        performedBy: log.performer
          ? `${log.performer.firstName} ${log.performer.lastName} (${log.performer.email})`
          : null,
        performedByRole: log.performedByRole,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
    };
  }
}
