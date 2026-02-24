import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportingService } from './reporting.service';
import {
  QueryDashboardMetricsDto,
  QuerySlaReportDto,
  QueryAgencyPerformanceDto,
  QueryTicketMetricsHourlyDto,
  QueryTicketMetricsDailyDto,
  QueryUserPerformanceDto,
  CreateExportRequestDto,
  QuerySnapshotsDto,
} from './dto/reporting.dto';

@ApiTags('Reporting')
@ApiBearerAuth()
@Controller('reports')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('dashboard/metrics')
  @ApiOperation({
    summary: 'Get national dashboard metrics',
    description:
      'Returns high-level overview: total open tickets, resolved in 24h, SLA compliance, active incidents, avg resolution time, and breakdowns by status/priority/channel.',
  })
  getDashboardMetrics(@Query() query: QueryDashboardMetricsDto) {
    return this.reportingService.getDashboardMetrics(query);
  }

  @Get('sla')
  @ApiOperation({
    summary: 'Get SLA performance report',
    description:
      'Returns SLA compliance metrics with daily breakdown of response/resolution met/breached.',
  })
  getSlaReport(@Query() query: QuerySlaReportDto) {
    return this.reportingService.getSlaReport(query);
  }

  @Get('agency-performance')
  @ApiOperation({
    summary: 'Get agency performance metrics',
    description:
      'Returns historical performance metrics and live stats for an agency, including resolution rates, SLA compliance, and satisfaction scores.',
  })
  getAgencyPerformance(@Query() query: QueryAgencyPerformanceDto) {
    return this.reportingService.getAgencyPerformance(query);
  }

  @Get('ticket-metrics/hourly')
  @ApiOperation({
    summary: 'Get hourly ticket metrics',
    description:
      'Returns ticket volume, resolution, escalation, and response time metrics aggregated by hour.',
  })
  getTicketMetricsHourly(@Query() query: QueryTicketMetricsHourlyDto) {
    return this.reportingService.getTicketMetricsHourly(query);
  }

  @Get('ticket-metrics/daily')
  @ApiOperation({
    summary: 'Get daily ticket metrics',
    description:
      'Returns ticket volume, resolution, escalation, breaches, and response time metrics aggregated by day.',
  })
  getTicketMetricsDaily(@Query() query: QueryTicketMetricsDailyDto) {
    return this.reportingService.getTicketMetricsDaily(query);
  }

  @Get('user-performance')
  @ApiOperation({
    summary: 'Get user performance metrics',
    description:
      'Returns performance data for a specific agent/user including tickets assigned, resolved, resolution time, and escalation handling.',
  })
  getUserPerformance(@Query() query: QueryUserPerformanceDto) {
    return this.reportingService.getUserPerformance(query);
  }

  @Post('export')
  @ApiOperation({
    summary: 'Generate a report export',
    description:
      'Generates an export of a specified report in CSV or JSON format. Returns the data inline along with a stored snapshot record.',
  })
  createExport(@Body() dto: CreateExportRequestDto) {
    return this.reportingService.createExport(dto);
  }

  @Get('snapshots')
  @ApiOperation({
    summary: 'Get dashboard snapshots',
    description:
      'Returns stored dashboard snapshots, including export history and scheduled report captures.',
  })
  getSnapshots(@Query() query: QuerySnapshotsDto) {
    return this.reportingService.getSnapshots(query);
  }
}
