import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Classification DTOs ─────────────────────────────────────────────────────

export class ClassifyTicketDto {
  @ApiProperty({ description: 'ID of the ticket to classify' })
  @IsUUID()
  ticketId: string;

  @ApiPropertyOptional({
    description: 'Specific AI model ID to use for classification',
  })
  @IsOptional()
  @IsUUID()
  aiModelId?: string;

  @ApiPropertyOptional({
    description: 'Whether to auto-apply the classification if confidence is high',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoApply?: boolean;
}

export class QueryClassificationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  aiModelId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ─── Override DTOs ───────────────────────────────────────────────────────────

export class CreateAiOverrideDto {
  @ApiProperty({ description: 'The classification log ID being overridden' })
  @IsUUID()
  classificationLogId: string;

  @ApiProperty({ description: 'Ticket ID' })
  @IsUUID()
  ticketId: string;

  @ApiPropertyOptional({ description: 'Correct category ID chosen by agent' })
  @IsOptional()
  @IsUUID()
  correctCategoryId?: string;

  @ApiPropertyOptional({ description: 'Correct priority ID chosen by agent' })
  @IsOptional()
  @IsUUID()
  correctPriorityId?: string;

  @ApiPropertyOptional({ description: 'Why the agent overrode the AI suggestion' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;

  @ApiProperty({ description: 'User performing the override' })
  @IsUUID()
  performedBy: string;
}

// ─── Feedback DTOs ───────────────────────────────────────────────────────────

export class CreateAiFeedbackDto {
  @ApiProperty({ description: 'The classification log ID' })
  @IsUUID()
  classificationLogId: string;

  @ApiProperty({
    description: 'Was the AI suggestion accurate?',
    example: true,
  })
  @IsBoolean()
  wasAccurate: boolean;

  @ApiPropertyOptional({
    description: 'Rating of the AI suggestion from 1-5',
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Additional feedback comment' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiProperty({ description: 'User providing feedback' })
  @IsUUID()
  userId: string;
}

// ─── Model DTOs ──────────────────────────────────────────────────────────────

export class RegisterAiModelDto {
  @ApiProperty({ example: 'ticket-classifier' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  modelName: string;

  @ApiProperty({ example: 'v1.2.0' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  modelVersion: string;

  @ApiPropertyOptional({ example: 'rule-based' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  modelType?: string;

  @ApiPropertyOptional({ example: 'production' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deploymentEnvironment?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Metrics Query ───────────────────────────────────────────────────────────

export class QueryAiMetricsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  aiModelId?: string;

  @ApiPropertyOptional({ description: 'Start date for metrics window' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for metrics window' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

// ─── Recommendations Query ───────────────────────────────────────────────────

export class QueryRecommendationsDto {
  @ApiProperty()
  @IsUUID()
  ticketId: string;
}
