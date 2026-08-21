import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  ClassificationSource,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const toArray = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value;
  return typeof value === 'string' ? value.split(',').map((v) => v.trim()) : [value];
};

export class CreateTransactionDto {
  @IsEnum(TransactionType, { message: 'type deve ser credit, debit ou transfer.' })
  type!: TransactionType;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor com no maximo 2 casas decimais.' })
  @IsPositive({ message: 'Valor precisa ser maior que zero.' })
  @Max(99_999_999_999.99, { message: 'Valor acima do suportado.' })
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(trim)
  description!: string;

  @IsISO8601({ strict: true }, { message: 'occurredAt em ISO-8601 UTC.' })
  occurredAt!: string;

  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  destinationAccountId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor com no maximo 2 casas decimais.' })
  @IsPositive({ message: 'Valor precisa ser maior que zero.' })
  @Max(99_999_999_999.99)
  amount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(trim)
  description?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  destinationAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsEnum(TransactionStatus, { message: 'status deve ser pending ou paid.' })
  status?: TransactionStatus;
}

export class CategorizeTransactionDto {
  @IsOptional()
  @IsUUID()
  categoryId!: string | null;
}

export class DuplicateTransactionDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;
}

export class ListTransactionsQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(TransactionType, { each: true })
  type?: TransactionType[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsUUID('4', { each: true })
  accountId?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsUUID('4', { each: true })
  categoryId?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsUUID('4', { each: true })
  excludeCategoryId?: string[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trim)
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  uncategorized?: boolean;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class TransactionResponseDto {
  id!: string;
  type!: TransactionType;
  amount!: number;
  currency!: string;
  description!: string;
  occurredAt!: string;
  competence!: string;
  accountId!: string;
  destinationAccountId!: string | null;
  categoryId!: string | null;

  status!: TransactionStatus;

  classificationSource!: ClassificationSource | null;
  classifiedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static from(transaction: Transaction): TransactionResponseDto {
    return {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      occurredAt: transaction.occurredAt.toISOString(),
      competence: transaction.competence,
      accountId: transaction.accountId,
      destinationAccountId: transaction.destinationAccountId,
      categoryId: transaction.categoryId,
      status: transaction.status,
      classificationSource: transaction.classificationSource,
      classifiedAt: transaction.classifiedAt?.toISOString() ?? null,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }
}

export class PagedTransactionsDto {
  items!: TransactionResponseDto[];
  nextCursor!: string | null;
}
