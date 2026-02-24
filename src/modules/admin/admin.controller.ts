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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
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
  constructor(private readonly adminService: AdminService) {}

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
}
