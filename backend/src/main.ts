import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Pino 구조화 로거 적용
  app.useLogger(app.get(Logger));

  // 보안 헤더
  app.use(helmet());

  // gzip 응답 압축
  app.use(compression());

  // 정상 종료 (SIGTERM 시 Prisma disconnect 등 클린업)
  app.enableShutdownHooks();

  app.setGlobalPrefix('api');

  // 글로벌 예외 필터
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 유효성 검증 파이프
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // Swagger API 문서
  const config = new DocumentBuilder()
    .setTitle('ETP API')
    .setDescription('RE100 전력 중개거래 플랫폼 API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.BACKEND_PORT || 3000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`ETP Backend running on http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`Health check: http://localhost:${port}/api/health`);
}
bootstrap();
