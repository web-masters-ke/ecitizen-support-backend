import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsEnum,
  IsInt,
  IsArray,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum KbVisibilityEnum {
  PUBLIC = 'PUBLIC',
  AGENCY_INTERNAL = 'AGENCY_INTERNAL',
  AGENT_ONLY = 'AGENT_ONLY',
}

// ─── Category DTOs ───────────────────────────────────────────────────────────

export class CreateKbCategoryDto {
  @ApiProperty({ example: 'Passport Services' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @ApiPropertyOptional({ description: 'URL-friendly slug for the category' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;
}

export class QueryKbCategoriesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Article DTOs ────────────────────────────────────────────────────────────

export class CreateKbArticleDto {
  @ApiProperty({ example: 'How to Apply for a Passport' })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Step-by-step guide for passport application...' })
  @IsString()
  @MinLength(10)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: KbVisibilityEnum, default: KbVisibilityEnum.PUBLIC })
  @IsOptional()
  @IsEnum(KbVisibilityEnum)
  visibility?: KbVisibilityEnum;

  @ApiPropertyOptional({ type: [String], example: ['passport', 'immigration'] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  tagIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}

export class UpdateKbArticleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: KbVisibilityEnum })
  @IsOptional()
  @IsEnum(KbVisibilityEnum)
  visibility?: KbVisibilityEnum;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  tagIds?: string[];
}

export class QueryKbArticlesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: KbVisibilityEnum })
  @IsOptional()
  @IsEnum(KbVisibilityEnum)
  visibility?: KbVisibilityEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  publishedOnly?: boolean;

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

// ─── Article Version ─────────────────────────────────────────────────────────

export class CreateKbArticleVersionDto {
  @ApiProperty({ example: 'Updated content for the article...' })
  @IsString()
  @MinLength(10)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ example: 'Updated eligibility requirements section' })
  @IsOptional()
  @IsString()
  changeNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export class CreateKbFeedbackDto {
  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  wasHelpful?: boolean;

  @ApiPropertyOptional({ example: 'Very clear instructions!' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedbackComment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export class CreateKbTagDto {
  @ApiProperty({ example: 'passport' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'URL-friendly slug for the tag' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  slug?: string;
}

export class QueryKbTagsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;
}
