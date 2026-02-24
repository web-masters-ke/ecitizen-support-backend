import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Dashboard Metrics Query ─────────────────────────────────────────────────

export class QueryDashboardMetricsDto {
  @ApiPropertyOptional({ description: 'Filter by agency ID' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;
}

// ─── SLA Report Query ────────────────────────────────────────────────────────

export class QuerySlaReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO string)', example: '2025-01-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO string)', example: '2025-12-31' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

// ─── Agency Performance Query ────────────────────────────────────────────────

export class QueryAgencyPerformanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;
}

// ─── Ticket Metrics Query ────────────────────────────────────────────────────

export class QueryTicketMetricsHourlyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Start date for hourly metrics' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for hourly metrics' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168) // Up to 7 days of hourly data
  limit?: number = 24;
}

export class QueryTicketMetricsDailyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  limit?: number = 30;
}

// ─── User Performance Query ──────────────────────────────────────────────────

export class QueryUserPerformanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;
}

// ─── Export Request ──────────────────────────────────────────────────────────

export enum ExportFormat {
  CSV = 'CSV',
  JSON = 'JSON',
}

export enum ExportReportType {
  DASHBOARD = 'DASHBOARD',
  SLA = 'SLA',
  AGENCY_PERFORMANCE = 'AGENCY_PERFORMANCE',
  TICKET_METRICS = 'TICKET_METRICS',
  USER_PERFORMANCE = 'USER_PERFORMANCE',
}

export class CreateExportRequestDto {
  @ApiProperty({
    enum: ExportReportType,
    example: ExportReportType.DASHBOARD,
  })
  @IsEnum(ExportReportType)
  reportType: ExportReportType;

  @ApiPropertyOptional({
    enum: ExportFormat,
    default: ExportFormat.CSV,
  })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requestedBy?: string;
}

// ─── Snapshots Query ─────────────────────────────────────────────────────────

export class QuerySnapshotsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ example: 'daily_summary' })
  @IsOptional()
  @IsString()
  snapshotType?: string;

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
