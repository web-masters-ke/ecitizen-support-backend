import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  OTHER = 'other',
}

export class UploadMediaDto {
  @ApiPropertyOptional({ description: 'Reason or context for the upload' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata as JSON' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class PresignUploadDto {
  @ApiProperty({ description: 'Original file name' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: 'MIME type of the file' })
  @IsString()
  mimeType: string;

  @ApiPropertyOptional({ description: 'Content type of the file (alias for mimeType)' })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiPropertyOptional({ description: 'Entity type this media is associated with (e.g. ticket, article)' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiProperty({ description: 'File size in bytes' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(104857600) // 100MB
  sizeBytes: number;
}

export class PresignConfirmDto {
  @ApiProperty({ description: 'Presign token returned from presign endpoint' })
  @IsString()
  presignToken: string;

  @ApiProperty({ description: 'Original file name' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: 'MIME type of the file' })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes: number;
}

export class SearchMediaDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MediaType })
  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Search original file name' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ description: 'Filter by MIME type' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ description: 'Include soft-deleted media' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeDeleted?: boolean = false;
}

export class SoftDeleteMediaDto {
  @ApiPropertyOptional({ description: 'Reason for deletion' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class MediaResponseDto {
  id: string;
  fileId: string;
  originalName: string;
  fileName: string;
  userId: string;
  mediaType: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  metadata: any;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PresignResponseDto {
  @ApiProperty()
  presignToken: string;

  @ApiProperty()
  uploadUrl: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  fileId: string;
}

export class BulkUploadResultDto {
  @ApiProperty()
  successful: MediaResponseDto[];

  @ApiProperty()
  failed: Array<{ originalName: string; error: string }>;

  @ApiProperty()
  totalUploaded: number;

  @ApiProperty()
  totalFailed: number;
}
