import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  AssignTicketDto,
  EscalateTicketDto,
  ResolveTicketDto,
  CloseTicketDto,
  ReopenTicketDto,
  CreateMessageDto,
  CreateAttachmentDto,
  AddTagsDto,
  TicketFilterDto,
  CategoryFilterDto,
  MessageFilterDto,
} from './dto/tickets.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ============================================
// Tickets Controller
// ============================================

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // ------------------------------------------
  // POST /api/v1/tickets - Create a ticket
  // ------------------------------------------

  @Post()
  @ApiOperation({
    summary: 'Create a new ticket',
    description: 'Citizen or agent submits a new service request ticket. Generates a unique ticket number in ESCC-YYYYMMDD-XXXXX format.',
  })
  @SwaggerResponse({ status: 201, description: 'Ticket created successfully' })
  @SwaggerResponse({ status: 400, description: 'Invalid input data' })
  @SwaggerResponse({ status: 401, description: 'Authentication required' })
  async createTicket(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.createTicket(dto, user.sub);
  }

  // ------------------------------------------
  // GET /api/v1/tickets - Paginated list with filters
  // ------------------------------------------

  @Get()
  @ApiOperation({
    summary: 'List tickets with filters',
    description: 'Returns a paginated list of tickets. Supports filtering by status, agency, priority, assignee, channel, date range, and full-text search.',
  })
  @SwaggerResponse({ status: 200, description: 'Paginated ticket list' })
  async findAll(
    @Query() filters: TicketFilterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.findAll(filters, user.agencyId);
  }

  // ------------------------------------------
  // GET /api/v1/tickets/:id - Full ticket detail
  // ------------------------------------------

  @Get(':id')
  @ApiOperation({
    summary: 'Get ticket details',
    description: 'Returns full ticket detail including messages, assignments, history, SLA tracking, and AI classification data.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Ticket ID' })
  @SwaggerResponse({ status: 200, description: 'Ticket details' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.findById(id);
  }

  // ------------------------------------------
  // PATCH /api/v1/tickets/:id - Update ticket fields
  // ------------------------------------------

  @Patch(':id')
  @ApiOperation({
    summary: 'Update ticket fields',
    description: 'Update editable fields on a ticket (subject, description, category, priority, department, channel). Cannot update closed/rejected tickets.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Ticket updated' })
  @SwaggerResponse({ status: 400, description: 'Invalid update or ticket in closed state' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  async updateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.updateTicket(id, dto, user.sub);
  }

  // ------------------------------------------
  // POST /api/v1/tickets/:id/assign - Assign to agent
  // ------------------------------------------

  @Post(':id/assign')
  @ApiOperation({
    summary: 'Assign ticket to an agent',
    description: 'Assigns the ticket to a specific agent. Transitions OPEN/REOPENED tickets to ASSIGNED status. Creates assignment history record.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Ticket assigned' })
  @SwaggerResponse({ status: 400, description: 'Invalid assignment' })
  @SwaggerResponse({ status: 404, description: 'Ticket or agent not found' })
  @HttpCode(HttpStatus.OK)
  async assignTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.assignTicket(id, dto, user.sub);
  }

  // ------------------------------------------
  // POST /api/v1/tickets/:id/escalate - Escalate to L2+
  // ------------------------------------------

  @Post(':id/escalate')
  @ApiOperation({
    summary: 'Escalate ticket',
    description: 'Escalates the ticket to the next level. Increments escalation level, transitions to ESCALATED status, and creates an escalation event record.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Ticket escalated' })
  @SwaggerResponse({ status: 400, description: 'Invalid escalation transition' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  @HttpCode(HttpStatus.OK)
  async escalateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EscalateTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.escalateTicket(id, dto, user.sub);
  }

  // ------------------------------------------
  // POST /api/v1/tickets/:id/resolve - Mark resolved
  // ------------------------------------------

  @Post(':id/resolve')
  @ApiOperation({
    summary: 'Resolve ticket',
    description: 'Marks the ticket as resolved. Sets resolvedAt timestamp and records resolution notes.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Ticket resolved' })
  @SwaggerResponse({ status: 400, description: 'Invalid status transition' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  @HttpCode(HttpStatus.OK)
  async resolveTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.resolveTicket(id, dto, user.sub);
  }

  // ------------------------------------------
  // POST /api/v1/tickets/:id/close - Close ticket
  // ------------------------------------------

  @Post(':id/close')
  @ApiOperation({
    summary: 'Close ticket',
    description: 'Closes the ticket. Sets closedAt timestamp. Typically done after citizen confirms resolution.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Ticket closed' })
  @SwaggerResponse({ status: 400, description: 'Invalid status transition' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  @HttpCode(HttpStatus.OK)
  async closeTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.closeTicket(id, dto, user.sub);
  }

  // ------------------------------------------
  // POST /api/v1/tickets/:id/reopen - Reopen ticket
  // ------------------------------------------

  @Post(':id/reopen')
  @ApiOperation({
    summary: 'Reopen a closed ticket',
    description: 'Reopens a previously closed or resolved ticket. Increments reopenCount and clears resolvedAt/closedAt timestamps. Requires a reason.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Ticket reopened' })
  @SwaggerResponse({ status: 400, description: 'Invalid status transition' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  @HttpCode(HttpStatus.OK)
  async reopenTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.reopenTicket(id, dto, user.sub);
  }

  // ------------------------------------------
  // POST /api/v1/tickets/:id/messages - Add message
  // ------------------------------------------

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Add a message or comment to a ticket',
    description: 'Adds a comment, status change note, escalation note, or system update message to the ticket. Internal messages are only visible to agents.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 201, description: 'Message added' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  async addMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.addMessage(id, dto, user.sub);
  }

  // ------------------------------------------
  // GET /api/v1/tickets/:id/messages - Get messages
  // ------------------------------------------

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Get ticket messages',
    description: 'Returns paginated list of messages for a ticket. Internal messages are hidden from citizens unless the caller is an agent.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Paginated message list' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: MessageFilterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Determine if user is an agent (can see internal messages)
    const agentTypes = [
      'AGENCY_AGENT',
      'SERVICE_PROVIDER_AGENT',
      'COMMAND_CENTER_ADMIN',
      'SUPER_ADMIN',
    ];
    const isAgent = agentTypes.includes(user.userType);

    return this.ticketsService.getMessages(id, filters, isAgent);
  }

  // ------------------------------------------
  // GET /api/v1/tickets/:id/history - Status change history
  // ------------------------------------------

  @Get(':id/history')
  @ApiOperation({
    summary: 'Get ticket status change history',
    description: 'Returns the chronological history of all status changes for a ticket, including who made the change and the reason.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'Paginated history list' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  async getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.ticketsService.getHistory(id, pagination.page, pagination.limit);
  }

  // ------------------------------------------
  // POST /api/v1/tickets/:id/attachments - Upload attachment
  // ------------------------------------------

  @Post(':id/attachments')
  @ApiOperation({
    summary: 'Add an attachment to a ticket',
    description: 'Creates an attachment record and returns a presigned storage URL for the client to upload the file directly to object storage.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 201, description: 'Attachment record created with upload URL' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  async addAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAttachmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.addAttachment(id, dto, user.sub);
  }

  // ------------------------------------------
  // GET /api/v1/tickets/:id/attachments - Get attachments
  // ------------------------------------------

  @Get(':id/attachments')
  @ApiOperation({
    summary: 'Get ticket attachments',
    description: 'Returns all file attachments associated with a ticket.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 200, description: 'List of attachments' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  async getAttachments(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.getAttachments(id);
  }

  // ------------------------------------------
  // POST /api/v1/tickets/:id/tags - Add tags
  // ------------------------------------------

  @Post(':id/tags')
  @ApiOperation({
    summary: 'Add tags to a ticket',
    description: 'Adds one or more tags to a ticket. Creates new tags if they do not already exist for the agency.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @SwaggerResponse({ status: 201, description: 'Tags added' })
  @SwaggerResponse({ status: 404, description: 'Ticket not found' })
  async addTags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTagsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.addTags(id, dto, user.agencyId!);
  }

  // ------------------------------------------
  // DELETE /api/v1/tickets/:id/tags/:tagId - Remove tag
  // ------------------------------------------

  @Delete(':id/tags/:tagId')
  @ApiOperation({
    summary: 'Remove a tag from a ticket',
    description: 'Removes the association between a tag and a ticket. Does not delete the tag itself.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Ticket ID' })
  @ApiParam({ name: 'tagId', type: 'string', format: 'uuid', description: 'Tag ID to remove' })
  @SwaggerResponse({ status: 200, description: 'Tag removed' })
  @SwaggerResponse({ status: 404, description: 'Ticket or tag association not found' })
  @HttpCode(HttpStatus.OK)
  async removeTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    return this.ticketsService.removeTag(id, tagId);
  }
}

// ============================================
// Lookup Tables Controller
// ============================================

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TicketLookupsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // ------------------------------------------
  // GET /api/v1/ticket-categories - List categories
  // ------------------------------------------

  @Get('ticket-categories')
  @ApiOperation({
    summary: 'List ticket categories',
    description: 'Returns all ticket categories, optionally filtered by agency ID. Used to populate category dropdowns.',
  })
  @SwaggerResponse({ status: 200, description: 'List of categories' })
  async getCategories(@Query() filters: CategoryFilterDto) {
    return this.ticketsService.getCategories(filters);
  }

  // ------------------------------------------
  // GET /api/v1/ticket-priorities - List priority levels
  // ------------------------------------------

  @Get('ticket-priorities')
  @ApiOperation({
    summary: 'List ticket priority levels',
    description: 'Returns all available priority levels (LOW, MEDIUM, HIGH, CRITICAL) with their severity scores.',
  })
  @SwaggerResponse({ status: 200, description: 'List of priority levels' })
  async getPriorities() {
    return this.ticketsService.getPriorities();
  }

  // ------------------------------------------
  // GET /api/v1/ticket-statuses - List statuses
  // ------------------------------------------

  @Get('ticket-statuses')
  @ApiOperation({
    summary: 'List ticket statuses',
    description: 'Returns all available ticket statuses (OPEN, ASSIGNED, IN_PROGRESS, etc.).',
  })
  @SwaggerResponse({ status: 200, description: 'List of ticket statuses' })
  async getStatuses() {
    return this.ticketsService.getStatuses();
  }
}
