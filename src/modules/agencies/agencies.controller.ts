import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
} from './dto/agencies.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

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
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT')
  @ApiOperation({
    summary: 'List agencies (paginated)',
    description:
      'Returns a paginated list of agencies. Supports filtering by type, status, county, and free-text search.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of agencies' })
  async findAll(@Query() filters: AgencyFilterDto) {
    return this.agenciesService.findAll(filters);
  }

  @Get('agencies/:id')
  @Roles('SUPER_ADMIN', 'COMMAND_CENTER_ADMIN', 'AGENCY_AGENT')
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
  async create(@Body() dto: CreateAgencyDto) {
    return this.agenciesService.create(dto);
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
  ) {
    return this.agenciesService.update(id, dto);
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
}
