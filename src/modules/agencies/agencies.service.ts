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

  async create(dto: CreateAgencyDto) {
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
    return agency;
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

  async update(id: string, dto: UpdateAgencyDto) {
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
      },
      include: {
        parentAgency: {
          select: { id: true, agencyName: true, agencyCode: true },
        },
        departments: true,
      },
    });

    this.logger.log(`Agency updated: ${agency.id}`);
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
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.providerName = { contains: search, mode: 'insensitive' };
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
      // 1. Create agency
      const agency = await tx.agency.create({
        data: {
          agencyCode: dto.agencyCode,
          agencyName: dto.agencyName,
          agencyType: dto.agencyType,
          officialEmail: dto.officialEmail,
          officialPhone: dto.officialPhone,
          physicalAddress: dto.physicalAddress,
          county: dto.county,
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
        where: { roleName: 'AGENCY_ADMIN' },
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
