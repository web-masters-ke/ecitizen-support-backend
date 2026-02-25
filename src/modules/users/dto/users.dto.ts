import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  IsArray,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// ──────────────────────────────────────────────
// Enums (mirrors Prisma UserType)
// ──────────────────────────────────────────────

export enum UserTypeEnum {
  CITIZEN = 'CITIZEN',
  BUSINESS = 'BUSINESS',
  AGENCY_AGENT = 'AGENCY_AGENT',
  SERVICE_PROVIDER_AGENT = 'SERVICE_PROVIDER_AGENT',
  COMMAND_CENTER_ADMIN = 'COMMAND_CENTER_ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  API_CLIENT = 'API_CLIENT',
}

// ──────────────────────────────────────────────
// Create User DTO
// ──────────────────────────────────────────────

export class CreateUserDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User type', enum: UserTypeEnum })
  @IsEnum(UserTypeEnum)
  userType: UserTypeEnum;

  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[0-9\s\-()]+$/, { message: 'Invalid phone number format' })
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'National ID number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationalId?: string;

  @ApiPropertyOptional({ description: 'Business registration number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessRegistrationNo?: string;

  @ApiPropertyOptional({ description: 'eCitizen user ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ecitizenUserId?: string;

  @ApiPropertyOptional({ description: 'Password (for admin-created accounts)', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ description: 'Agency ID to associate with', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Department ID within the agency', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Role IDs to assign', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

// ──────────────────────────────────────────────
// Update User DTO
// ──────────────────────────────────────────────

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ description: 'Whether MFA is enabled' })
  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Whether user is verified' })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

// ──────────────────────────────────────────────
// Self-update DTO (citizen/user updating own profile)
// Only safe fields — no role, userType, or status changes allowed.
// ──────────────────────────────────────────────

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+254712345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;
}

// ──────────────────────────────────────────────
// Assign Roles DTO
// ──────────────────────────────────────────────

export class AssignRolesDto {
  @ApiProperty({ description: 'Array of role IDs to assign', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds: string[];

  @ApiPropertyOptional({
    description: 'Agency context for role assignment (optional scope)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  agencyId?: string;
}

// ──────────────────────────────────────────────
// Toggle Status DTO
// ──────────────────────────────────────────────

export class ToggleUserStatusDto {
  @ApiProperty({ description: 'Set user active or inactive' })
  @IsBoolean()
  isActive: boolean;
}

// ──────────────────────────────────────────────
// User Filter DTO (extends pagination)
// ──────────────────────────────────────────────

export class UserFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by agency ID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Filter by user type', enum: UserTypeEnum })
  @IsOptional()
  @IsEnum(UserTypeEnum)
  userType?: UserTypeEnum;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by verified status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  search?: string;
}
