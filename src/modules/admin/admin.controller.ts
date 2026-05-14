import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
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
  UpdateRoleDto,
  SetPermissionsDto,
  CreatePermissionDto,
  UpdatePermissionDto,
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

  // Rename a role or update its description. System roles (isSystemRole=true)
  // can be re-described but not renamed — the name is used as a hardcoded
  // permission key in some guards.
  @Patch('roles/:id')
  @ApiOperation({ summary: 'Update role name / description' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Role updated' })
  @SwaggerResponse({ status: 400, description: 'Cannot rename a system role' })
  @SwaggerResponse({ status: 404, description: 'Role not found' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.adminService.updateRole(id, dto);
  }

  // Delete a custom role. System roles can't be deleted. Will fail if any
  // user still has the role assigned — caller should reassign users first.
  @Delete('roles/:id')
  @ApiOperation({ summary: 'Delete a custom role' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Role deleted' })
  @SwaggerResponse({ status: 400, description: 'Cannot delete a system role or one that is still assigned to users' })
  @SwaggerResponse({ status: 404, description: 'Role not found' })
  @HttpCode(HttpStatus.OK)
  async deleteRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteRole(id);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all available permissions' })
  @SwaggerResponse({ status: 200, description: 'List of permissions' })
  async listPermissions() {
    return this.adminService.listPermissions();
  }

  // Full CRUD on the Permission catalogue. Permissions are atomic capabilities
  // (e.g. ticket:create, ticket:assign, user:read). Composed into Roles via
  // PUT /admin/roles/:id/permissions above.
  @Post('permissions')
  @ApiOperation({ summary: 'Create a new permission' })
  @SwaggerResponse({ status: 201, description: 'Permission created' })
  @SwaggerResponse({ status: 409, description: 'Permission with this resource+action already exists' })
  async createPermission(@Body() dto: CreatePermissionDto) {
    return this.adminService.createPermission(dto);
  }

  @Patch('permissions/:id')
  @ApiOperation({ summary: 'Update a permission' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Permission updated' })
  @SwaggerResponse({ status: 404, description: 'Permission not found' })
  async updatePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.adminService.updatePermission(id, dto);
  }

  @Delete('permissions/:id')
  @ApiOperation({ summary: 'Delete a permission' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Permission deleted' })
  @SwaggerResponse({ status: 400, description: 'Permission is still attached to roles' })
  @SwaggerResponse({ status: 404, description: 'Permission not found' })
  @HttpCode(HttpStatus.OK)
  async deletePermission(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deletePermission(id);
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
  @ApiOperation({
    summary:
      'Bulk import users from CSV. Columns: email,userType,firstName,lastName,phoneNumber,nationalId,businessRegistrationNo,ecitizenUserId,password,agencyId,departmentId,roleIds (semicolon-separated UUIDs)',
  })
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.OK)
  async importUsers(@UploadedFile() file: Express.Multer.File, @CurrentUser('sub') adminUserId: string) {
    if (!file) throw new BadRequestException('No file uploaded');
    const rows = parseCsv(file.buffer.toString('utf-8'));
    if (rows.length === 0) throw new BadRequestException('CSV is empty');
    const headers = rows[0].map((h) => h.trim());
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (let i = 1; i < rows.length; i++) {
      const vals = rows[i];
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (vals[idx] ?? '').trim(); });

      if (!row.email) {
        results.errors.push(`Row ${i + 1}: missing required field 'email'`);
        results.skipped++;
        continue;
      }

      const userType = row.userType
        ? (row.userType.toUpperCase() as UserTypeEnum)
        : UserTypeEnum.AGENCY_AGENT;
      if (!Object.values(UserTypeEnum).includes(userType)) {
        results.errors.push(`Row ${i + 1}: invalid userType "${row.userType}" — allowed: ${Object.values(UserTypeEnum).join(', ')}`);
        results.skipped++;
        continue;
      }

      const roleIds = row.roleIds
        ? row.roleIds.split(';').map((s) => s.trim()).filter(Boolean)
        : undefined;

      try {
        await this.usersService.create(
          {
            email: row.email,
            userType,
            firstName: row.firstName || undefined,
            lastName: row.lastName || undefined,
            phoneNumber: row.phoneNumber || undefined,
            nationalId: row.nationalId || undefined,
            businessRegistrationNo: row.businessRegistrationNo || undefined,
            ecitizenUserId: row.ecitizenUserId || undefined,
            password: row.password || undefined,
            agencyId: row.agencyId || undefined,
            departmentId: row.departmentId || undefined,
            roleIds,
          },
          adminUserId,
        );
        results.created++;
      } catch (e: any) {
        results.skipped++;
        results.errors.push(`Row ${i + 1} (${row.email}): ${e.message}`);
      }
    }
    return results;
  }
}

// ─── Tiny RFC-4180-lite CSV parser ────────────────────────────────────
// Handles "quoted, fields", "escaped ""quotes""", and Windows line endings.
// Address fields and agency names routinely contain commas, so naive
// split(',') drops data silently — this is the minimum we need to be
// tolerant of admin-prepared spreadsheets.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') {
        row.push(cell); cell = '';
        if (row.some((v) => v.length > 0)) rows.push(row);
        row = [];
      } else { cell += c; }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((v) => v.length > 0)) rows.push(row);
  }
  return rows;
}
