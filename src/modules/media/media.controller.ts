import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { MediaService } from './media.service';
import {
  UploadMediaDto,
  PresignUploadDto,
  SearchMediaDto,
  SoftDeleteMediaDto,
} from './dto/media.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Multer configuration
const multerOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
  },
  fileFilter: (
    _req: any,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    // Allow common file types
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new Error(`File type ${file.mimetype} is not allowed`),
        false,
      );
    }
  },
};

@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        description: { type: 'string' },
      },
    },
  })
  @SwaggerResponse({ status: 201, description: 'File uploaded successfully' })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
    @CurrentUser('sub') userId: string,
  ) {
    if (!file) {
      throw new Error('No file provided');
    }
    return this.mediaService.uploadFile(file, userId, dto.metadata);
  }

  @Post('upload/bulk')
  @ApiOperation({ summary: 'Upload multiple files (max 20)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @SwaggerResponse({ status: 201, description: 'Files uploaded successfully' })
  @UseInterceptors(FilesInterceptor('files', 20, multerOptions))
  async uploadBulk(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('sub') userId: string,
  ) {
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }
    return this.mediaService.uploadBulk(files, userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search media with filters' })
  @ApiQuery({ name: 'type', required: false, description: 'Media type filter' })
  @ApiQuery({ name: 'userId', required: false, description: 'User ID filter' })
  @ApiQuery({ name: 'fileName', required: false, description: 'File name search' })
  @ApiQuery({ name: 'mimeType', required: false, description: 'MIME type filter' })
  @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerResponse({ status: 200, description: 'Search results' })
  async search(@Query() dto: SearchMediaDto) {
    return this.mediaService.search(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media metadata by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Media metadata' })
  @SwaggerResponse({ status: 404, description: 'Media not found' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.getById(id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'List media for a specific user' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerResponse({ status: 200, description: 'User media list' })
  async getByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.mediaService.getByUserId(userId, page || 1, limit || 20);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a media file' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Media soft-deleted' })
  @SwaggerResponse({ status: 404, description: 'Media not found' })
  @HttpCode(HttpStatus.OK)
  async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SoftDeleteMediaDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.mediaService.softDelete(id, userId, dto);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted media file (within 30 days)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Media restored' })
  @SwaggerResponse({ status: 400, description: 'Restore window expired' })
  @SwaggerResponse({ status: 404, description: 'Media not found' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.mediaService.restore(id, userId);
  }

  @Post('presign')
  @ApiOperation({ summary: 'Generate a presigned URL for direct upload' })
  @SwaggerResponse({ status: 201, description: 'Presigned URL generated' })
  async generatePresignUrl(
    @Body() dto: PresignUploadDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.mediaService.generatePresignUrl(dto, userId);
  }

  @Post('upload/presigned/:token')
  @ApiOperation({ summary: 'Upload file using presigned token' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'token', type: 'string' })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadPresigned(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No file provided');
    }
    return this.mediaService.confirmPresignUpload(token, file);
  }
}
