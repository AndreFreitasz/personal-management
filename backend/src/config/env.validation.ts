import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

const toBoolean = ({ value }: { value: unknown }): boolean => value === 'true' || value === true;

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  CORS_ORIGINS = '';

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT = 5432;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_DATABASE!: string;

  @Transform(toBoolean)
  @IsBoolean()
  DB_LOGGING = false;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_TTL = '15m';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  REFRESH_TTL_DAYS = 30;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PASSWORD_RESET_TTL_MINUTES = 30;

  @IsString()
  APP_URL = 'http://localhost:5173';
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    excludeExtraneousValues: false,
    exposeDefaultValues: true,
  });

  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Variaveis de ambiente invalidas:\n${details}`);
  }

  return parsed;
}
