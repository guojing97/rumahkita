import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Enable Shutdown Hooks for graceful database disconnection
  app.enableShutdownHooks();

  // Cookie Parser for reading HttpOnly refreshToken
  app.use(cookieParser());

  // Global REST API Prefix: /api/v1
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health'],
  });

  // CORS Configuration
  app.enableCors({
    origin: (_origin, callback) => callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'authorization',
      'X-Household-Id',
      'x-household-id',
      'Idempotency-Key',
      'idempotency-key',
      'Accept',
      'Cookie',
      'cookie',
    ],
    exposedHeaders: ['Content-Disposition', 'Set-Cookie', 'set-cookie'],
  });

  // OpenAPI / Swagger Documentation Setup at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('RumahKita REST API')
    .setDescription('Private Household Finance & Inventory Management REST API')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addApiKey({ type: 'apiKey', name: 'X-Household-Id', in: 'header' }, 'household-id')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Default Port 4000
  const port = process.env.API_PORT || process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`[RumahKita API] Server running at http://localhost:${port}/${apiPrefix}`);
  console.log(`[RumahKita API] Swagger UI available at http://localhost:${port}/api/docs`);
}

bootstrap();
