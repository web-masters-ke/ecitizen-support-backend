import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  IsObject,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum AuditActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  ASSIGNMENT = 'ASSIGNMENT',
  ESCALATION = 'ESCALATION',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  VIEW = 'VIEW',
  OVERRIDE = 'OVERRIDE',
  PUBLISH = 'PUBLISH',
  ARCHIVE = 'ARCHIVE',
  RESTORE = 'RESTORE',
}

export enum AccessTypeEnum {
  READ = 'READ',
  EXPORT = 'EXPORT',
  PRINT = 'PRINT',
  DOWNLOAD = 'DOWNLOAD',
}

// ─── Create Audit Log DTO ────────────────────────────────────────────────────

export class CreateAuditLogDto {
  @ApiProperty({ example: 'Ticket' })
  @IsString()
  @MaxLength(100)
  entityType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiProperty({ example: 'CREATE', enum: AuditActionType })
  @IsString()
  @MaxLength(100)
  actionType: string;

  @ApiPropertyOptional({
    description: 'Previous state before the action',
    example: { status: 'OPEN' },
  })
  @IsOptional()
  @IsObject()
  oldValue?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'New state after the action',
    example: { status: 'IN_PROGRESS' },
  })
  @IsOptional()
  @IsObject()
  newValue?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  performedBy?: string;

  @ApiPropertyOptional({ example: 'AGENCY_AGENT' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  performedByRole?: string;

  @ApiPropertyOptional({ example: '192.168.1.1' })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipAddress?: string;
}

// ─── Query Audit Logs ────────────────────────────────────────────────────────

export class QueryAuditLogsDto {
  @ApiPropertyOptional({ example: 'Ticket' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ example: 'CREATE' })
  @IsOptional()
  @IsString()
  actionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  performedBy?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

// ─── User Activity Log ──────────────────────────────────────────────────────

export class CreateUserActivityLogDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiProperty({ example: 'TICKET_VIEW' })
  @IsString()
  @MaxLength(100)
  activityType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiPropertyOptional({ example: 'Viewed ticket #TK-00123' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class QueryUserActivityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activityType?: string;

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

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

// ─── Data Access Log ─────────────────────────────────────────────────────────

export class CreateDataAccessLogDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ example: 'Ticket' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ example: 'nationalId' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fieldAccessed?: string;

  @ApiProperty({ enum: AccessTypeEnum })
  @IsEnum(AccessTypeEnum)
  accessType: AccessTypeEnum;
}

export class QueryDataAccessDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ enum: AccessTypeEnum })
  @IsOptional()
  @IsEnum(AccessTypeEnum)
  accessType?: AccessTypeEnum;

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

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export class ExportAuditLogsDto {
  @ApiPropertyOptional({ example: 'Ticket' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  performedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;
}
