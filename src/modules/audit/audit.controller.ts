import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import {
  QueryAuditLogsDto,
  QueryUserActivityDto,
  QueryDataAccessDto,
} from './dto/audit.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({
    summary: 'Get audit logs',
    description:
      'Returns paginated audit logs with optional filters for entity type, entity ID, action type, performer, and date range.',
  })
  getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.auditService.getAuditLogs(query);
  }

  @Get('logs/:id')
  @ApiOperation({ summary: 'Get a single audit log by ID' })
  getAuditLogById(@Param('id', ParseIntPipe) id: number) {
    return this.auditService.getAuditLogById(id);
  }

  @Get('user-activity')
  @ApiOperation({
    summary: 'Get user activity logs',
    description:
      'Returns all activity logs for a given user including login, ticket views, status changes, etc.',
  })
  getUserActivity(@Query() query: QueryUserActivityDto) {
    return this.auditService.getUserActivity(query);
  }

  @Get('data-access')
  @ApiOperation({
    summary: 'Get data access logs',
    description:
      'Returns records of when a user accessed, exported, or downloaded sensitive data.',
  })
  getDataAccessLogs(@Query() query: QueryDataAccessDto) {
    return this.auditService.getDataAccessLogs(query);
  }
}
