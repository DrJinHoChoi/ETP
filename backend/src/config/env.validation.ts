import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsNumber, validateSync } from 'class-validator';
import { Type } from 'class-transformer';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL 환경변수가 필요합니다' })
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty({ message: 'JWT_SECRET 환경변수가 필요합니다' })
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string = '24h';

  @IsString()
  @IsOptional()
  REDIS_HOST?: string = 'localhost';

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  REDIS_PORT?: number = 6379;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  BACKEND_PORT?: number = 3000;

  @IsString()
  @IsOptional()
  NODE_ENV?: string = 'development';

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string = 'http://localhost:5173';

  @IsString()
  @IsOptional()
  LOG_LEVEL?: string = 'debug';

  @IsString()
  @IsOptional()
  FABRIC_ENABLED?: string = 'false';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => Object.values(err.constraints || {}).join(', '))
      .join('\n');
    throw new Error(`환경변수 검증 실패:\n${messages}`);
  }

  return validatedConfig;
}
