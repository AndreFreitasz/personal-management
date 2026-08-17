import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import { AccountType } from '../../accounts/entities/account.entity';
import { CategoryKind } from '../../categories/entities/category.entity';
import { TransactionType } from '../../transactions/entities/transaction.entity';
import { PeriodPreset } from '../period';

function toArray({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value : [value];
}

function trim({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class DashboardQueryDto {
  @IsOptional()
  @IsEnum(PeriodPreset)
  period?: PeriodPreset;

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
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
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
}

export class DayQueryDto extends DashboardQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data no formato AAAA-MM-DD.' })
  date!: string;
}

export interface PeriodDto {
  from: string;
  to: string;
  months: number;
}

export class SummaryResponseDto {
  period!: PeriodDto;
  income!: number;
  expense!: number;
  net!: number;
  count!: number;
  previous!: { income: number; expense: number; net: number };
  savingsRate!: number | null;
}

export interface CategoryChildDto {
  categoryId: string | null;
  name: string | null;
  color: string | null;
  total: number;
  share: number;
  count: number;
}

export interface CategorySliceDto {
  categoryId: string | null;
  name: string;
  color: string | null;
  kind: CategoryKind | null;
  total: number;
  share: number;
  count: number;
  budget: number | null;
  children: CategoryChildDto[];
}

export class ByCategoryResponseDto {
  period!: PeriodDto;
  total!: number;
  slices!: CategorySliceDto[];
}

export interface AccountSliceDto {
  accountId: string;
  name: string;
  type: AccountType;
  icon: string | null;
  currency: string;
  archived: boolean;
  expense: number;
  income: number;
  count: number;
  share: number;
}

export class ByAccountResponseDto {
  period!: PeriodDto;
  total!: number;
  accounts!: AccountSliceDto[];
}

export interface BalancePointDto {
  date: string;
  net: number;
  income: number;
  expense: number;
  cumulative: number;
}

export class BalanceSeriesResponseDto {
  period!: PeriodDto;
  points!: BalancePointDto[];
}

export interface MonthlyPointDto {
  competence: string;
  income: number;
  expense: number;
  net: number;
}

export class MonthlyComparisonResponseDto {
  period!: PeriodDto;
  months!: MonthlyPointDto[];
}

export interface MerchantDto {
  description: string;
  total: number;
  count: number;
}

export class TopMerchantsResponseDto {
  period!: PeriodDto;
  merchants!: MerchantDto[];
}

export interface DayTransactionDto {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  occurredAt: string;
  accountId: string;
  accountName: string;
  accountIcon: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

export class DayResponseDto {
  date!: string;
  income!: number;
  expense!: number;
  net!: number;
  count!: number;
  transactions!: DayTransactionDto[];
}

export class ProjectionResponseDto {
  balance!: number;
  scheduledIncome!: number;
  scheduledExpense!: number;
  projected!: number;
  horizon!: string;
}
