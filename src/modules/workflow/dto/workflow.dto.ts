import {
  IsString,
  IsUUID,
  IsBoolean,
  IsOptional,
  IsInt,
  IsObject,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// ============================================
// Automation Rule DTOs
// ============================================

export class CreateAutomationRuleDto {
  @ApiProperty({ description: 'Agency ID' })
  @IsUUID()
  agencyId: string;

  @ApiProperty({ description: 'Rule name' })
  @IsString()
  ruleName: string;

  @ApiProperty({
    description:
      'Trigger event (e.g. TICKET_CREATED, TICKET_STATUS_CHANGED, TICKET_ASSIGNED, SLA_BREACHED)',
  })
  @IsString()
  triggerEvent: string;

  @ApiProperty({
    description:
      'JSON condition expression (e.g. {"field": "priority", "operator": "eq", "value": "CRITICAL"})',
  })
  @IsString()
  conditionExpression: string;

  @ApiPropertyOptional({ description: 'Description of the automation rule' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the rule is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'User ID of rule creator' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}

export class UpdateAutomationRuleDto extends PartialType(
  CreateAutomationRuleDto,
) {}

// ============================================
// Automation Action DTOs
// ============================================

export class CreateAutomationActionDto {
  @ApiProperty({
    description:
      'Action type (e.g. ASSIGN_TO_USER, CHANGE_STATUS, CHANGE_PRIORITY, SEND_NOTIFICATION, ADD_TAG, ESCALATE)',
  })
  @IsString()
  actionType: string;

  @ApiPropertyOptional({
    description:
      'JSON payload for the action (e.g. {"userId": "xxx"} for ASSIGN_TO_USER)',
  })
  @IsOptional()
  @IsObject()
  actionPayload?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Execution order (lower = first)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  executionOrder?: number;
}

// ============================================
// Query DTOs
// ============================================

export class QueryAutomationRulesDto {
  @ApiPropertyOptional({ description: 'Filter by agency ID' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Filter by trigger event' })
  @IsOptional()
  @IsString()
  triggerEvent?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryWorkflowTriggersDto {
  @ApiPropertyOptional({ description: 'Filter by ticket ID' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;
}
