import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SlaService } from './sla.service';
import {
  CreateSlaPolicyDto,
  UpdateSlaPolicyDto,
  CreateSlaRuleDto,
  CreateEscalationMatrixDto,
  SetEscalationLevelsDto,
  QueryBreachesDto,
} from './dto/sla.dto';

@ApiTags('SLA')
@Controller('sla')
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  // ============================================
  // SLA Policies
  // ============================================

  @Post('policies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new SLA policy' })
  @ApiResponse({ status: 201, description: 'SLA policy created' })
  async createPolicy(@Body() dto: CreateSlaPolicyDto) {
    const policy = await this.slaService.createPolicy(dto);
    return {
      success: true,
      message: 'SLA policy created successfully',
      data: policy,
    };
  }

  @Get('policies')
  @ApiOperation({ summary: 'List SLA policies, optionally filtered by agency' })
  @ApiQuery({ name: 'agencyId', required: false })
  async findPolicies(@Query('agencyId') agencyId?: string) {
    const policies = await this.slaService.findPolicies(agencyId);
    return {
      success: true,
      data: policies,
    };
  }

  @Get('policies/:id')
  @ApiOperation({ summary: 'Get a single SLA policy by ID' })
  @ApiResponse({ status: 200, description: 'SLA policy found' })
  @ApiResponse({ status: 404, description: 'SLA policy not found' })
  async findPolicyById(@Param('id', ParseUUIDPipe) id: string) {
    const policy = await this.slaService.findPolicyById(id);
    return {
      success: true,
      data: policy,
    };
  }

  @Patch('policies/:id')
  @ApiOperation({ summary: 'Update an SLA policy' })
  async updatePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSlaPolicyDto,
  ) {
    const policy = await this.slaService.updatePolicy(id, dto);
    return {
      success: true,
      message: 'SLA policy updated successfully',
      data: policy,
    };
  }

  @Post('policies/:id/rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a rule to an SLA policy' })
  async addRule(
    @Param('id', ParseUUIDPipe) policyId: string,
    @Body() dto: CreateSlaRuleDto,
  ) {
    const rule = await this.slaService.addRule(policyId, dto);
    return {
      success: true,
      message: 'SLA rule added successfully',
      data: rule,
    };
  }

  // ============================================
  // SLA Tracking
  // ============================================

  @Get('tracking/:ticketId')
  @ApiOperation({ summary: 'Get SLA tracking status for a ticket' })
  @ApiResponse({ status: 200, description: 'SLA tracking found' })
  @ApiResponse({ status: 404, description: 'No SLA tracking for this ticket' })
  async getTracking(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
    const tracking = await this.slaService.getTrackingForTicket(ticketId);
    return {
      success: true,
      data: tracking,
    };
  }

  // ============================================
  // Breaches
  // ============================================

  @Get('breaches')
  @ApiOperation({ summary: 'List SLA breaches, optionally filtered by agency' })
  @ApiQuery({ name: 'agencyId', required: false })
  @ApiQuery({ name: 'breachType', required: false, enum: ['RESPONSE', 'RESOLUTION'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findBreaches(@Query() query: QueryBreachesDto) {
    const result = await this.slaService.findBreaches(query);
    return {
      success: true,
      data: result.items,
      meta: result.meta,
    };
  }

  // ============================================
  // Escalation Matrix
  // ============================================

  @Post('escalation-matrix')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an escalation matrix for an agency' })
  async createEscalationMatrix(@Body() dto: CreateEscalationMatrixDto) {
    const matrix = await this.slaService.createEscalationMatrix(dto);
    return {
      success: true,
      message: 'Escalation matrix created successfully',
      data: matrix,
    };
  }

  @Get('escalation-matrix')
  @ApiOperation({ summary: 'List escalation matrices, optionally filtered by agency' })
  @ApiQuery({ name: 'agencyId', required: false })
  async findEscalationMatrices(@Query('agencyId') agencyId?: string) {
    const matrices = await this.slaService.findEscalationMatrices(agencyId);
    return {
      success: true,
      data: matrices,
    };
  }

  @Put('escalation-matrix/:id/levels')
  @ApiOperation({ summary: 'Set escalation levels for a matrix (replaces existing)' })
  async setEscalationLevels(
    @Param('id', ParseUUIDPipe) matrixId: string,
    @Body() dto: SetEscalationLevelsDto,
  ) {
    const matrix = await this.slaService.setEscalationLevels(matrixId, dto);
    return {
      success: true,
      message: 'Escalation levels updated successfully',
      data: matrix,
    };
  }
}
