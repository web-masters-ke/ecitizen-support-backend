import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// ──────────────────────────────────────────────
// Enums (mirrors Prisma AgencyType / OnboardingStatus)
// ──────────────────────────────────────────────

export enum AgencyTypeEnum {
  MINISTRY = 'MINISTRY',
  DEPARTMENT = 'DEPARTMENT',
  PARASTATAL = 'PARASTATAL',
  COUNTY_GOVERNMENT = 'COUNTY_GOVERNMENT',
  REGULATORY_BODY = 'REGULATORY_BODY',
  SERVICE_PROVIDER = 'SERVICE_PROVIDER',
}

export enum OnboardingStatusEnum {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SUSPENDED = 'SUSPENDED',
}

// ──────────────────────────────────────────────
// Create Agency DTO
// ──────────────────────────────────────────────

export class CreateAgencyDto {
  @ApiProperty({ description: 'Unique agency code', example: 'MOH' })
  @IsString()
  @MaxLength(50)
  agencyCode: string;

  @ApiProperty({ description: 'Agency name', example: 'Ministry of Health' })
  @IsString()
  @MaxLength(255)
  agencyName: string;

  @ApiProperty({ description: 'Agency type', enum: AgencyTypeEnum })
  @IsEnum(AgencyTypeEnum)
  agencyType: AgencyTypeEnum;

  @ApiPropertyOptional({ description: 'Parent agency ID for hierarchy', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentAgencyId?: string;

  @ApiPropertyOptional({ description: 'Registration number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'Official email address' })
  @IsOptional()
  @IsEmail()
  officialEmail?: string;

  @ApiPropertyOptional({ description: 'Official phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  officialPhone?: string;

  @ApiPropertyOptional({ description: 'Physical address' })
  @IsOptional()
  @IsString()
  physicalAddress?: string;

  @ApiPropertyOptional({ description: 'County' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  county?: string;

  @ApiPropertyOptional({ description: 'Whether agency is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ──────────────────────────────────────────────
// Update Agency DTO
// ──────────────────────────────────────────────

export class UpdateAgencyDto extends PartialType(CreateAgencyDto) {
  @ApiPropertyOptional({ description: 'Agency description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Onboarding status', enum: OnboardingStatusEnum })
  @IsOptional()
  @IsEnum(OnboardingStatusEnum)
  onboardingStatus?: OnboardingStatusEnum;
}

// ──────────────────────────────────────────────
// Agency Filter DTO
// ──────────────────────────────────────────────

export class AgencyFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by agency type', enum: AgencyTypeEnum })
  @IsOptional()
  @IsEnum(AgencyTypeEnum)
  agencyType?: AgencyTypeEnum;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by onboarding status', enum: OnboardingStatusEnum })
  @IsOptional()
  @IsEnum(OnboardingStatusEnum)
  onboardingStatus?: OnboardingStatusEnum;

  @ApiPropertyOptional({ description: 'Filter by county' })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiPropertyOptional({ description: 'Search by name or code' })
  @IsOptional()
  @IsString()
  search?: string;
}

// ──────────────────────────────────────────────
// Department DTOs
// ──────────────────────────────────────────────

export class CreateDepartmentDto {
  @ApiProperty({ description: 'Department name' })
  @IsString()
  @MaxLength(255)
  departmentName: string;

  @ApiPropertyOptional({ description: 'Department code' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  departmentCode?: string;

  @ApiPropertyOptional({ description: 'Department description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {
  @ApiPropertyOptional({ description: 'Whether department is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ──────────────────────────────────────────────
// Agency Contact DTO
// ──────────────────────────────────────────────

export class CreateAgencyContactDto {
  @ApiPropertyOptional({ description: 'Contact name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @ApiPropertyOptional({ description: 'Role / title' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  roleTitle?: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Contact phone' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Type of contact (e.g. PRIMARY, ESCALATION, TECHNICAL)', example: 'PRIMARY' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactType?: string;

  @ApiPropertyOptional({ description: 'Contact email address (alternate field)' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Contact phone number (alternate field)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Escalation level for this contact' })
  @IsOptional()
  @IsInt()
  @Min(0)
  escalationLevel?: number;
}

// ──────────────────────────────────────────────
// Business Hours DTO
// ──────────────────────────────────────────────

export class BusinessHourEntryDto {
  @ApiProperty({ description: 'Day of week (0=Sun, 6=Sat)', minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Start time (HH:MM:SS)', example: '08:00:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
    message: 'startTime must be in HH:MM or HH:MM:SS format',
  })
  startTime: string;

  @ApiProperty({ description: 'End time (HH:MM:SS)', example: '17:00:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
    message: 'endTime must be in HH:MM or HH:MM:SS format',
  })
  endTime: string;

  @ApiPropertyOptional({ description: 'Whether this day is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetBusinessHoursDto {
  @ApiProperty({ description: 'Array of business hour entries', type: [BusinessHourEntryDto] })
  @ValidateNested({ each: true })
  @Type(() => BusinessHourEntryDto)
  hours: BusinessHourEntryDto[];
}

// ──────────────────────────────────────────────
// Agency Setting DTO
// ──────────────────────────────────────────────

export class UpsertAgencySettingDto {
  @ApiProperty({ description: 'Setting key', example: 'auto_assign_tickets' })
  @IsString()
  @MaxLength(100)
  settingKey: string;

  @ApiProperty({ description: 'Setting value', example: 'true' })
  @IsString()
  settingValue: string;
}

// ──────────────────────────────────────────────
// Service Provider DTOs
// ──────────────────────────────────────────────

export class CreateServiceProviderDto {
  @ApiProperty({ description: 'Provider name' })
  @IsString()
  @MaxLength(255)
  providerName: string;

  @ApiPropertyOptional({ description: 'Provider type' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  providerType?: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Contact phone' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Contract reference number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contractReference?: string;

  @ApiPropertyOptional({ description: 'Contract start date (ISO 8601)' })
  @IsOptional()
  @IsString()
  contractStartDate?: string;

  @ApiPropertyOptional({ description: 'Contract end date (ISO 8601)' })
  @IsOptional()
  @IsString()
  contractEndDate?: string;
}

export class MapServiceProviderDto {
  @ApiProperty({ description: 'Service provider ID', format: 'uuid' })
  @IsUUID()
  serviceProviderId: string;

  @ApiPropertyOptional({ description: 'Scope of support provided' })
  @IsOptional()
  @IsString()
  supportScope?: string;

  @ApiPropertyOptional({ description: 'Whether this is the primary provider', default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ServiceProviderFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by provider name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
