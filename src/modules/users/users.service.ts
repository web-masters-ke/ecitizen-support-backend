import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateMyProfileDto,
  AssignRolesDto,
  UserFilterDto,
} from './dto/users.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────
  // CREATE
  // ──────────────────────────────────────────────

  async create(dto: CreateUserDto, assignedBy?: string) {
    // Check for duplicate email
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`);
    }

    // Check for duplicate eCitizen ID if provided
    if (dto.ecitizenUserId) {
      const existingEcitizen = await this.prisma.user.findUnique({
        where: { ecitizenUserId: dto.ecitizenUserId },
      });
      if (existingEcitizen) {
        throw new ConflictException(
          `User with eCitizen ID ${dto.ecitizenUserId} already exists`,
        );
      }
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 12);
    }

    // Build the create payload
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        userType: dto.userType,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        nationalId: dto.nationalId,
        businessRegistrationNo: dto.businessRegistrationNo,
        ecitizenUserId: dto.ecitizenUserId,
        passwordHash,
        // If agency info is provided, create the AgencyUser link
        ...(dto.agencyId && {
          agencyUsers: {
            create: {
              agencyId: dto.agencyId,
              departmentId: dto.departmentId,
            },
          },
        }),
        // If role IDs are provided, create UserRole entries
        ...(dto.roleIds &&
          dto.roleIds.length > 0 && {
            userRoles: {
              create: dto.roleIds.map((roleId) => ({
                roleId,
                agencyId: dto.agencyId,
                assignedBy,
              })),
            },
          }),
      },
      include: {
        userRoles: { include: { role: true } },
        agencyUsers: { include: { agency: true, department: true } },
      },
    });

    this.logger.log(`User created: ${user.id} (${user.email})`);
    return this.sanitizeUser(user);
  }

  // ──────────────────────────────────────────────
  // FIND ALL (paginated + filtered)
  // ──────────────────────────────────────────────

  async findAll(filters: UserFilterDto): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      agencyId,
      userType,
      isActive,
      isVerified,
      search,
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      deletedAt: null, // Exclude soft-deleted users
    };

    if (userType) {
      where.userType = userType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isVerified !== undefined) {
      where.isVerified = isVerified;
    }

    // Agency-scoped filtering
    if (agencyId) {
      where.agencyUsers = {
        some: { agencyId },
      };
    }

    // Free-text search across name and email
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Validate sort field to prevent injection
    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'email',
      'firstName',
      'lastName',
      'userType',
      'isActive',
      'lastLoginAt',
    ];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderField]: sortOrder },
        include: {
          userRoles: { include: { role: true } },
          agencyUsers: {
            include: {
              agency: { select: { id: true, agencyName: true, agencyCode: true } },
              department: { select: { id: true, departmentName: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users.map((u) => this.sanitizeUser(u)),
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

  // ──────────────────────────────────────────────
  // FIND ONE
  // ──────────────────────────────────────────────

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        agencyUsers: {
          include: {
            agency: { select: { id: true, agencyName: true, agencyCode: true, agencyType: true } },
            department: { select: { id: true, departmentName: true, departmentCode: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.sanitizeUser(user);
  }

  // ──────────────────────────────────────────────
  // FIND BY EMAIL (for auth)
  // ──────────────────────────────────────────────

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: { include: { role: true } },
        agencyUsers: {
          include: {
            agency: { select: { id: true, agencyName: true, agencyCode: true } },
          },
        },
      },
    });
  }

  // ──────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────

  async update(id: string, dto: UpdateUserDto) {
    await this.ensureUserExists(id);

    // If email is being changed, check for conflicts
    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          id: { not: id },
        },
      });
      if (conflict) {
        throw new ConflictException(`Email ${dto.email} is already in use`);
      }
    }

    // Hash password if being updated
    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email && { email: dto.email }),
        ...(dto.userType && { userType: dto.userType }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.nationalId !== undefined && { nationalId: dto.nationalId }),
        ...(dto.businessRegistrationNo !== undefined && {
          businessRegistrationNo: dto.businessRegistrationNo,
        }),
        ...(dto.ecitizenUserId !== undefined && { ecitizenUserId: dto.ecitizenUserId }),
        ...(dto.mfaEnabled !== undefined && { mfaEnabled: dto.mfaEnabled }),
        ...(dto.isVerified !== undefined && { isVerified: dto.isVerified }),
        ...(passwordHash && { passwordHash }),
      },
      include: {
        userRoles: { include: { role: true } },
        agencyUsers: {
          include: {
            agency: { select: { id: true, agencyName: true, agencyCode: true } },
            department: { select: { id: true, departmentName: true } },
          },
        },
      },
    });

    this.logger.log(`User updated: ${user.id}`);
    return this.sanitizeUser(user);
  }

  // ──────────────────────────────────────────────
  // UPDATE OWN PROFILE (citizen / any authenticated user)
  // Only firstName, lastName, phoneNumber, nationalId — no role/status changes.
  // ──────────────────────────────────────────────

  async updateMyProfile(userId: string, dto: UpdateMyProfileDto) {
    await this.ensureUserExists(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.nationalId !== undefined && { nationalId: dto.nationalId }),
      },
      include: {
        userRoles: { include: { role: true } },
        agencyUsers: {
          include: {
            agency: { select: { id: true, agencyName: true, agencyCode: true } },
            department: { select: { id: true, departmentName: true } },
          },
        },
      },
    });

    this.logger.log(`Profile self-updated: ${user.id}`);
    return this.sanitizeUser(user);
  }

  // ──────────────────────────────────────────────
  // ASSIGN ROLES
  // ──────────────────────────────────────────────

  async assignRoles(userId: string, dto: AssignRolesDto, assignedBy?: string) {
    await this.ensureUserExists(userId);

    // Validate that all role IDs exist
    const roles = await this.prisma.role.findMany({
      where: { id: { in: dto.roleIds } },
    });

    if (roles.length !== dto.roleIds.length) {
      const foundIds = roles.map((r) => r.id);
      const missingIds = dto.roleIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Role(s) not found: ${missingIds.join(', ')}`,
      );
    }

    // Remove existing roles for this user (in the same agency scope if provided)
    const deleteWhere: any = { userId };
    if (dto.agencyId) {
      deleteWhere.agencyId = dto.agencyId;
    }

    await this.prisma.userRole.deleteMany({ where: deleteWhere });

    // Assign new roles
    await this.prisma.userRole.createMany({
      data: dto.roleIds.map((roleId) => ({
        userId,
        roleId,
        agencyId: dto.agencyId,
        assignedBy,
      })),
    });

    this.logger.log(
      `Roles assigned to user ${userId}: ${dto.roleIds.join(', ')}`,
    );

    return this.findOne(userId);
  }

  // ──────────────────────────────────────────────
  // TOGGLE STATUS (active/inactive)
  // ──────────────────────────────────────────────

  async toggleStatus(id: string, isActive: boolean) {
    await this.ensureUserExists(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      include: {
        userRoles: { include: { role: true } },
        agencyUsers: {
          include: {
            agency: { select: { id: true, agencyName: true, agencyCode: true } },
          },
        },
      },
    });

    this.logger.log(`User ${id} status set to ${isActive ? 'active' : 'inactive'}`);
    return this.sanitizeUser(user);
  }

  // ──────────────────────────────────────────────
  // SOFT DELETE
  // ──────────────────────────────────────────────

  async softDelete(id: string) {
    await this.ensureUserExists(id);

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    this.logger.log(`User soft-deleted: ${id}`);
    return { message: `User ${id} has been deleted` };
  }

  // ──────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Remove sensitive fields from user object before returning
   */
  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
