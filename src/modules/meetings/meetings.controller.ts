import { Controller, Post, Patch, Get, Param, Req, UseGuards } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Meetings')
@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post('ticket/:ticketId/start')
  start(@Param('ticketId') ticketId: string, @Req() req: any) {
    return this.meetingsService.startMeeting(ticketId, req.user.id);
  }

  @Patch(':id/end')
  end(@Param('id') id: string) {
    return this.meetingsService.endMeeting(id);
  }

  @Get('ticket/:ticketId')
  forTicket(@Param('ticketId') ticketId: string) {
    return this.meetingsService.getForTicket(ticketId);
  }

  @Get('ticket/:ticketId/active')
  active(@Param('ticketId') ticketId: string) {
    return this.meetingsService.getActive(ticketId);
  }
}
