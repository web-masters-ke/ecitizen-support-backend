import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Security
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Agency-ID'],
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('eCitizen Service Command Center API')
    .setDescription('Backend API for the eCitizen Service Command Center (eSCC)')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication & Authorization')
    .addTag('Users', 'User Management')
    .addTag('Agencies', 'Agency Management')
    .addTag('Tickets', 'Ticket Management')
    .addTag('SLA', 'SLA & Escalation')
    .addTag('Workflow', 'Workflow & Automation')
    .addTag('Notifications', 'Notification Service')
    .addTag('Knowledge Base', 'Knowledge Management')
    .addTag('AI', 'AI Classification & Intelligence')
    .addTag('Audit', 'Audit & Compliance')
    .addTag('Reporting', 'Analytics & Reporting')
    .addTag('Media', 'Media & File Management')
    .addTag('Admin', 'Admin Dashboard')
    .addTag('Health', 'Health Checks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get('PORT', 4000);
  // Listen on 0.0.0.0 so physical devices on the same network can reach the server
  await app.listen(port, '0.0.0.0');

  console.log(`🏛️  eCitizen SCC Backend running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
