import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  IsArray,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// ============================================
// Dashboard & Metrics DTOs
// ============================================

export class DateRangeDto {
  @ApiPropertyOptional({ description: 'Start date for metrics (ISO 8601)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for metrics (ISO 8601)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by agency ID' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;
}

export class DashboardMetricsResponseDto {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  escalatedTickets: number;
  averageResponseTimeMinutes: number;
  averageResolutionTimeMinutes: number;
  slaCompliancePercentage: number;
  totalAgencies: number;
  activeAgents: number;
  ticketsByChannel: Record<string, number>;
  ticketsByPriority: Record<string, number>;
  ticketTrend: Array<{ date: string; count: number }>;
}

export class SlaSummaryResponseDto {
  totalTracked: number;
  responseMet: number;
  responseBreached: number;
  resolutionMet: number;
  resolutionBreached: number;
  overallCompliancePercentage: number;
  agencyBreakdown: Array<{
    agencyId: string;
    agencyName: string;
    compliancePercentage: number;
    totalTracked: number;
    breached: number;
  }>;
}

export class EscalationSummaryResponseDto {
  totalEscalations: number;
  pendingEscalations: number;
  resolvedEscalations: number;
  escalationsByTrigger: Record<string, number>;
  escalationsByAgency: Array<{
    agencyId: string;
    agencyName: string;
    count: number;
  }>;
  recentEscalations: any[];
}

export class AiMetricsResponseDto {
  totalClassifications: number;
  autoApplied: number;
  manualOverrides: number;
  averageConfidenceScore: number;
  classificationsByCategory: Record<string, number>;
  accuracyRate: number;
  totalRecommendations: number;
  appliedRecommendations: number;
}

// ============================================
// Ticket Override DTOs
// ============================================

export class SlaOverrideDto {
  @ApiProperty({ description: 'New SLA response due date (ISO 8601)' })
  @IsOptional()
  @IsString()
  newResponseDueAt?: string;

  @ApiProperty({ description: 'New SLA resolution due date (ISO 8601)' })
  @IsOptional()
  @IsString()
  newResolutionDueAt?: string;

  @ApiProperty({ description: 'Justification for the SLA override' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  justification: string;
}

export class TicketReassignDto {
  @ApiProperty({ description: 'New assignee user ID' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiProperty({ description: 'Target agency ID for cross-agency reassignment' })
  @IsUUID()
  targetAgencyId: string;

  @ApiPropertyOptional({ description: 'Target department ID' })
  @IsOptional()
  @IsUUID()
  targetDepartmentId?: string;

  @ApiProperty({ description: 'Reason for reassignment' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class TicketPriorityChangeDto {
  @ApiProperty({ description: 'New priority level ID' })
  @IsUUID()
  priorityId: string;

  @ApiProperty({ description: 'Reason for priority change' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class TicketSearchDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by ticket number' })
  @IsOptional()
  @IsString()
  ticketNumber?: string;

  @ApiPropertyOptional({ description: 'Search by subject or description' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: 'Filter by agency ID' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Filter by status name' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by priority name' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: 'Filter by channel' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ description: 'Filter by assignee user ID' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Filter escalated tickets only' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  escalatedOnly?: boolean;

  @ApiPropertyOptional({ description: 'Start date filter (ISO 8601)' })
  @IsOptional()
  @IsString()
  createdAfter?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO 8601)' })
  @IsOptional()
  @IsString()
  createdBefore?: string;
}

// ============================================
// Roles & Permissions DTOs
// ============================================

export class CreateRoleDto {
  @ApiProperty({ description: 'Role name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Role description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Whether this is a system role' })
  @IsOptional()
  @IsBoolean()
  isSystemRole?: boolean;
}

export class SetPermissionsDto {
  @ApiProperty({ description: 'Array of permission IDs to assign to the role' })
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}

// ============================================
// Policy DTOs
// ============================================

export class UpdateSlaPolicyDto {
  @ApiProperty({ description: 'Agency ID to apply policy to' })
  @IsUUID()
  agencyId: string;

  @ApiProperty({ description: 'Policy name' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  policyName: string;

  @ApiPropertyOptional({ description: 'Policy description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the policy is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether to apply business hours' })
  @IsOptional()
  @IsBoolean()
  appliesBusinessHours?: boolean;

  @ApiPropertyOptional({ description: 'SLA rules to set' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlaPolicyRuleDto)
  rules?: SlaPolicyRuleDto[];
}

export class SlaPolicyRuleDto {
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

  @ApiPropertyOptional({ description: 'Escalation after N minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  escalationAfterMinutes?: number;
}

export class UpdateEscalationPolicyDto {
  @ApiProperty({ description: 'Agency ID' })
  @IsUUID()
  agencyId: string;

  @ApiProperty({ description: 'Priority level for escalation' })
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

  @ApiPropertyOptional({ description: 'Enable auto escalation' })
  @IsOptional()
  @IsBoolean()
  autoEscalationEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Escalation levels' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalationLevelDto)
  levels?: EscalationLevelDto[];
}

export class EscalationLevelDto {
  @ApiProperty({ description: 'Level number' })
  @IsInt()
  @Min(1)
  @Max(10)
  levelNumber: number;

  @ApiPropertyOptional({ description: 'Escalation role' })
  @IsOptional()
  @IsString()
  escalationRole?: string;

  @ApiPropertyOptional({ description: 'Department ID to escalate to' })
  @IsOptional()
  @IsUUID()
  escalationDepartmentId?: string;

  @ApiPropertyOptional({ description: 'Notify via email' })
  @IsOptional()
  @IsBoolean()
  notifyViaEmail?: boolean;

  @ApiPropertyOptional({ description: 'Notify via SMS' })
  @IsOptional()
  @IsBoolean()
  notifyViaSms?: boolean;
}
