import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Overall health check' })
  @SwaggerResponse({
    status: 200,
    description: 'Service is healthy or degraded',
  })
  @SwaggerResponse({
    status: 503,
    description: 'Service is unhealthy',
  })
  async getHealth() {
    const health = await this.healthService.getHealth();

    if (health.status === 'unhealthy') {
      throw new HttpException(health, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return health;
  }

  @Get('live')
  @Public()
  @ApiOperation({
    summary: 'Liveness probe - checks if process is running',
  })
  @SwaggerResponse({ status: 200, description: 'Process is alive' })
  @HttpCode(HttpStatus.OK)
  async getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @Public()
  @ApiOperation({
    summary: 'Readiness probe - checks DB and Redis connectivity',
  })
  @SwaggerResponse({ status: 200, description: 'Service is ready to accept traffic' })
  @SwaggerResponse({
    status: 503,
    description: 'Service is not ready (database down)',
  })
  async getReadiness() {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status === 'not_ready') {
      throw new HttpException(readiness, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return readiness;
  }
}
