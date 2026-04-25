import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards, BadRequestException, Logger } from '@nestjs/common';
import { CallsService } from './calls.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Calls')
@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  private readonly logger = new Logger(CallsController.name);
  constructor(private readonly callsService: CallsService) {}

  @Post('start')
  async start(@Req() req: any, @Body() body: { targetUserId: string; ticketId?: string; agencyId?: string; direction?: string }) {
    try {
      return await this.callsService.startCall(req.user.sub, body.targetUserId, body.ticketId, body.agencyId, body.direction);
    } catch (err: any) {
      this.logger.error('calls/start failed', err?.message, err?.stack);
      if (err?.code === 'P2003' || err?.code === 'P2025') {
        throw new BadRequestException('Referenced user, ticket, or agency not found');
      }
      throw err;
    }
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
    return this.callsService.getRecentCalls(req.user.sub);
  }
}
