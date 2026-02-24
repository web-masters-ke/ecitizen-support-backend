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
import { WorkflowService } from './workflow.service';
import {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  CreateAutomationActionDto,
} from './dto/workflow.dto';

@ApiTags('Workflow')
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // ============================================
  // Automation Rules
  // ============================================

  @Post('automation-rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an automation rule' })
  @ApiResponse({ status: 201, description: 'Automation rule created' })
  async createRule(@Body() dto: CreateAutomationRuleDto) {
    const rule = await this.workflowService.createRule(dto);
    return {
      success: true,
      message: 'Automation rule created successfully',
      data: rule,
    };
  }

  @Get('automation-rules')
  @ApiOperation({ summary: 'List automation rules, optionally filtered by agency' })
  @ApiQuery({ name: 'agencyId', required: false })
  @ApiQuery({ name: 'triggerEvent', required: false })
  async findRules(
    @Query('agencyId') agencyId?: string,
    @Query('triggerEvent') triggerEvent?: string,
  ) {
    const rules = await this.workflowService.findRules(agencyId, triggerEvent);
    return {
      success: true,
      data: rules,
    };
  }

  @Patch('automation-rules/:id')
  @ApiOperation({ summary: 'Update an automation rule' })
  @ApiResponse({ status: 200, description: 'Rule updated' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAutomationRuleDto,
  ) {
    const rule = await this.workflowService.updateRule(id, dto);
    return {
      success: true,
      message: 'Automation rule updated successfully',
      data: rule,
    };
  }

  @Post('automation-rules/:id/actions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an action to an automation rule' })
  async addAction(
    @Param('id', ParseUUIDPipe) ruleId: string,
    @Body() dto: CreateAutomationActionDto,
  ) {
    const action = await this.workflowService.addAction(ruleId, dto);
    return {
      success: true,
      message: 'Automation action added successfully',
      data: action,
    };
  }

  // ============================================
  // Workflow Triggers
  // ============================================

  @Get('triggers')
  @ApiOperation({ summary: 'List workflow triggers for a ticket' })
  @ApiQuery({ name: 'ticketId', required: true })
  @ApiResponse({ status: 200, description: 'Triggers retrieved' })
  async findTriggers(@Query('ticketId', ParseUUIDPipe) ticketId: string) {
    const triggers =
      await this.workflowService.findTriggersForTicket(ticketId);
    return {
      success: true,
      data: triggers,
    };
  }
}
