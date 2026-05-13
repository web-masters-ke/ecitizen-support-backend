import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
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
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AgenciesService } from './agencies.service';
import {
  CreateAgencyDto,
  UpdateAgencyDto,
  AgencyFilterDto,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateAgencyContactDto,
  SetBusinessHoursDto,
  UpsertAgencySettingDto,
  CreateServiceProviderDto,
  MapServiceProviderDto,
  ServiceProviderFilterDto,
  OnboardAgencyDto,
} from './dto/agencies.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Agencies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  // ============================================================
  //  AGENCIES
  // ============================================================

  @Get('agencies')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT', 'CITIZEN', 'BUSINESS')
  @ApiOperation({
    summary: 'List agencies (paginated)',
    description:
      'Returns a paginated list of agencies. Supports filtering by type, status, county, and free-text search.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of agencies' })
  async findAll(@Query() filters: AgencyFilterDto) {
    return this.agenciesService.findAll(filters);
  }

  // Public, no-auth list used by /report-issue + the citizen submit-a-
  // ticket form. Returns the minimum needed to populate the agency
  // dropdown — no internal contacts, no SLA docs, no settings. Active
  // agencies only.
  @Get('agencies/public')
  @Public()
  @ApiOperation({
    summary: 'Public agency directory (no auth)',
    description:
      'Returns active agencies with just enough fields to populate the citizen-side dropdown: id, agencyName, agencyCode, agencyType. Used by /report-issue.',
  })
  async findAllPublic(@Query() filters: AgencyFilterDto) {
    const result = await this.agenciesService.findAll({
      ...filters,
      isActive: true,
      limit: 500,
    } as AgencyFilterDto);
    const slim = (Array.isArray(result?.data) ? result.data : []).map((a: any) => ({
      id: a.id,
      agencyName: a.agencyName,
      agencyCode: a.agencyCode,
      agencyType: a.agencyType,
    }));
    return { data: slim, meta: result?.meta };
  }

  @Get('agencies/:id')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT', 'CITIZEN', 'BUSINESS')
  @ApiOperation({
    summary: 'Get agency by ID',
    description:
      'Returns full agency details including departments, contacts, settings, business hours, and service provider mappings.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 200, description: 'Agency details' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.findOne(id);
  }

  @Post('agencies')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new agency',
    description: 'Creates a new government agency record.',
  })
  @ApiResponse({ status: 201, description: 'Agency created' })
  @ApiResponse({ status: 409, description: 'Duplicate agency code' })
  async create(
    @Body() dto: CreateAgencyDto,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.agenciesService.create(dto, currentUserId);
  }

  @Post('agencies/onboard')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Onboard a new agency (full setup)',
    description:
      'Creates an agency with departments, admin user, AgencyUser link, role assignment, and 3 default automation rules — all in a single transaction.',
  })
  @ApiResponse({ status: 201, description: 'Agency onboarded successfully' })
  @ApiResponse({ status: 409, description: 'Duplicate agency code or admin email' })
  async onboardAgency(@Body() dto: OnboardAgencyDto) {
    return this.agenciesService.onboardAgency(dto);
  }

  @Patch('agencies/:id')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @ApiOperation({
    summary: 'Update agency',
    description: 'Update agency information. Partial updates supported.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 200, description: 'Agency updated' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgencyDto,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.agenciesService.update(id, dto, currentUserId);
  }

  // ============================================================
  //  DEPARTMENTS
  // ============================================================

  @Get('agencies/:id/departments')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT')
  @ApiOperation({
    summary: 'List departments for agency',
    description: 'Returns all departments belonging to the specified agency.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 200, description: 'List of departments' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async getDepartments(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.getDepartments(id);
  }

  @Get('agencies/:id/users')
  @ApiOperation({
    summary: 'List users in an agency (optionally scoped to a department)',
    description: 'Returns all users assigned to the agency. Pass ?departmentId=<uuid> to scope to one department.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 200, description: 'List of users in the agency' })
  async getAgencyUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.agenciesService.getAgencyUsers(id, departmentId);
  }

  @Post('agencies/:id/departments')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add department to agency',
    description: 'Creates a new department within the specified agency.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 201, description: 'Department created' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  @ApiResponse({ status: 409, description: 'Duplicate department name' })
  async addDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.agenciesService.addDepartment(id, dto);
  }

  @Patch('agencies/:id/departments/:deptId')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @ApiOperation({
    summary: 'Update department',
    description: 'Update a department within the specified agency.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiParam({ name: 'deptId', description: 'Department UUID' })
  @ApiResponse({ status: 200, description: 'Department updated' })
  @ApiResponse({ status: 404, description: 'Agency or department not found' })
  async updateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('deptId', ParseUUIDPipe) deptId: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.agenciesService.updateDepartment(id, deptId, dto);
  }

  // ============================================================
  //  CONTACTS
  // ============================================================

  @Get('agencies/:id/contacts')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT')
  @ApiOperation({
    summary: 'List contacts for agency',
    description: 'Returns all contacts belonging to the specified agency.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 200, description: 'List of contacts' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async getContacts(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.getContacts(id);
  }

  @Post('agencies/:id/contacts')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add contact to agency',
    description: 'Adds a new contact person for the specified agency.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 201, description: 'Contact added' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async addContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAgencyContactDto,
  ) {
    return this.agenciesService.addContact(id, dto);
  }

  // ============================================================
  //  BUSINESS HOURS
  // ============================================================

  @Get('agencies/:id/business-hours')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT')
  @ApiOperation({
    summary: 'Get agency business hours',
    description: 'Returns the business hours configuration for the specified agency.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 200, description: 'Business hours list' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async getBusinessHours(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.getBusinessHours(id);
  }

  // Public availability endpoint — used by the citizen ticket detail page
  // to gate the Call Agent button by the agency's business-hours window.
  // Returns { open, reason?, todayHours? } in Africa/Nairobi.
  @Get('agencies/:id/availability')
  @Public()
  @ApiOperation({
    summary: 'Is this agency open right now?',
    description:
      'Public, no-auth endpoint that tells the citizen UI whether the agency is currently within its configured business hours. Falls back to open=true if no hours are configured.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 200, description: 'Availability snapshot for the agency.' })
  async getAvailability(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.getAgencyAvailability(id);
  }

  @Put('agencies/:id/business-hours')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @ApiOperation({
    summary: 'Set agency business hours',
    description:
      'Replaces the entire business hours configuration for the specified agency. Provide all days that should have business hours.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 200, description: 'Business hours set' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async setBusinessHours(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBusinessHoursDto,
  ) {
    return this.agenciesService.setBusinessHours(id, dto);
  }

  // ============================================================
  //  AGENCY SETTINGS
  // ============================================================

  @Get('agencies/:id/settings')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT')
  @ApiOperation({
    summary: 'List settings for agency',
    description: 'Returns all settings for the specified agency.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 200, description: 'List of agency settings' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async getSettings(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.getSettings(id);
  }

  @Put('agencies/:id/settings')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @ApiOperation({
    summary: 'Update agency setting',
    description:
      'Creates or updates a setting for the specified agency. If the key already exists, the value is updated.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 200, description: 'Setting updated' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async updateSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertAgencySettingDto,
  ) {
    return this.agenciesService.updateSettings(id, dto);
  }

  @Post('agencies/:id/settings')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @ApiOperation({
    summary: 'Upsert agency setting',
    description:
      'Creates or updates a setting for the specified agency. If the key already exists, the value is updated.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 201, description: 'Setting upserted' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  @HttpCode(HttpStatus.CREATED)
  async upsertSetting(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertAgencySettingDto,
  ) {
    return this.agenciesService.upsertSetting(id, dto);
  }

  // ============================================================
  //  SERVICE PROVIDERS (agency-scoped)
  // ============================================================

  @Get('agencies/:id/service-providers')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT')
  @ApiOperation({
    summary: 'List service providers mapped to agency',
    description:
      'Returns all service providers that are mapped to the specified agency.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 200, description: 'Service provider mappings' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async getAgencyServiceProviders(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.getAgencyServiceProviders(id);
  }

  @Post('agencies/:id/service-providers')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Map service provider to agency',
    description:
      'Creates a mapping between an existing service provider and the specified agency.',
  })
  @ApiParam({ name: 'id', description: 'Agency UUID' })
  @ApiResponse({ status: 201, description: 'Service provider mapped' })
  @ApiResponse({ status: 404, description: 'Agency or provider not found' })
  @ApiResponse({ status: 409, description: 'Mapping already exists' })
  async mapServiceProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MapServiceProviderDto,
  ) {
    return this.agenciesService.mapServiceProvider(id, dto);
  }

  // ============================================================
  //  SERVICE PROVIDERS (global)
  // ============================================================

  @Post('service-providers')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create service provider',
    description: 'Creates a new service provider entity (not yet mapped to any agency).',
  })
  @ApiResponse({ status: 201, description: 'Service provider created' })
  @ApiResponse({ status: 409, description: 'Duplicate provider name' })
  async createServiceProvider(@Body() dto: CreateServiceProviderDto) {
    return this.agenciesService.createServiceProvider(dto);
  }

  @Get('service-providers')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT')
  @ApiOperation({
    summary: 'List all service providers (paginated)',
    description:
      'Returns a paginated list of all service providers in the system.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of service providers' })
  async findAllServiceProviders(@Query() filters: ServiceProviderFilterDto) {
    return this.agenciesService.findAllServiceProviders(filters);
  }

  @Get('service-providers/:id')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT')
  @ApiOperation({ summary: 'Get service provider by ID' })
  @ApiParam({ name: 'id', description: 'Service provider UUID' })
  @ApiResponse({ status: 200, description: 'Service provider details' })
  @ApiResponse({ status: 404, description: 'Service provider not found' })
  async findOneServiceProvider(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.findOneServiceProvider(id);
  }

  @Patch('service-providers/:id')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @ApiOperation({ summary: 'Update service provider' })
  @ApiParam({ name: 'id', description: 'Service provider UUID' })
  @ApiResponse({ status: 200, description: 'Service provider updated' })
  @ApiResponse({ status: 404, description: 'Service provider not found' })
  @ApiResponse({ status: 409, description: 'Duplicate provider name' })
  async updateServiceProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateServiceProviderDto,
  ) {
    // Reuse CreateServiceProviderDto with partial semantics — every field
    // on it is already either optional or explicitly handled, and the
    // service treats undefined as "leave unchanged".
    return this.agenciesService.updateServiceProvider(id, dto);
  }

  @Delete('service-providers/:id')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @ApiOperation({
    summary: 'Delete service provider',
    description: 'Hard-deletes a provider with no agency mappings; otherwise soft-deactivates.',
  })
  @ApiParam({ name: 'id', description: 'Service provider UUID' })
  @ApiResponse({ status: 200, description: 'Service provider deleted or deactivated' })
  @ApiResponse({ status: 404, description: 'Service provider not found' })
  async deleteServiceProvider(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.deleteServiceProvider(id);
  }

  // ============================================================
  //  BULK IMPORT
  // ============================================================

  @Post('agencies/import')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({
    summary:
      'Bulk import agencies from CSV. Columns: agencyCode,agencyName,agencyType,registrationNumber,officialEmail,officialPhone,physicalAddress,county,ministryName,stateDepartment,executiveOrderRef,executiveOrderYear,primaryContactName,primaryContactPhone',
  })
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.OK)
  async importAgencies(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const rows = parseAgencyCsv(file.buffer.toString('utf-8'));
    if (rows.length === 0) throw new BadRequestException('CSV is empty');
    const headers = rows[0].map((h) => h.trim());
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (let i = 1; i < rows.length; i++) {
      const vals = rows[i];
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (vals[idx] ?? '').trim(); });

      if (!row.agencyCode || !row.agencyName || !row.agencyType) {
        results.errors.push(`Row ${i + 1}: missing required fields (agencyCode, agencyName, agencyType)`);
        results.skipped++;
        continue;
      }

      const agencyType = row.agencyType.toUpperCase();
      const allowedTypes = ['MINISTRY', 'DEPARTMENT', 'PARASTATAL', 'COUNTY_GOVERNMENT', 'REGULATORY_BODY', 'SERVICE_PROVIDER', 'INTERNATIONAL_ORG', 'CUSTOM'];
      if (!allowedTypes.includes(agencyType)) {
        results.errors.push(`Row ${i + 1}: invalid agencyType "${row.agencyType}" — allowed: ${allowedTypes.join(', ')}`);
        results.skipped++;
        continue;
      }

      try {
        // Step 1: create with the fields the Create DTO accepts.
        const created = await this.agenciesService.create({
          agencyCode: row.agencyCode,
          agencyName: row.agencyName,
          agencyType: agencyType as any,
          registrationNumber: row.registrationNumber || undefined,
          officialEmail: row.officialEmail || undefined,
          officialPhone: row.officialPhone || undefined,
          physicalAddress: row.physicalAddress || undefined,
          county: row.county || undefined,
          isActive: true,
        });

        // Step 2: extended onboarding fields live on UpdateAgencyDto only.
        // Apply them in a follow-up update so the imported profile matches
        // what the onboarding form captures.
        const hasExtended =
          row.ministryName ||
          row.stateDepartment ||
          row.executiveOrderRef ||
          row.executiveOrderYear ||
          row.primaryContactName ||
          row.primaryContactPhone;
        if (hasExtended) {
          await this.agenciesService.update(created.id, {
            ministryName: row.ministryName || undefined,
            stateDepartment: row.stateDepartment || undefined,
            executiveOrderRef: row.executiveOrderRef || undefined,
            executiveOrderYear: row.executiveOrderYear ? Number(row.executiveOrderYear) : undefined,
            primaryContactName: row.primaryContactName || undefined,
            primaryContactPhone: row.primaryContactPhone || undefined,
          } as any);
        }

        results.created++;
      } catch (e: any) {
        results.skipped++;
        results.errors.push(`Row ${i + 1} (${row.agencyCode}): ${e.message}`);
      }
    }
    return results;
  }
}

// ─── Tiny RFC-4180-lite CSV parser ────────────────────────────────────
// Handles "quoted, fields", "escaped ""quotes""", and Windows line endings.
function parseAgencyCsv(text: string): string[][] {
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
