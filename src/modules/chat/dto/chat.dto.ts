import { IsString, IsOptional, IsEnum, IsUUID, IsEmail } from 'class-validator';

export enum ChatRoomTypeDto {
  TICKET = 'TICKET',
  ONBOARDING = 'ONBOARDING',
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

export class SendMessageDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

export class AddParticipantDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
