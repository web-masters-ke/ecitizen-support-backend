import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

const logger = new Logger('Bootstrap');

// ─── Process-level crash guards ────────────────────────────────────────────────
// These ensure Node never exits on unhandled async errors or stray exceptions.
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection — continuing', reason instanceof Error ? reason.stack : String(reason));
  // Do NOT re-throw — we log and carry on. NestJS exception filters handle HTTP-layer errors.
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception — continuing', err.stack);
  // Same policy: log but do not exit. Critical for high-concurrency environments.
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Security
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(cookieParser());

  // Serve uploaded files statically — cross-origin allowed so admin/webclient can load media
  const uploadDir = path.resolve(configService.get<string>('UPLOAD_DIR', './uploads'));
  app.use('/uploads', express.static(uploadDir, {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }));

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

  // Graceful shutdown — drains in-flight requests before process exits
  app.enableShutdownHooks();

  const port = configService.get('PORT', 4000);
  // Listen on 0.0.0.0 so physical devices on the same network can reach the server
  await app.listen(port, '0.0.0.0');

  logger.log(`🏛️  eCitizen SCC Backend running on http://0.0.0.0:${port}`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed — exiting', err);
  process.exit(1);
});
