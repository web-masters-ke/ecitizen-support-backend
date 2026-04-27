import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiConsumes } from '@nestjs/swagger';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { UserTypeEnum } from '../users/dto/users.dto';
import {
  DateRangeDto,
  SlaOverrideDto,
  TicketReassignDto,
  TicketPriorityChangeDto,
  TicketSearchDto,
  CreateRoleDto,
  SetPermissionsDto,
  UpdateSlaPolicyDto,
  UpdateEscalationPolicyDto,
} from './dto/admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMMAND_CENTER_ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
  ) {}

  // ============================================
  // DASHBOARD METRICS
  // ============================================

  @Get('dashboard/metrics')
  @ApiOperation({ summary: 'Get national overview dashboard metrics' })
  @SwaggerResponse({ status: 200, description: 'Dashboard metrics' })
  async getDashboardMetrics(@Query() dto: DateRangeDto) {
    return this.adminService.getDashboardMetrics(dto);
  }

  @Get('dashboard/sla-summary')
  @ApiOperation({ summary: 'Get SLA compliance summary across all agencies' })
  @SwaggerResponse({ status: 200, description: 'SLA summary' })
  async getSlaSummary(@Query() dto: DateRangeDto) {
    return this.adminService.getSlaSummary(dto);
  }

  @Get('dashboard/escalations')
  @ApiOperation({ summary: 'Get escalation summary and recent escalations' })
  @SwaggerResponse({ status: 200, description: 'Escalation summary' })
  async getEscalationSummary(@Query() dto: DateRangeDto) {
    return this.adminService.getEscalationSummary(dto);
  }

  @Get('dashboard/ai-metrics')
  @ApiOperation({ summary: 'Get AI classification and recommendation metrics' })
  @SwaggerResponse({ status: 200, description: 'AI metrics' })
  async getAiMetrics(@Query() dto: DateRangeDto) {
    return this.adminService.getAiMetrics(dto);
  }

  // ============================================
  // TICKET OPERATIONS
  // ============================================

  @Put('tickets/:id/override')
  @ApiOperation({ summary: 'Override SLA deadlines for a ticket' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'SLA override applied' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  @HttpCode(HttpStatus.OK)
  async overrideSla(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SlaOverrideDto,
    @CurrentUser('sub') adminUserId: string,
  ) {
    return this.adminService.overrideSla(id, dto, adminUserId);
  }

  @Put('tickets/:id/reassign')
  @ApiOperation({ summary: 'Cross-agency ticket reassignment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Ticket reassigned' })
  @SwaggerResponse({ status: 404, description: 'Ticket or agency not found' })
  @HttpCode(HttpStatus.OK)
  async reassignTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TicketReassignDto,
    @CurrentUser('sub') adminUserId: string,
  ) {
    return this.adminService.reassignTicket(id, dto, adminUserId);
  }

  @Put('tickets/:id/priority')
  @ApiOperation({ summary: 'Change ticket priority' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Priority changed' })
  @SwaggerResponse({ status: 404, description: 'Ticket or priority not found' })
  @HttpCode(HttpStatus.OK)
  async changeTicketPriority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TicketPriorityChangeDto,
    @CurrentUser('sub') adminUserId: string,
  ) {
    return this.adminService.changeTicketPriority(id, dto, adminUserId);
  }

  @Get('tickets/search')
  @ApiOperation({ summary: 'Cross-agency ticket search' })
  @SwaggerResponse({ status: 200, description: 'Search results' })
  async searchTickets(@Query() dto: TicketSearchDto) {
    return this.adminService.searchTickets(dto);
  }

  // ============================================
  // ROLES & PERMISSIONS
  // ============================================

  @Get('roles')
  @ApiOperation({ summary: 'List all roles with permissions' })
  @SwaggerResponse({ status: 200, description: 'List of roles' })
  async listRoles() {
    return this.adminService.listRoles();
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create a custom role' })
  @SwaggerResponse({ status: 201, description: 'Role created' })
  @SwaggerResponse({ status: 409, description: 'Role name already exists' })
  async createRole(@Body() dto: CreateRoleDto) {
    return this.adminService.createRole(dto);
  }

  @Put('roles/:id/permissions')
  @ApiOperation({ summary: 'Set permissions for a role (replaces all existing)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Permissions updated' })
  @SwaggerResponse({ status: 404, description: 'Role not found' })
  @HttpCode(HttpStatus.OK)
  async setRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPermissionsDto,
  ) {
    return this.adminService.setRolePermissions(id, dto);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all available permissions' })
  @SwaggerResponse({ status: 200, description: 'List of permissions' })
  async listPermissions() {
    return this.adminService.listPermissions();
  }

  // ============================================
  // POLICIES
  // ============================================

  @Put('policies/sla')
  @ApiOperation({ summary: 'Update or create global SLA policy' })
  @SwaggerResponse({ status: 200, description: 'SLA policy updated' })
  @HttpCode(HttpStatus.OK)
  async updateSlaPolicy(
    @Body() dto: UpdateSlaPolicyDto,
    @CurrentUser('sub') adminUserId: string,
  ) {
    return this.adminService.updateSlaPolicy(dto, adminUserId);
  }

  @Put('policies/escalation')
  @ApiOperation({ summary: 'Update or create escalation policy' })
  @SwaggerResponse({ status: 200, description: 'Escalation policy updated' })
  @HttpCode(HttpStatus.OK)
  async updateEscalationPolicy(
    @Body() dto: UpdateEscalationPolicyDto,
    @CurrentUser('sub') adminUserId: string,
  ) {
    return this.adminService.updateEscalationPolicy(dto, adminUserId);
  }

  // ============================================
  // BULK USER IMPORT
  // ============================================

  @Post('users/import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Bulk import users from CSV. Columns: email,firstName,lastName,userType,agencyId' })
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.OK)
  async importUsers(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const text = file.buffer.toString('utf-8');
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const results = { created: 0, skipped: 0, errors: [] as string[] };
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
      if (!row.email || !row.firstName || !row.lastName) {
        results.errors.push(`Row ${i + 1}: missing required fields`);
        continue;
      }
      try {
        await this.usersService.create({
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          userType: (row.userType as UserTypeEnum) || UserTypeEnum.AGENCY_AGENT,
          agencyId: row.agencyId || undefined,
        });
        results.created++;
      } catch (e: any) {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }
    return results;
  }
}
