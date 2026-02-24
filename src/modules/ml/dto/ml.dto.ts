import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Ticket Classification ────────────────────────────────────────────────────

export class ClassifyTicketMlDto {
  @ApiProperty({ description: 'UUID of the ticket to classify' })
  @IsUUID()
  ticketId: string;

  @ApiProperty({ description: 'Raw text to use for classification (subject + description)' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text: string;

  @ApiPropertyOptional({
    description: 'Channel the ticket arrived from',
    enum: ['WEB', 'MOBILE', 'USSD', 'SMS', 'API', 'CALL_CENTER', 'WHATSAPP', 'EMAIL'],
  })
  @IsOptional()
  @IsString()
  channel?: string;
}

// ─── Routing Recommendation ───────────────────────────────────────────────────

export class RoutingRecommendationDto {
  @ApiProperty({ description: 'UUID of the ticket for which routing is predicted' })
  @IsUUID()
  ticketId: string;
}

// ─── SLA Breach Prediction ────────────────────────────────────────────────────

export class SlaBreachPredictionDto {
  @ApiProperty({ description: 'UUID of the ticket to evaluate SLA breach risk' })
  @IsUUID()
  ticketId: string;
}

// ─── Sentiment Analysis ───────────────────────────────────────────────────────

export class SentimentAnalysisDto {
  @ApiProperty({
    description: 'The text to analyse for sentiment',
    example: 'I am extremely frustrated that my passport application has been delayed again.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  text: string;

  @ApiPropertyOptional({ description: 'Optional ticket ID to associate result with' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;
}

// ─── Anomaly Detection ────────────────────────────────────────────────────────

export enum AnomalyEntityType {
  USER = 'USER',
  AGENCY = 'AGENCY',
  TICKET = 'TICKET',
}

export class AnomalyDetectionDto {
  @ApiProperty({ description: 'UUID of the entity to evaluate for anomalies' })
  @IsUUID()
  entityId: string;

  @ApiProperty({
    description: 'The type of entity being evaluated',
    enum: AnomalyEntityType,
    example: AnomalyEntityType.USER,
  })
  @IsEnum(AnomalyEntityType)
  entityType: AnomalyEntityType;
}

// ─── KB Suggest ───────────────────────────────────────────────────────────────

export class KbSuggestDto {
  @ApiProperty({ description: 'UUID of the ticket for which KB articles are suggested' })
  @IsUUID()
  ticketId: string;

  @ApiPropertyOptional({ description: 'Maximum number of suggestions to return', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}

/** Query-only DTO for GET /ml/predict/kb-suggest/:ticketId (ticketId comes from path) */
export class KbSuggestQueryDto {
  @ApiPropertyOptional({ description: 'Maximum number of suggestions to return', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export class ForecastDto {
  @ApiProperty({ description: 'UUID of the agency for which the forecast is generated' })
  @IsUUID()
  agencyId: string;

  @ApiPropertyOptional({ description: 'Forecast horizon in days', default: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  periodDays?: number = 30;
}

/** Query-only DTO for GET /ml/forecast/:agencyId (agencyId comes from path) */
export class ForecastQueryDto {
  @ApiPropertyOptional({ description: 'Forecast horizon in days', default: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  periodDays?: number = 30;
}

// ─── Query ML Predictions ─────────────────────────────────────────────────────

export class QueryMlPredictionsDto {
  @ApiPropertyOptional({ description: 'Filter by model type (e.g. CLASSIFICATION, SENTIMENT, ROUTING)', example: 'CLASSIFICATION' })
  @IsOptional()
  @IsString()
  modelType?: string;

  @ApiPropertyOptional({ description: 'Filter by entity (ticket/user/agency) UUID' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

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

// ─── Register ML Model ────────────────────────────────────────────────────────

export class RegisterMlModelDto {
  @ApiProperty({ description: 'Human-readable name of the model', example: 'sla-breach-predictor' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  modelName: string;

  @ApiProperty({ description: 'Semver-style version string', example: 'ml-v2.1.0' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  modelVersion: string;

  @ApiProperty({ description: 'Functional type of the model', example: 'SLA_PREDICTION' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  modelType: string;

  @ApiPropertyOptional({ description: 'External inference endpoint URL, if applicable' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  endpoint?: string;

  @ApiPropertyOptional({ description: 'Whether this model should be considered active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Optional human-readable description of the model' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
