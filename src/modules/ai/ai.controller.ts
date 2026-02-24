import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import {
  ClassifyTicketDto,
  QueryClassificationsDto,
  CreateAiOverrideDto,
  CreateAiFeedbackDto,
  RegisterAiModelDto,
  QueryAiMetricsDto,
  QueryRecommendationsDto,
} from './dto/ai.dto';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('classify')
  @ApiOperation({
    summary: 'Classify a ticket using AI',
    description:
      'Runs a rule-based classifier on the ticket subject and description. Returns predicted category, priority, confidence score, sentiment, and recommendations.',
  })
  classifyTicket(@Body() dto: ClassifyTicketDto) {
    return this.aiService.classifyTicket(dto);
  }

  @Post('override')
  @ApiOperation({
    summary: 'Log a human override of an AI classification',
    description:
      'Records that an agent disagreed with the AI classification and applied a different category or priority.',
  })
  createOverride(@Body() dto: CreateAiOverrideDto) {
    return this.aiService.createOverride(dto);
  }

  @Post('feedback')
  @ApiOperation({
    summary: 'Submit feedback on an AI classification',
    description:
      'Allows agents to rate whether an AI classification was accurate.',
  })
  submitFeedback(@Body() dto: CreateAiFeedbackDto) {
    return this.aiService.submitFeedback(dto);
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get AI performance metrics',
    description:
      'Returns accuracy, override rate, confidence distribution, and feedback summary.',
  })
  getMetrics(@Query() query: QueryAiMetricsDto) {
    return this.aiService.getMetrics(query);
  }

  @Get('classifications')
  @ApiOperation({
    summary: 'Get classification history',
    description:
      'Returns paginated list of AI classifications, optionally filtered by ticket or model.',
  })
  getClassifications(@Query() query: QueryClassificationsDto) {
    return this.aiService.getClassifications(query);
  }

  @Get('models')
  @ApiOperation({ summary: 'List registered AI models' })
  getModels() {
    return this.aiService.getModels();
  }

  @Post('models')
  @ApiOperation({ summary: 'Register a new AI model' })
  registerModel(@Body() dto: RegisterAiModelDto) {
    return this.aiService.registerModel(dto);
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'Get AI recommendations for a ticket',
    description:
      'Returns all AI-generated recommendations for a specific ticket.',
  })
  getRecommendations(@Query() query: QueryRecommendationsDto) {
    return this.aiService.getRecommendations(query);
  }
}
