import {
  IsString,
  IsUUID,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  IsEmail,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// ============================================
// Notification Channels & Statuses (mirroring enums)
// ============================================

export enum NotificationChannelDto {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
  WEBHOOK = 'WEBHOOK',
}

export enum NotificationStatusDto {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING',
}

// ============================================
// Recipient DTO
// ============================================

export class NotificationRecipientDto {
  @ApiPropertyOptional({ description: 'User ID of the recipient' })
  @IsOptional()
  @IsUUID()
  recipientUserId?: string;

  @ApiPropertyOptional({ description: 'Email address of the recipient' })
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @ApiPropertyOptional({ description: 'Phone number of the recipient' })
  @IsOptional()
  @IsString()
  recipientPhone?: string;
}

// ============================================
// Send Notification DTO
// ============================================

export class SendNotificationDto {
  @ApiPropertyOptional({ description: 'Agency ID context' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Related ticket ID' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiPropertyOptional({ description: 'Template ID to use' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Event that triggered this notification' })
  @IsOptional()
  @IsString()
  triggerEvent?: string;

  @ApiProperty({
    description: 'Notification channel',
    enum: NotificationChannelDto,
  })
  @IsEnum(NotificationChannelDto)
  channel: NotificationChannelDto;

  @ApiProperty({
    description: 'List of recipients',
    type: [NotificationRecipientDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationRecipientDto)
  recipients: NotificationRecipientDto[];

  @ApiPropertyOptional({ description: 'Email subject (if not using template)' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Message body (if not using template)' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'Template name (alternative to templateId)' })
  @IsOptional()
  @IsString()
  templateName?: string;

  @ApiPropertyOptional({ description: 'Recipient user ID (shorthand for single recipient)' })
  @IsOptional()
  @IsUUID()
  recipientId?: string;

  @ApiPropertyOptional({
    description: 'Template variables to interpolate (alias for templateVariables)',
  })
  @IsOptional()
  variables?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Template variables to interpolate',
  })
  @IsOptional()
  templateVariables?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Max retries', default: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Webhook URL (required for WEBHOOK channel)',
  })
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @ApiPropertyOptional({
    description: 'Webhook payload (for WEBHOOK channel)',
  })
  @IsOptional()
  webhookPayload?: Record<string, any>;
}

// ============================================
// Notification Template DTOs
// ============================================

export class CreateNotificationTemplateDto {
  @ApiPropertyOptional({ description: 'Agency ID (null for global templates)' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiProperty({ description: 'Template name' })
  @IsString()
  templateName: string;

  @ApiProperty({
    description: 'Notification channel',
    enum: NotificationChannelDto,
  })
  @IsEnum(NotificationChannelDto)
  channel: NotificationChannelDto;

  @ApiPropertyOptional({
    description: 'Subject template (supports {{variable}} interpolation)',
  })
  @IsOptional()
  @IsString()
  subjectTemplate?: string;

  @ApiProperty({
    description: 'Body template (supports {{variable}} interpolation)',
  })
  @IsString()
  bodyTemplate: string;

  @ApiPropertyOptional({ description: 'Whether template is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateNotificationTemplateDto extends PartialType(
  CreateNotificationTemplateDto,
) {}

// ============================================
// Query DTOs
// ============================================

export class QueryNotificationsDto {
  @ApiPropertyOptional({ description: 'Filter by agency ID' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by channel',
    enum: NotificationChannelDto,
  })
  @IsOptional()
  @IsEnum(NotificationChannelDto)
  channel?: NotificationChannelDto;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: NotificationStatusDto,
  })
  @IsOptional()
  @IsEnum(NotificationStatusDto)
  status?: NotificationStatusDto;

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

  @ApiPropertyOptional({ description: 'Filter to notifications for a specific recipient user' })
  @IsOptional()
  @IsUUID()
  recipientUserId?: string;
}

export class QueryNotificationTemplatesDto {
  @ApiPropertyOptional({ description: 'Filter by agency ID' })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by channel',
    enum: NotificationChannelDto,
  })
  @IsOptional()
  @IsEnum(NotificationChannelDto)
  channel?: NotificationChannelDto;
}
