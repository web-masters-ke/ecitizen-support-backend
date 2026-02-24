import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../config/prisma.service';
import {
  MediaType,
  PresignUploadDto,
  SearchMediaDto,
  SoftDeleteMediaDto,
} from './dto/media.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadDir: string;
  private readonly storageMode: string;
  private readonly baseUrl: string;

  // In-memory presign tokens (production would use Redis)
  private presignTokens: Map<string, {
    fileId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    userId: string;
    expiresAt: Date;
  }> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.storageMode = this.configService.get<string>('STORAGE_MODE', 'local');
    this.baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:4000');
    this.uploadDir = path.resolve(
      this.configService.get<string>('UPLOAD_DIR', './uploads'),
    );

    // Ensure upload directory exists for local storage
    if (this.storageMode === 'local') {
      this.ensureUploadDirectory();
    }
  }

  private ensureUploadDirectory(): void {
    const dirs = [
      this.uploadDir,
      path.join(this.uploadDir, 'images'),
      path.join(this.uploadDir, 'videos'),
      path.join(this.uploadDir, 'audio'),
      path.join(this.uploadDir, 'documents'),
      path.join(this.uploadDir, 'other'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.log(`Created upload directory: ${dir}`);
      }
    }
  }

  /**
   * Classify MIME type into a media type category
   */
  private classifyMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) return MediaType.IMAGE;
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    if (mimeType.startsWith('audio/')) return MediaType.AUDIO;
    if (
      mimeType.startsWith('application/pdf') ||
      mimeType.startsWith('application/msword') ||
      mimeType.startsWith('application/vnd.openxmlformats') ||
      mimeType.startsWith('text/')
    ) {
      return MediaType.DOCUMENT;
    }
    return MediaType.OTHER;
  }

  /**
   * Generate a unique file name preserving the extension
   */
  private generateFileName(originalName: string): string {
    const ext = path.extname(originalName);
    const fileId = uuidv4();
    return `${fileId}${ext}`;
  }

  /**
   * Write file to local disk
   */
  private async writeToLocalDisk(
    buffer: Buffer,
    fileName: string,
    mediaType: MediaType,
  ): Promise<string> {
    const subDir = mediaType;
    const filePath = path.join(this.uploadDir, subDir, fileName);
    await fs.promises.writeFile(filePath, buffer);
    return `${this.baseUrl}/uploads/${subDir}/${fileName}`;
  }

  /**
   * Write file to S3 (placeholder - would use @aws-sdk/client-s3 in production)
   */
  private async writeToS3(
    buffer: Buffer,
    fileName: string,
    mediaType: MediaType,
    mimeType: string,
  ): Promise<string> {
    const bucket = this.configService.get<string>('S3_BUCKET', 'ecitizen-media');
    const region = this.configService.get<string>('S3_REGION', 'af-south-1');
    const keyPrefix = this.configService.get<string>('S3_KEY_PREFIX', 'uploads');

    const s3Key = `${keyPrefix}/${mediaType}/${fileName}`;

    // In production, this would use the AWS SDK:
    // const s3Client = new S3Client({ region });
    // await s3Client.send(new PutObjectCommand({
    //   Bucket: bucket,
    //   Key: s3Key,
    //   Body: buffer,
    //   ContentType: mimeType,
    // }));

    this.logger.log(`[S3 STUB] Would upload to s3://${bucket}/${s3Key}`);

    // Return the S3 URL
    return `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
  }

  /**
   * Store file to the configured storage backend
   */
  private async storeFile(
    buffer: Buffer,
    fileName: string,
    mediaType: MediaType,
    mimeType: string,
  ): Promise<string> {
    if (this.storageMode === 's3') {
      return this.writeToS3(buffer, fileName, mediaType, mimeType);
    }
    return this.writeToLocalDisk(buffer, fileName, mediaType);
  }

  /**
   * Upload a single file
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    metadata?: Record<string, any>,
  ) {
    const fileId = uuidv4();
    const mediaType = this.classifyMediaType(file.mimetype);
    const fileName = this.generateFileName(file.originalname);

    // Store to disk or S3
    const storageUrl = await this.storeFile(
      file.buffer,
      fileName,
      mediaType,
      file.mimetype,
    );

    // Save metadata to DB
    const media = await this.prisma.media.create({
      data: {
        fileId,
        originalName: file.originalname,
        fileName,
        userId,
        mediaType,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        storageUrl,
        metadata: metadata || undefined,
        isActive: true,
        isDeleted: false,
      },
    });

    this.logger.log(
      `File uploaded: ${file.originalname} -> ${fileName} (${mediaType}, ${file.size} bytes)`,
    );

    return this.serializeMedia(media);
  }

  /**
   * Upload multiple files (up to 20)
   */
  async uploadBulk(
    files: Express.Multer.File[],
    userId: string,
  ) {
    if (files.length > 20) {
      throw new BadRequestException('Maximum 20 files allowed per bulk upload');
    }

    const successful: any[] = [];
    const failed: Array<{ originalName: string; error: string }> = [];

    for (const file of files) {
      try {
        const result = await this.uploadFile(file, userId);
        successful.push(result);
      } catch (error) {
        this.logger.error(`Failed to upload ${file.originalname}: ${error.message}`);
        failed.push({
          originalName: file.originalname,
          error: error.message,
        });
      }
    }

    return {
      successful,
      failed,
      totalUploaded: successful.length,
      totalFailed: failed.length,
    };
  }

  /**
   * Get media by ID
   */
  async getById(id: string) {
    const media = await this.prisma.media.findUnique({
      where: { id },
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    return this.serializeMedia(media);
  }

  /**
   * Get all media for a specific user
   */
  async getByUserId(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.media.findMany({
        where: {
          userId,
          isDeleted: false,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.media.count({
        where: {
          userId,
          isDeleted: false,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map(this.serializeMedia),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    } as PaginatedResult<any>;
  }

  /**
   * Search media with filters
   */
  async search(dto: SearchMediaDto) {
    const { type, userId, fileName, mimeType, includeDeleted, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (!includeDeleted) {
      where.isDeleted = false;
    }

    if (type) {
      where.mediaType = type;
    }

    if (userId) {
      where.userId = userId;
    }

    if (fileName) {
      where.originalName = {
        contains: fileName,
        mode: 'insensitive',
      };
    }

    if (mimeType) {
      where.mimeType = {
        contains: mimeType,
        mode: 'insensitive',
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.media.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map(this.serializeMedia),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    } as PaginatedResult<any>;
  }

  /**
   * Soft-delete a media record (sets isDeleted=true, records timestamp)
   */
  async softDelete(id: string, userId: string, dto?: SoftDeleteMediaDto) {
    const media = await this.prisma.media.findUnique({
      where: { id },
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    if (media.isDeleted) {
      throw new BadRequestException('Media is already deleted');
    }

    const updated = await this.prisma.media.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
        deletedBy: userId,
        deletionReason: dto?.reason || null,
      },
    });

    this.logger.log(`Media soft-deleted: ${id} by user ${userId}`);

    return this.serializeMedia(updated);
  }

  /**
   * Restore a soft-deleted media record (within 30-day window)
   */
  async restore(id: string, userId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id },
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    if (!media.isDeleted) {
      throw new BadRequestException('Media is not deleted');
    }

    // Check 30-day restore window
    if (media.deletedAt) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (media.deletedAt < thirtyDaysAgo) {
        throw new BadRequestException(
          'Restore window has expired. Media was deleted more than 30 days ago.',
        );
      }
    }

    const updated = await this.prisma.media.update({
      where: { id },
      data: {
        isDeleted: false,
        isActive: true,
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: new Date(),
        restoredBy: userId,
      },
    });

    this.logger.log(`Media restored: ${id} by user ${userId}`);

    return this.serializeMedia(updated);
  }

  /**
   * Generate a presigned upload URL (token-based for direct upload)
   */
  async generatePresignUrl(dto: PresignUploadDto, userId: string) {
    const fileId = uuidv4();
    const presignToken = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store presign token for verification
    this.presignTokens.set(presignToken, {
      fileId,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      userId,
      expiresAt,
    });

    // Clean up expired tokens periodically
    this.cleanupExpiredTokens();

    if (this.storageMode === 's3') {
      // In production, generate actual S3 presigned URL
      // const command = new PutObjectCommand({
      //   Bucket: bucket,
      //   Key: `uploads/${mediaType}/${fileId}${ext}`,
      //   ContentType: dto.mimeType,
      // });
      // const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      const bucket = this.configService.get<string>('S3_BUCKET', 'ecitizen-media');
      return {
        presignToken,
        uploadUrl: `https://${bucket}.s3.amazonaws.com/uploads/${fileId}?presign=stub`,
        expiresAt,
        fileId,
      };
    }

    // For local storage, return the API endpoint for direct upload
    return {
      presignToken,
      uploadUrl: `${this.baseUrl}/api/v1/media/upload/presigned/${presignToken}`,
      expiresAt,
      fileId,
    };
  }

  /**
   * Confirm and finalize a presigned upload
   */
  async confirmPresignUpload(presignToken: string, file: Express.Multer.File) {
    const tokenData = this.presignTokens.get(presignToken);

    if (!tokenData) {
      throw new BadRequestException('Invalid or expired presign token');
    }

    if (new Date() > tokenData.expiresAt) {
      this.presignTokens.delete(presignToken);
      throw new BadRequestException('Presign token has expired');
    }

    // Upload the file using normal flow
    const result = await this.uploadFile(file, tokenData.userId);

    // Clean up the token
    this.presignTokens.delete(presignToken);

    return result;
  }

  /**
   * Clean up expired presign tokens
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [token, data] of this.presignTokens.entries()) {
      if (now > data.expiresAt) {
        this.presignTokens.delete(token);
      }
    }
  }

  /**
   * Delete file from storage backend
   */
  async permanentDelete(id: string): Promise<void> {
    const media = await this.prisma.media.findUnique({
      where: { id },
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    // Delete from storage
    if (this.storageMode === 'local') {
      const filePath = path.join(
        this.uploadDir,
        media.mediaType,
        media.fileName,
      );
      try {
        await fs.promises.unlink(filePath);
      } catch (error) {
        this.logger.warn(`Failed to delete file from disk: ${filePath}`);
      }
    }

    // Delete from database
    await this.prisma.media.delete({
      where: { id },
    });

    this.logger.log(`Media permanently deleted: ${id}`);
  }

  /**
   * Serialize BigInt fields to numbers for JSON response
   */
  private serializeMedia(media: any) {
    return {
      ...media,
      sizeBytes: Number(media.sizeBytes),
    };
  }
}
