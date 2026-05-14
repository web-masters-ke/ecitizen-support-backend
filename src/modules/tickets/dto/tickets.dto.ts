import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsDateString,
  IsArray,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// ============================================
// Enums mirroring Prisma schema
// ============================================

export enum TicketChannelEnum {
  WEB = 'WEB',
  MOBILE = 'MOBILE',
  USSD = 'USSD',
  SMS = 'SMS',
  API = 'API',
  CALL_CENTER = 'CALL_CENTER',
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
}

export enum TicketStatusEnum {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  ESCALATED = 'ESCALATED',
  PENDING_CITIZEN = 'PENDING_CITIZEN',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
  REJECTED = 'REJECTED',
}

export enum TicketPriorityEnum {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum MessageTypeEnum {
  COMMENT = 'COMMENT',
  STATUS_CHANGE = 'STATUS_CHANGE',
  ESCALATION_NOTE = 'ESCALATION_NOTE',
  SYSTEM_UPDATE = 'SYSTEM_UPDATE',
}

export enum EscalationTriggerEnum {
  SYSTEM = 'SYSTEM',
  SUPERVISOR = 'SUPERVISOR',
  COMMAND_CENTER = 'COMMAND_CENTER',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
}

// ============================================
// Create Ticket DTO
// ============================================

export class CreateTicketDto {
  // Agency is optional — when a citizen leaves it blank on /tickets/new
  // we let the AI router (or the keyword/default fallback chain) pick
  // the right agency. Admins on the SCC UI almost always set this
  // explicitly so the auto-route only fires when truly omitted.
  @ApiPropertyOptional({ description: 'Agency ID the ticket is for. Optional — auto-routed if omitted.' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Department ID within the agency' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Category ID for the ticket' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Priority level ID' })
  @IsOptional()
  @IsUUID()
  priorityId?: string;

  @ApiProperty({ description: 'Channel through which the ticket was created', enum: TicketChannelEnum })
  @IsEnum(TicketChannelEnum)
  channel: TicketChannelEnum;

  @ApiProperty({ description: 'Ticket subject', maxLength: 255 })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  subject: string;

  @ApiProperty({ description: 'Detailed description of the issue' })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiPropertyOptional({ description: 'Array of tag names to attach', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

// ============================================
// Public Ticket Submission DTO — citizen reports
// an issue without signing in.
// ============================================

export class PublicCreateTicketDto {
  // Agency is optional on the public form. Citizens often don't know
  // which agency owns their issue (forgot password? lost passport?) —
  // we land it on the default routing agency so AI / a triage agent
  // can re-route after reading the description.
  @ApiPropertyOptional({ description: 'Agency ID the ticket is for. Optional — defaults to the eCitizen routing agency.' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Category ID for the ticket' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ description: 'Ticket subject', maxLength: 255 })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  subject: string;

  @ApiProperty({ description: 'Detailed description of the issue' })
  @IsString()
  @MinLength(10)
  description: string;

  // Citizen contact — at least one of these is required so the agency
  // can reach the reporter back. The DTO is intentionally permissive
  // because many citizens won't have an eCitizen ID handy.
  @ApiPropertyOptional({ description: 'Reporter full name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reporterName?: string;

  @ApiPropertyOptional({ description: 'Reporter email address' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reporterEmail?: string;

  @ApiPropertyOptional({ description: 'Reporter phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  reporterPhone?: string;

  // Optional attachment — the citizen uploaded a screenshot / PDF / receipt
  // via /media/public-upload before submitting the form. We surface it as an
  // initial ticket message so agents see it inline in the conversation.
  @ApiPropertyOptional({ description: 'Attachment storage URL (from /media/public-upload)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  attachmentUrl?: string;

  @ApiPropertyOptional({ description: 'Original filename of the attachment' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  attachmentName?: string;

  @ApiPropertyOptional({ description: 'MIME type of the attachment' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  attachmentType?: string;
}

// ============================================
// Update Ticket DTO
// ============================================

export class UpdateTicketDto {
  @ApiPropertyOptional({ description: 'Department ID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Priority level ID' })
  @IsOptional()
  @IsUUID()
  priorityId?: string;

  @ApiPropertyOptional({ description: 'Ticket subject', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  subject?: string;

  @ApiPropertyOptional({ description: 'Ticket description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Channel', enum: TicketChannelEnum })
  @IsOptional()
  @IsEnum(TicketChannelEnum)
  channel?: TicketChannelEnum;
}

// ============================================
// Assign Ticket DTO
// ============================================

export class AssignTicketDto {
  @ApiProperty({ description: 'User ID of the agent to assign to' })
  @IsUUID()
  assigneeId: string;

  @ApiPropertyOptional({ description: 'Reason for the assignment' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ============================================
// Escalate Ticket DTO
// ============================================

export class EscalateTicketDto {
  @ApiPropertyOptional({ description: 'Reason for escalation' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'User ID to escalate to' })
  @IsOptional()
  @IsUUID()
  escalateToUserId?: string;

  @ApiPropertyOptional({ description: 'Role to escalate to (e.g., SUPERVISOR)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  escalateToRole?: string;

  @ApiPropertyOptional({ description: 'Transfer ownership to a different agency on escalation', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  targetAgencyId?: string;

  @ApiPropertyOptional({ description: 'Escalate to the eCitizen Command Centre (notifies all SUPER_ADMIN / COMMAND_CENTER_ADMIN users)' })
  @IsOptional()
  @IsBoolean()
  escalateToCommandCentre?: boolean;

  @ApiPropertyOptional({ description: 'Resolution mode: AUTO (consult agency escalation matrix) or MANUAL (use provided user/role/agency)', enum: ['AUTO', 'MANUAL'] })
  @IsOptional()
  @IsEnum(['AUTO', 'MANUAL'])
  mode?: 'AUTO' | 'MANUAL';

  @ApiPropertyOptional({
    description: 'Trigger for the escalation',
    enum: EscalationTriggerEnum,
    default: EscalationTriggerEnum.MANUAL_OVERRIDE,
  })
  @IsOptional()
  @IsEnum(EscalationTriggerEnum)
  trigger?: EscalationTriggerEnum;

  @ApiPropertyOptional({ description: 'Bump ticket priority on escalation (CRITICAL/HIGH/MEDIUM/LOW)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  newPriority?: string;

  @ApiPropertyOptional({ description: 'Additional emails to notify about the escalation', type: [String] })
  @IsOptional()
  notifyEmails?: string[];
}

// ============================================
// Resolve Ticket DTO
// ============================================

export class ResolveTicketDto {
  @ApiPropertyOptional({ description: 'Resolution notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNotes?: string;
}

// ============================================
// Close Ticket DTO
// ============================================

export class CloseTicketDto {
  @ApiPropertyOptional({ description: 'Reason for closing' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// ============================================
// Reopen Ticket DTO
// ============================================

export class ReopenTicketDto {
  @ApiProperty({ description: 'Reason for reopening' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason: string;
}

// ============================================
// Create Message DTO
// ============================================

export class CreateMessageDto {
  @ApiPropertyOptional({ description: 'Message text' })
  @IsOptional()
  @IsString()
  messageText?: string;

  @ApiPropertyOptional({
    description: 'Message type',
    enum: MessageTypeEnum,
    default: MessageTypeEnum.COMMENT,
  })
  @IsOptional()
  @IsEnum(MessageTypeEnum)
  messageType?: MessageTypeEnum;

  @ApiPropertyOptional({ description: 'Whether this is an internal note (not visible to citizen)', default: false })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @ApiPropertyOptional({ description: 'File URL (S3) for attachment' })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional({ description: 'Original file name' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ description: 'File MIME type' })
  @IsOptional()
  @IsString()
  fileType?: string;
}

// ============================================
// Create Attachment DTO (presigned URL approach)
// ============================================

export class CreateAttachmentDto {
  @ApiProperty({ description: 'File name' })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ description: 'File MIME type' })
  @IsString()
  @MaxLength(100)
  fileType: string;

  @ApiProperty({ description: 'File size in bytes' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSize: number;

  @ApiPropertyOptional({ description: 'Associated message ID' })
  @IsOptional()
  @IsUUID()
  messageId?: string;
}

// ============================================
// Add Tags DTO
// ============================================

export class AddTagsDto {
  @ApiProperty({ description: 'Array of tag names to add', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  tags: string[];
}

// ============================================
// Ticket Filter / Query DTO
// ============================================

export class TicketFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: TicketStatusEnum })
  @IsOptional()
  @IsEnum(TicketStatusEnum)
  status?: TicketStatusEnum;

  @ApiPropertyOptional({ description: 'Filter by agency ID' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Filter by priority ID' })
  @IsOptional()
  @IsUUID()
  priorityId?: string;

  @ApiPropertyOptional({ description: 'Filter by priority name (CRITICAL/HIGH/MEDIUM/LOW)', enum: TicketPriorityEnum })
  @IsOptional()
  @IsEnum(TicketPriorityEnum)
  priority?: TicketPriorityEnum;

  @ApiPropertyOptional({ description: 'Filter by current assignee ID' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by department ID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Filter by channel', enum: TicketChannelEnum })
  @IsOptional()
  @IsEnum(TicketChannelEnum)
  channel?: TicketChannelEnum;

  @ApiPropertyOptional({ description: 'Filter by escalated status' })
  @IsOptional()
  @IsBoolean()
  isEscalated?: boolean;

  @ApiPropertyOptional({ description: 'Start date for date range filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date for date range filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Full-text search on subject and description' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by creator user ID' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}

// ============================================
// Category Filter DTO
// ============================================

export class CategoryFilterDto {
  @ApiPropertyOptional({ description: 'Filter categories by agency ID' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============================================
// Message Filter DTO
// ============================================

export class MessageFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by message type', enum: MessageTypeEnum })
  @IsOptional()
  @IsEnum(MessageTypeEnum)
  messageType?: MessageTypeEnum;

  @ApiPropertyOptional({ description: 'Include internal messages (agents only)' })
  @IsOptional()
  @IsBoolean()
  includeInternal?: boolean;
}

// ============================================
// Ticket Citizen Feedback DTO
// ============================================

export class TicketFeedbackDto {
  @ApiProperty({ description: 'Citizen rating 1-5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ description: 'Citizen feedback comment' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;
}
