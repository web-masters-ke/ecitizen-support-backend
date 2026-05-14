import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  CreateAgencyDto,
  UpdateAgencyDto,
  AgencyFilterDto,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateAgencyContactDto,
  SetBusinessHoursDto,
  UpsertAgencySettingDto,
  CreateServiceProviderDto,
  MapServiceProviderDto,
  ServiceProviderFilterDto,
  OnboardAgencyDto,
} from './dto/agencies.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AgenciesService {
  private readonly logger = new Logger(AgenciesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  //  AGENCIES CRUD
  // ============================================================

  async create(dto: CreateAgencyDto, performedBy?: string) {
    // Ensure unique agency code
    const existing = await this.prisma.agency.findUnique({
      where: { agencyCode: dto.agencyCode },
    });
    if (existing) {
      throw new ConflictException(
        `Agency with code "${dto.agencyCode}" already exists`,
      );
    }

    // If parentAgencyId is provided, verify it exists
    if (dto.parentAgencyId) {
      const parent = await this.prisma.agency.findUnique({
        where: { id: dto.parentAgencyId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent agency with ID ${dto.parentAgencyId} not found`,
        );
      }
    }

    const agency = await this.prisma.agency.create({
      data: {
        agencyCode: dto.agencyCode,
        agencyName: dto.agencyName,
        agencyType: dto.agencyType,
        parentAgencyId: dto.parentAgencyId,
        registrationNumber: dto.registrationNumber,
        officialEmail: dto.officialEmail,
        officialPhone: dto.officialPhone,
        physicalAddress: dto.physicalAddress,
        county: dto.county,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        parentAgency: {
          select: { id: true, agencyName: true, agencyCode: true },
        },
        childAgencies: {
          select: { id: true, agencyName: true, agencyCode: true },
        },
      },
    });

    this.logger.log(`Agency created: ${agency.id} (${agency.agencyCode})`);

    await this.prisma.auditLog
      .create({
        data: {
          entityType: 'AGENCY',
          entityId: agency.id,
          actionType: 'CREATE',
          performedBy,
          newValue: {
            agencyCode: agency.agencyCode,
            agencyName: agency.agencyName,
            agencyType: agency.agencyType,
            parentAgencyId: agency.parentAgencyId ?? null,
          } as any,
        },
      })
      .catch((err) => this.logger.warn(`Agency CREATE audit failed: ${err?.message}`));

    return agency;
  }

  // Hero stats for the public admin homepage. Counties = distinct non-empty
  // county values across active agencies (capped at Kenya's 47). Agencies =
  // active agency count. Cached implicitly via Next.js fetch — backend just
  // returns the live numbers.
  async getPublicStats() {
    const [agencies, counties] = await Promise.all([
      this.prisma.agency.count({ where: { isActive: true } }),
      this.prisma.agency.findMany({
        where: { isActive: true, county: { not: null } },
        select: { county: true },
        distinct: ['county'],
      }),
    ]);
    const countyCount = counties.filter((c) => (c.county ?? '').trim().length > 0).length;
    return {
      counties: Math.min(countyCount, 47),
      agencies,
    };
  }

  async findAll(filters: AgencyFilterDto): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      agencyType,
      isActive,
      onboardingStatus,
      county,
      search,
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (agencyType) where.agencyType = agencyType;
    if (isActive !== undefined) where.isActive = isActive;
    if (onboardingStatus) where.onboardingStatus = onboardingStatus;
    if (county) where.county = { equals: county, mode: 'insensitive' };

    if (search) {
      where.OR = [
        { agencyName: { contains: search, mode: 'insensitive' } },
        { agencyCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'agencyName',
      'agencyCode',
      'agencyType',
      'onboardingStatus',
    ];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [agencies, total] = await Promise.all([
      this.prisma.agency.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderField]: sortOrder },
        include: {
          parentAgency: {
            select: { id: true, agencyName: true, agencyCode: true },
          },
          _count: {
            select: {
              departments: true,
              agencyUsers: true,
              tickets: true,
            },
          },
        },
      }),
      this.prisma.agency.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: agencies,
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

  async findOne(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id },
      include: {
        parentAgency: {
          select: { id: true, agencyName: true, agencyCode: true },
        },
        childAgencies: {
          select: { id: true, agencyName: true, agencyCode: true, agencyType: true, isActive: true },
        },
        departments: {
          orderBy: { departmentName: 'asc' },
        },
        agencyContacts: {
          orderBy: { escalationLevel: 'asc' },
        },
        agencySettings: true,
        businessHours: {
          orderBy: { dayOfWeek: 'asc' },
        },
        agencyServiceMaps: {
          include: {
            serviceProvider: true,
          },
        },
        _count: {
          select: {
            agencyUsers: true,
            tickets: true,
            slaPolicies: true,
          },
        },
      },
    });

    if (!agency) {
      throw new NotFoundException(`Agency with ID ${id} not found`);
    }

    return agency;
  }

  async update(id: string, dto: UpdateAgencyDto, performedBy?: string) {
    await this.ensureAgencyExists(id);

    // If agency code is being updated, check for conflicts
    if (dto.agencyCode) {
      const conflict = await this.prisma.agency.findFirst({
        where: {
          agencyCode: dto.agencyCode,
          id: { not: id },
        },
      });
      if (conflict) {
        throw new ConflictException(
          `Agency code "${dto.agencyCode}" is already in use`,
        );
      }
    }

    const agency = await this.prisma.agency.update({
      where: { id },
      data: {
        ...(dto.agencyCode && { agencyCode: dto.agencyCode }),
        ...(dto.agencyName && { agencyName: dto.agencyName }),
        ...(dto.agencyType && { agencyType: dto.agencyType }),
        ...(dto.parentAgencyId !== undefined && { parentAgencyId: dto.parentAgencyId }),
        ...(dto.registrationNumber !== undefined && { registrationNumber: dto.registrationNumber }),
        ...(dto.officialEmail !== undefined && { officialEmail: dto.officialEmail }),
        ...(dto.officialPhone !== undefined && { officialPhone: dto.officialPhone }),
        ...(dto.physicalAddress !== undefined && { physicalAddress: dto.physicalAddress }),
        ...(dto.county !== undefined && { county: dto.county }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.onboardingStatus && { onboardingStatus: dto.onboardingStatus }),
        ...(dto.ministryName !== undefined && { ministryName: dto.ministryName }),
        ...(dto.stateDepartment !== undefined && { stateDepartment: dto.stateDepartment }),
        ...(dto.executiveOrderRef !== undefined && { executiveOrderRef: dto.executiveOrderRef }),
        ...(dto.executiveOrderYear !== undefined && { executiveOrderYear: dto.executiveOrderYear }),
        ...(dto.primaryContactName !== undefined && { primaryContactName: dto.primaryContactName }),
        ...(dto.primaryContactPhone !== undefined && { primaryContactPhone: dto.primaryContactPhone }),
        ...(dto.coordinatorId !== undefined && { coordinatorId: dto.coordinatorId }),
        ...(dto.onboardingRemarks !== undefined && { onboardingRemarks: dto.onboardingRemarks }),
        ...(dto.servicesIdentified !== undefined && { servicesIdentified: dto.servicesIdentified }),
        ...(dto.servicesLive !== undefined && { servicesLive: dto.servicesLive }),
        ...(dto.slaDocumentUrl !== undefined && { slaDocumentUrl: dto.slaDocumentUrl }),
        ...(dto.slaDocumentName !== undefined && { slaDocumentName: dto.slaDocumentName }),
        ...(dto.slaSignedAt !== undefined && { slaSignedAt: dto.slaSignedAt ? new Date(dto.slaSignedAt) : null }),
      },
      include: {
        parentAgency: {
          select: { id: true, agencyName: true, agencyCode: true },
        },
        departments: true,
      },
    });

    this.logger.log(`Agency updated: ${agency.id}`);

    await this.prisma.auditLog
      .create({
        data: {
          entityType: 'AGENCY',
          entityId: agency.id,
          actionType: 'UPDATE',
          performedBy,
          newValue: dto as any,
        },
      })
      .catch((err) => this.logger.warn(`Agency UPDATE audit failed: ${err?.message}`));

    return agency;
  }

  // ============================================================
  //  DEPARTMENTS
  // ============================================================

  async addDepartment(agencyId: string, dto: CreateDepartmentDto) {
    await this.ensureAgencyExists(agencyId);

    // Check for duplicate department name within agency
    const existing = await this.prisma.department.findFirst({
      where: {
        agencyId,
        departmentName: dto.departmentName,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Department "${dto.departmentName}" already exists in this agency`,
      );
    }

    const department = await this.prisma.department.create({
      data: {
        agencyId,
        departmentName: dto.departmentName,
        departmentCode: dto.departmentCode,
        description: dto.description,
      },
    });

    this.logger.log(
      `Department created: ${department.id} in agency ${agencyId}`,
    );
    return department;
  }

  async updateDepartment(
    agencyId: string,
    departmentId: string,
    dto: UpdateDepartmentDto,
  ) {
    await this.ensureAgencyExists(agencyId);

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, agencyId },
    });
    if (!department) {
      throw new NotFoundException(
        `Department ${departmentId} not found in agency ${agencyId}`,
      );
    }

    // Check for name conflict if name is being updated
    if (dto.departmentName && dto.departmentName !== department.departmentName) {
      const conflict = await this.prisma.department.findFirst({
        where: {
          agencyId,
          departmentName: dto.departmentName,
          id: { not: departmentId },
        },
      });
      if (conflict) {
        throw new ConflictException(
          `Department "${dto.departmentName}" already exists in this agency`,
        );
      }
    }

    const updated = await this.prisma.department.update({
      where: { id: departmentId },
      data: {
        ...(dto.departmentName && { departmentName: dto.departmentName }),
        ...(dto.departmentCode !== undefined && { departmentCode: dto.departmentCode }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Department updated: ${departmentId}`);
    return updated;
  }

  async getDepartments(agencyId: string) {
    await this.ensureAgencyExists(agencyId);

    return this.prisma.department.findMany({
      where: { agencyId },
      orderBy: { departmentName: 'asc' },
    });
  }

  /**
   * Resolve all users in an agency (or a specific department within it).
   * Used by the chat module's "add by agency/department" group flow.
   */
  async getAgencyUsers(agencyId: string, departmentId?: string) {
    await this.ensureAgencyExists(agencyId);

    const links = await this.prisma.agencyUser.findMany({
      where: {
        agencyId,
        ...(departmentId ? { departmentId } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userType: true,
            phoneNumber: true,
          },
        },
        department: { select: { id: true, departmentName: true } },
      },
    });

    return links
      .filter((l) => (l as any).user)
      .map((l: any) => ({
        ...l.user,
        agencyId: l.agencyId,
        departmentId: l.departmentId,
        departmentName: l.department?.departmentName ?? null,
      }));
  }

  // ============================================================
  //  CONTACTS
  // ============================================================

  async addContact(agencyId: string, dto: CreateAgencyContactDto) {
    await this.ensureAgencyExists(agencyId);

    const contact = await this.prisma.agencyContact.create({
      data: {
        agencyId,
        contactName: dto.contactName,
        roleTitle: dto.roleTitle,
        email: dto.contactEmail || dto.email,
        phone: dto.contactPhone || dto.phone,
        escalationLevel: dto.escalationLevel,
        ...(dto.contactType && { contactType: dto.contactType }),
      },
    });

    this.logger.log(`Contact added to agency ${agencyId}: ${contact.id}`);
    return contact;
  }

  async getContacts(agencyId: string) {
    await this.ensureAgencyExists(agencyId);

    return this.prisma.agencyContact.findMany({
      where: { agencyId },
      orderBy: { escalationLevel: 'asc' },
    });
  }

  // ============================================================
  //  BUSINESS HOURS
  // ============================================================

  async getBusinessHours(agencyId: string) {
    await this.ensureAgencyExists(agencyId);

    return this.prisma.agencyBusinessHour.findMany({
      where: { agencyId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  /**
   * "Is this agency open RIGHT NOW?" — used by the citizen-facing call
   * button to know whether to enable. Returns:
   *   { open: true,  todayHours: { start, end } }
   *   { open: false, reason: "Closed for the day" | "Closed today", nextOpen?: ... }
   * If no business-hour rows exist for the agency we treat it as always
   * open (back-compat with agencies that haven't configured hours yet).
   */
  async getAgencyAvailability(agencyId: string) {
    await this.ensureAgencyExists(agencyId);
    const rows = await this.prisma.agencyBusinessHour.findMany({
      where: { agencyId, isActive: true },
    });
    if (rows.length === 0) {
      return { open: true, reason: 'No business hours configured — defaulting to open.' };
    }

    // Africa/Nairobi is the operational timezone for the SCC; we compute
    // "now in Nairobi" by formatting via Intl rather than relying on the
    // pod's TZ which is usually UTC in k8s.
    const now = new Date();
    const fmt = (opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', ...opts }).format(now);
    // weekday() — 0=Sunday … 6=Saturday to match the schema
    const weekdayName = fmt({ weekday: 'short' }); // Mon, Tue, ...
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const today = weekdayMap[weekdayName] ?? new Date().getDay();
    const hh = fmt({ hour: '2-digit', hour12: false });
    const mm = fmt({ minute: '2-digit' });
    const nowSeconds = parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60;

    const todayRow = rows.find((r) => r.dayOfWeek === today);
    if (!todayRow) {
      return { open: false, reason: 'Closed today.' };
    }
    const [sh, sm] = todayRow.startTime.split(':').map(Number);
    const [eh, em] = todayRow.endTime.split(':').map(Number);
    const startSeconds = sh * 3600 + sm * 60;
    const endSeconds = eh * 3600 + em * 60;
    const open = nowSeconds >= startSeconds && nowSeconds < endSeconds;
    return open
      ? {
          open: true,
          todayHours: { start: todayRow.startTime, end: todayRow.endTime },
        }
      : {
          open: false,
          reason:
            nowSeconds < startSeconds
              ? `Opens at ${todayRow.startTime.slice(0, 5)}`
              : `Closed for the day (closed at ${todayRow.endTime.slice(0, 5)})`,
          todayHours: { start: todayRow.startTime, end: todayRow.endTime },
        };
  }

  async setBusinessHours(agencyId: string, dto: SetBusinessHoursDto) {
    await this.ensureAgencyExists(agencyId);

    // Use a transaction: delete existing hours and create new ones
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.agencyBusinessHour.deleteMany({ where: { agencyId } });

      const hours = await tx.agencyBusinessHour.createMany({
        data: dto.hours.map((entry) => ({
          agencyId,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          isActive: entry.isActive ?? true,
        })),
      });

      return hours;
    });

    this.logger.log(`Business hours set for agency ${agencyId}`);

    // Return the newly created hours
    return this.prisma.agencyBusinessHour.findMany({
      where: { agencyId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  // ============================================================
  //  AGENCY SETTINGS
  // ============================================================

  async getSettings(agencyId: string) {
    await this.ensureAgencyExists(agencyId);

    return this.prisma.agencySetting.findMany({
      where: { agencyId },
    });
  }

  async updateSettings(agencyId: string, dto: UpsertAgencySettingDto) {
    await this.ensureAgencyExists(agencyId);

    const setting = await this.prisma.agencySetting.upsert({
      where: {
        uq_agency_setting: {
          agencyId,
          settingKey: dto.settingKey,
        },
      },
      update: {
        settingValue: dto.settingValue,
      },
      create: {
        agencyId,
        settingKey: dto.settingKey,
        settingValue: dto.settingValue,
      },
    });

    this.logger.log(
      `Setting updated for agency ${agencyId}: ${dto.settingKey}`,
    );
    return setting;
  }

  async upsertSetting(agencyId: string, dto: UpsertAgencySettingDto) {
    await this.ensureAgencyExists(agencyId);

    const setting = await this.prisma.agencySetting.upsert({
      where: {
        uq_agency_setting: {
          agencyId,
          settingKey: dto.settingKey,
        },
      },
      update: {
        settingValue: dto.settingValue,
      },
      create: {
        agencyId,
        settingKey: dto.settingKey,
        settingValue: dto.settingValue,
      },
    });

    this.logger.log(
      `Setting upserted for agency ${agencyId}: ${dto.settingKey}`,
    );
    return setting;
  }

  // ============================================================
  //  SERVICE PROVIDERS
  // ============================================================

  async createServiceProvider(dto: CreateServiceProviderDto) {
    const existing = await this.prisma.serviceProvider.findUnique({
      where: { providerName: dto.providerName },
    });
    if (existing) {
      throw new ConflictException(
        `Service provider "${dto.providerName}" already exists`,
      );
    }

    const provider = await this.prisma.serviceProvider.create({
      data: {
        providerName: dto.providerName,
        providerType: dto.providerType,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        website: dto.website,
        description: dto.description,
        contractReference: dto.contractReference,
        contractStartDate: dto.contractStartDate
          ? new Date(dto.contractStartDate)
          : undefined,
        contractEndDate: dto.contractEndDate
          ? new Date(dto.contractEndDate)
          : undefined,
      },
    });

    this.logger.log(`Service provider created: ${provider.id}`);
    return provider;
  }

  async findOneServiceProvider(id: string) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id },
      include: { _count: { select: { agencyServiceMaps: true } } },
    });
    if (!provider) throw new NotFoundException(`Service provider ${id} not found`);
    return provider;
  }

  async updateServiceProvider(id: string, dto: Partial<CreateServiceProviderDto>) {
    const existing = await this.prisma.serviceProvider.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Service provider ${id} not found`);

    // If the caller is renaming the provider, make sure the new name isn't
    // already taken by another row — providerName has a UNIQUE constraint.
    if (dto.providerName && dto.providerName !== existing.providerName) {
      const clash = await this.prisma.serviceProvider.findUnique({
        where: { providerName: dto.providerName },
      });
      if (clash && clash.id !== id) {
        throw new ConflictException(
          `Service provider "${dto.providerName}" already exists`,
        );
      }
    }

    const data: any = {};
    if (dto.providerName !== undefined) data.providerName = dto.providerName;
    if (dto.providerType !== undefined) data.providerType = dto.providerType;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail || null;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone || null;
    if (dto.website !== undefined) data.website = dto.website || null;
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.contractReference !== undefined) data.contractReference = dto.contractReference || null;
    if (dto.contractStartDate !== undefined) data.contractStartDate = dto.contractStartDate ? new Date(dto.contractStartDate) : null;
    if (dto.contractEndDate !== undefined) data.contractEndDate = dto.contractEndDate ? new Date(dto.contractEndDate) : null;

    const updated = await this.prisma.serviceProvider.update({ where: { id }, data });
    this.logger.log(`Service provider updated: ${id}`);
    return updated;
  }

  async deleteServiceProvider(id: string) {
    const existing = await this.prisma.serviceProvider.findUnique({
      where: { id },
      include: { _count: { select: { agencyServiceMaps: true } } },
    });
    if (!existing) throw new NotFoundException(`Service provider ${id} not found`);
    if (existing._count.agencyServiceMaps > 0) {
      // Don't hard-delete a provider that's still linked to agencies —
      // soft-disable instead so the existing mappings keep working.
      await this.prisma.serviceProvider.update({ where: { id }, data: { isActive: false } });
      return { id, deleted: false, deactivated: true };
    }
    await this.prisma.serviceProvider.delete({ where: { id } });
    return { id, deleted: true };
  }

  async findAllServiceProviders(
    filters: ServiceProviderFilterDto,
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      isActive,
      type,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.providerName = { contains: search, mode: 'insensitive' };
    }
    if (type) {
      // providerType is a free-form VARCHAR — match case-insensitively so
      // the UI doesn't need to know the exact casing stored in the DB.
      where.providerType = { equals: type, mode: 'insensitive' };
    }

    const allowedSortFields = ['createdAt', 'providerName', 'providerType'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [providers, total] = await Promise.all([
      this.prisma.serviceProvider.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderField]: sortOrder },
        include: {
          _count: { select: { agencyServiceMaps: true } },
        },
      }),
      this.prisma.serviceProvider.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: providers,
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

  async getAgencyServiceProviders(agencyId: string) {
    await this.ensureAgencyExists(agencyId);

    return this.prisma.agencyServiceMapping.findMany({
      where: { agencyId },
      include: {
        serviceProvider: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async mapServiceProvider(agencyId: string, dto: MapServiceProviderDto) {
    await this.ensureAgencyExists(agencyId);

    // Verify service provider exists
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id: dto.serviceProviderId },
    });
    if (!provider) {
      throw new NotFoundException(
        `Service provider with ID ${dto.serviceProviderId} not found`,
      );
    }

    // Check for existing mapping
    const existingMapping = await this.prisma.agencyServiceMapping.findFirst({
      where: {
        agencyId,
        serviceProviderId: dto.serviceProviderId,
      },
    });
    if (existingMapping) {
      throw new ConflictException(
        `Service provider is already mapped to this agency`,
      );
    }

    const mapping = await this.prisma.agencyServiceMapping.create({
      data: {
        agencyId,
        serviceProviderId: dto.serviceProviderId,
        supportScope: dto.supportScope,
        isPrimary: dto.isPrimary ?? false,
      },
      include: {
        serviceProvider: true,
      },
    });

    this.logger.log(
      `Service provider ${dto.serviceProviderId} mapped to agency ${agencyId}`,
    );
    return mapping;
  }

  // ============================================================
  //  AGENCY ONBOARDING
  // ============================================================

  async onboardAgency(dto: OnboardAgencyDto) {
    // Check for duplicate agency code
    const existing = await this.prisma.agency.findUnique({
      where: { agencyCode: dto.agencyCode },
    });
    if (existing) {
      throw new ConflictException(`Agency with code "${dto.agencyCode}" already exists`);
    }

    // Check admin email is not taken
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.adminUser.email },
    });
    if (existingUser) {
      throw new ConflictException(`User with email "${dto.adminUser.email}" already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.adminUser.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create agency. Government hierarchy fields are optional — set
      // only the ones the wizard actually provided, leave the rest null.
      const agency = await tx.agency.create({
        data: {
          agencyCode: dto.agencyCode,
          agencyName: dto.agencyName,
          agencyType: dto.agencyType,
          officialEmail: dto.officialEmail,
          officialPhone: dto.officialPhone,
          physicalAddress: dto.physicalAddress,
          county: dto.county,
          ministryName: dto.ministryName || undefined,
          stateDepartment: dto.stateDepartment || undefined,
          executiveOrderRef: dto.executiveOrderRef || undefined,
          executiveOrderYear: dto.executiveOrderYear ?? undefined,
          parentAgencyId: dto.parentAgencyId || undefined,
          onboardingStatus: 'IN_PROGRESS',
        },
      });

      // 2. Create departments
      const departments: any[] = [];
      if (dto.departments && dto.departments.length > 0) {
        for (const dept of dto.departments) {
          const d = await tx.department.create({
            data: {
              agencyId: agency.id,
              departmentName: dept.departmentName,
              departmentCode: dept.departmentCode,
              description: dept.description,
            },
          });
          departments.push(d);
        }
      }

      // 3. Create admin user
      const adminUser = await tx.user.create({
        data: {
          email: dto.adminUser.email,
          firstName: dto.adminUser.firstName,
          lastName: dto.adminUser.lastName,
          phoneNumber: dto.adminUser.phoneNumber,
          userType: 'AGENCY_AGENT',
          passwordHash,
        },
      });

      // 4. Link user to agency (first department if any)
      await tx.agencyUser.create({
        data: {
          userId: adminUser.id,
          agencyId: agency.id,
          departmentId: departments[0]?.id ?? null,
        },
      });

      // 5. Find AGENCY_ADMIN role and assign
      const agencyAdminRole = await tx.role.findFirst({
        where: { name: 'AGENCY_ADMIN' },
      });
      if (agencyAdminRole) {
        await tx.userRole.create({
          data: {
            userId: adminUser.id,
            roleId: agencyAdminRole.id,
            agencyId: agency.id,
          },
        });
      }

      // 6. Create 3 default automation rules
      const defaultRules = [
        {
          ruleName: 'auto-escalate-critical',
          triggerEvent: 'TICKET_CREATED',
          conditionExpression: JSON.stringify({ priority: 'CRITICAL', escalateAfterHours: 2 }),
        },
        {
          ruleName: 'notify-on-assign',
          triggerEvent: 'TICKET_ASSIGNED',
          conditionExpression: JSON.stringify({ notifyAgent: true }),
        },
        {
          ruleName: 'notify-citizen-resolved',
          triggerEvent: 'TICKET_RESOLVED',
          conditionExpression: JSON.stringify({ notifyCreator: true }),
        },
      ];

      for (const rule of defaultRules) {
        await tx.automationRule.create({
          data: {
            agencyId: agency.id,
            ruleName: rule.ruleName,
            triggerEvent: rule.triggerEvent,
            conditionExpression: rule.conditionExpression,
          },
        });
      }

      // 7. Mark onboarding complete
      const finalAgency = await tx.agency.update({
        where: { id: agency.id },
        data: { onboardingStatus: 'COMPLETED' },
        include: {
          departments: true,
          agencyUsers: {
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true, userType: true },
              },
            },
          },
        },
      });

      return { agency: finalAgency, adminUser: { id: adminUser.id, email: adminUser.email, firstName: adminUser.firstName, lastName: adminUser.lastName } };
    });

    this.logger.log(`Agency onboarded: ${result.agency.id} (${result.agency.agencyCode})`);
    return result;
  }

  // ============================================================
  //  HELPERS
  // ============================================================

  private async ensureAgencyExists(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id },
    });
    if (!agency) {
      throw new NotFoundException(`Agency with ID ${id} not found`);
    }
    return agency;
  }
}
