import { IsString, IsOptional, IsEnum, IsUUID, IsEmail, IsArray } from 'class-validator';

export enum ChatRoomTypeDto {
  TICKET = 'TICKET',
  ONBOARDING = 'ONBOARDING',
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
  AGENCY_CHANNEL = 'AGENCY_CHANNEL',
}

export class CreateChatRoomDto {
  @IsEnum(ChatRoomTypeDto)
  type: ChatRoomTypeDto;

  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class CreateDirectRoomDto {
  @IsUUID()
  targetUserId: string;
}

export class CreateGroupRoomDto {
  @IsString()
  title: string;

  @IsArray()
  @IsUUID('4', { each: true })
  memberIds: string[];
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsEnum(['TEXT', 'FILE', 'IMAGE', 'VOICE', 'SYSTEM'])
  messageType?: string;
}

export class AddParticipantDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class TypingDto {
  @IsUUID()
  roomId: string;

  @IsOptional()
  isTyping?: boolean;
}
