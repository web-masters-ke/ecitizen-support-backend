import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { MlService } from './ml.service';
import {
  ClassifyTicketMlDto,
  RoutingRecommendationDto,
  SentimentAnalysisDto,
  AnomalyDetectionDto,
  KbSuggestQueryDto,
  ForecastQueryDto,
  RegisterMlModelDto,
  QueryMlPredictionsDto,
} from './dto/ml.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Machine Learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ml')
export class MlController {
  constructor(private readonly mlService: MlService) {}

  // ─── Predictions ───────────────────────────────────────────────────────────

  @Post('predict/classify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Classify a ticket using ML heuristics',
    description:
      'Runs keyword-based rules over the supplied text and ticket record to predict category, subcategory, target agency and severity band. Returns confidence score and extracted features.',
  })
  classifyTicket(
    @Body() dto: ClassifyTicketMlDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.mlService.classifyTicket(dto);
  }

  @Post('predict/routing')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get routing recommendation for a ticket',
    description:
      'Analyses the ticket priority and the target agency SLA breach rate to recommend an agent group and predict resolution time.',
  })
  routingRecommendation(
    @Body() dto: RoutingRecommendationDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.mlService.routingRecommendation(dto);
  }

  @Get('predict/sla-breach/:ticketId')
  @ApiOperation({
    summary: 'Predict SLA breach probability for a ticket',
    description:
      'Calculates how likely a ticket is to breach its SLA based on elapsed time, escalation history and response breach status. Returns risk level and intervention flag.',
  })
  @ApiParam({ name: 'ticketId', description: 'UUID of the ticket', type: 'string' })
  slaBreachPrediction(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.mlService.slaBreachPrediction({ ticketId });
  }

  @Post('predict/sentiment')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Analyse sentiment of a text or ticket',
    description:
      'Returns a sentiment score from -1.0 (very negative) to +1.0 (very positive), emotion tags, escalation risk score and toxicity score.',
  })
  sentimentAnalysis(
    @Body() dto: SentimentAnalysisDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.mlService.sentimentAnalysis(dto);
  }

  @Post('predict/anomaly')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Detect anomalies on a user, agency or ticket',
    description:
      'For USER entities: flags abnormal ticket submission rates. For AGENCY entities: flags elevated SLA breach rates. For TICKET entities: detects duplicate submission patterns.',
  })
  anomalyDetection(
    @Body() dto: AnomalyDetectionDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.mlService.anomalyDetection(dto);
  }

  @Get('predict/kb-suggest/:ticketId')
  @ApiOperation({
    summary: 'Get KB article suggestions for a ticket',
    description:
      'Tokenises the ticket subject and description then scores published KB articles by keyword overlap. Returns the top-N most relevant articles with relevance scores.',
  })
  @ApiParam({ name: 'ticketId', description: 'UUID of the ticket', type: 'string' })
  kbSuggest(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Query() query: KbSuggestQueryDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.mlService.kbSuggest({ ...query, ticketId });
  }

  // ─── Forecast ─────────────────────────────────────────────────────────────

  @Get('forecast/:agencyId')
  @ApiOperation({
    summary: 'Forecast ticket volume for an agency',
    description:
      'Uses the last 30 days of historical ticket data to extrapolate predicted ticket volume for the requested period. Returns confidence interval and seasonal adjustment factors.',
  })
  @ApiParam({ name: 'agencyId', description: 'UUID of the agency', type: 'string' })
  forecast(
    @Param('agencyId', ParseUUIDPipe) agencyId: string,
    @Query() query: ForecastQueryDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.mlService.forecast({ ...query, agencyId });
  }

  // ─── Clusters ─────────────────────────────────────────────────────────────

  @Get('clusters')
  @ApiOperation({
    summary: 'Get detected ticket clusters from the last 7 days',
    description:
      'Groups recent tickets by dominant subject keywords to surface emerging issue patterns. Returns cluster name, ticket count, dominant keywords and agency impact score.',
  })
  getClusters(@CurrentUser() _user: JwtPayload) {
    return this.mlService.getClusters();
  }

  // ─── Metrics ──────────────────────────────────────────────────────────────

  @Get('metrics')
  @ApiOperation({
    summary: 'Get aggregate ML prediction metrics',
    description:
      'Aggregates statistics from AI classification logs: total predictions, average confidence, model accuracy (based on override rate), auto-apply rate, prediction breakdown by type and recent activity.',
  })
  getMlMetrics(
    @Query() _query: QueryMlPredictionsDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.mlService.getMlMetrics();
  }

  // ─── Models ───────────────────────────────────────────────────────────────

  @Get('models')
  @ApiOperation({
    summary: 'List all registered ML models',
    description:
      'Returns all models registered in the ai_models table, including classification log counts per model.',
  })
  getMlModels(@CurrentUser() _user: JwtPayload) {
    return this.mlService.getMlModels();
  }

  @Post('models')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Register a new ML model',
    description:
      'Creates a new record in the ai_models table. Throws 409 Conflict if the same modelName + modelVersion already exists.',
  })
  registerModel(
    @Body() dto: RegisterMlModelDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.mlService.registerModel(dto);
  }
}
