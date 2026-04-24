import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { CallsService } from './calls.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Calls')
@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post('start')
  start(@Req() req: any, @Body() body: { targetUserId: string; ticketId?: string; agencyId?: string; direction?: string }) {
    return this.callsService.startCall(req.user.id, body.targetUserId, body.ticketId, body.agencyId, body.direction);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string; durationSec?: number; notes?: string }) {
    return this.callsService.updateCall(id, body.status, body.durationSec, body.notes);
  }

  @Get('ticket/:ticketId')
  forTicket(@Param('ticketId') ticketId: string) {
    return this.callsService.getCallsForTicket(ticketId);
  }

  @Get('agency/:agencyId')
  forAgency(@Param('agencyId') agencyId: string) {
    return this.callsService.getCallsForAgency(agencyId);
  }

  @Get('recent')
  recent(@Req() req: any) {
    return this.callsService.getRecentCalls(req.user.id);
  }
}
