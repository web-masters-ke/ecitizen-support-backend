import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import {
  SendNotificationDto,
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  QueryNotificationsDto,
  QueryNotificationTemplatesDto,
  NotificationChannelDto,
} from './dto/notifications.dto';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // ============================================
  // Send Notification
  // ============================================

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a notification' })
  @ApiResponse({ status: 201, description: 'Notification created and dispatched' })
  async sendNotification(@Body() dto: SendNotificationDto) {
    const notification = await this.notificationsService.sendNotification(dto);
    return {
      success: true,
      message: 'Notification dispatched',
      data: notification,
    };
  }

  // ============================================
  // Notification Templates (must be before :id route)
  // ============================================

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a notification template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  async createTemplate(@Body() dto: CreateNotificationTemplateDto) {
    const template = await this.notificationsService.createTemplate(dto);
    return {
      success: true,
      message: 'Notification template created successfully',
      data: template,
    };
  }

  @Get('templates')
  @ApiOperation({ summary: 'List notification templates' })
  @ApiQuery({ name: 'agencyId', required: false })
  @ApiQuery({ name: 'channel', required: false, enum: NotificationChannelDto })
  async findTemplates(@Query() query: QueryNotificationTemplatesDto) {
    const templates = await this.notificationsService.findTemplates(query);
    return {
      success: true,
      data: templates,
    };
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Update a notification template' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    const template = await this.notificationsService.updateTemplate(id, dto);
    return {
      success: true,
      message: 'Notification template updated successfully',
      data: template,
    };
  }

  // ============================================
  // List Notifications
  // ============================================

  @Get()
  @ApiOperation({ summary: 'List notifications with optional filters' })
  @ApiQuery({ name: 'agencyId', required: false })
  @ApiQuery({ name: 'channel', required: false, enum: NotificationChannelDto })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findNotifications(@Query() query: QueryNotificationsDto) {
    const result = await this.notificationsService.findNotifications(query);
    return {
      success: true,
      data: result.items,
      meta: result.meta,
    };
  }

  // ============================================
  // Get Single Notification (with delivery logs)
  // ============================================

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single notification with all delivery logs',
  })
  @ApiResponse({ status: 200, description: 'Notification found' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async findNotificationById(@Param('id', ParseUUIDPipe) id: string) {
    const notification =
      await this.notificationsService.findNotificationById(id);
    return {
      success: true,
      data: notification,
    };
  }
}
