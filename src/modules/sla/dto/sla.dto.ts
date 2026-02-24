import {
  IsString,
  IsUUID,
  IsBoolean,
  IsOptional,
  IsInt,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// ============================================
// SLA Policy DTOs
// ============================================

export class CreateSlaPolicyDto {
  @ApiProperty({ description: 'Agency ID owning this policy' })
  @IsUUID()
  agencyId: string;

  @ApiProperty({ description: 'Name of the SLA policy' })
  @IsString()
  policyName: string;

  @ApiPropertyOptional({ description: 'Description of the policy' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the policy is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether business hours apply', default: true })
  @IsOptional()
  @IsBoolean()
  appliesBusinessHours?: boolean;
}

export class UpdateSlaPolicyDto extends PartialType(CreateSlaPolicyDto) {}

export class QuerySlaPoliciesDto {
  @ApiPropertyOptional({ description: 'Filter by agency ID' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============================================
// SLA Rule DTOs
// ============================================

export class CreateSlaRuleDto {
  @ApiPropertyOptional({ description: 'Priority level ID' })
  @IsOptional()
  @IsUUID()
  priorityId?: string;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ description: 'Response time in minutes' })
  @IsInt()
  @Min(1)
  responseTimeMinutes: number;

  @ApiProperty({ description: 'Resolution time in minutes' })
  @IsInt()
  @Min(1)
  resolutionTimeMinutes: number;

  @ApiPropertyOptional({ description: 'Auto-escalation after N minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  escalationAfterMinutes?: number;
}

// ============================================
// Escalation Matrix DTOs
// ============================================

export class CreateEscalationMatrixDto {
  @ApiProperty({ description: 'Agency ID' })
  @IsUUID()
  agencyId: string;

  @ApiPropertyOptional({ description: 'Name for the escalation matrix' })
  @IsOptional()
  @IsString()
  matrixName?: string;

  @ApiProperty({ description: 'Priority level (e.g. LOW, MEDIUM, HIGH, CRITICAL)' })
  @IsString()
  priorityLevel: string;

  @ApiProperty({ description: 'Max response time in minutes' })
  @IsInt()
  @Min(1)
  maxResponseTimeMinutes: number;

  @ApiProperty({ description: 'Max resolution time in minutes' })
  @IsInt()
  @Min(1)
  maxResolutionTimeMinutes: number;

  @ApiPropertyOptional({ description: 'Enable auto-escalation', default: true })
  @IsOptional()
  @IsBoolean()
  autoEscalationEnabled?: boolean;
}

export class EscalationLevelDto {
  @ApiProperty({ description: 'Level number (1, 2, 3...)' })
  @IsInt()
  @Min(1)
  levelNumber: number;

  @ApiPropertyOptional({ description: 'Role to escalate to' })
  @IsOptional()
  @IsString()
  escalationRole?: string;

  @ApiPropertyOptional({ description: 'Department ID to escalate to' })
  @IsOptional()
  @IsUUID()
  escalationDepartmentId?: string;

  @ApiPropertyOptional({ description: 'Notify via email', default: true })
  @IsOptional()
  @IsBoolean()
  notifyViaEmail?: boolean;

  @ApiPropertyOptional({ description: 'Notify via SMS', default: false })
  @IsOptional()
  @IsBoolean()
  notifyViaSms?: boolean;
}

export class SetEscalationLevelsDto {
  @ApiProperty({ description: 'Array of escalation levels', type: [EscalationLevelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalationLevelDto)
  levels: EscalationLevelDto[];
}

// ============================================
// Query DTOs
// ============================================

export class QueryBreachesDto {
  @ApiPropertyOptional({ description: 'Filter breaches by agency ID' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Filter by breach type (RESPONSE or RESOLUTION)' })
  @IsOptional()
  @IsEnum(['RESPONSE', 'RESOLUTION'])
  breachType?: 'RESPONSE' | 'RESOLUTION';

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class QueryEscalationMatrixDto {
  @ApiPropertyOptional({ description: 'Filter by agency ID' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;
}
