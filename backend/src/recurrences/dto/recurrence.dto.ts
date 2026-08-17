import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { TransactionType } from '../../transactions/entities/transaction.entity';
import { Recurrence } from '../entities/recurrence.entity';
import { Adjustment, ScheduleType } from '../recurrence-schedule';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const COMPETENCE = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CreateRecurrenceDto {
  @IsEnum(TransactionType, { message: 'type deve ser credit, debit ou transfer.' })
  type!: TransactionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(trim)
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor com no maximo 2 casas decimais.' })
  @Min(0.01, { message: 'Valor deve ser positivo; o sinal vem do type.' })
  amount!: number;

  @IsUUID()
  accountId!: string;

  @ValidateIf((dto: CreateRecurrenceDto) => dto.type === TransactionType.Transfer)
  @IsUUID()
  destinationAccountId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsEnum(ScheduleType, {
    message: 'scheduleType deve ser day_of_month, fifth_business_day ou last_business_day.',
  })
  scheduleType!: ScheduleType;

  @ValidateIf((dto: CreateRecurrenceDto) => dto.scheduleType === ScheduleType.DayOfMonth)
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @IsOptional()
  @IsEnum(Adjustment)
  adjustment?: Adjustment;

  @Matches(COMPETENCE, { message: 'startsOn no formato AAAA-MM.' })
  startsOn!: string;

  @IsOptional()
  @Matches(COMPETENCE, { message: 'endsOn no formato AAAA-MM.' })
  endsOn?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480, { message: 'Parcelamento acima de 40 anos e' + ' quase sempre erro de digitacao.' })
  installments?: number;
}

export class UpdateRecurrenceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(trim)
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsEnum(ScheduleType)
  scheduleType?: ScheduleType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number | null;

  @IsOptional()
  @IsEnum(Adjustment)
  adjustment?: Adjustment;

  @IsOptional()
  @Matches(COMPETENCE, { message: 'endsOn no formato AAAA-MM.' })
  endsOn?: string | null;
}

export class AdjustAmountDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @Matches(COMPETENCE, { message: 'validFrom no formato AAAA-MM.' })
  validFrom!: string;
}

export class PauseRecurrenceDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  paused?: boolean;
}

export class ListRecurrencesQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includePaused?: boolean;
}

export class OccurrenceDto {
  competence!: string;
  occursOn!: string;
  amount!: number;
  installment!: number | null;
  materialized!: boolean;
}

export class RecurrenceResponseDto {
  id!: string;
  type!: TransactionType;
  description!: string;
  amount!: number;
  currency!: string;
  accountId!: string;
  destinationAccountId!: string | null;
  categoryId!: string | null;
  scheduleType!: ScheduleType;
  dayOfMonth!: number | null;
  adjustment!: Adjustment;
  startsOn!: string;
  endsOn!: string | null;
  installments!: number | null;
  paused!: boolean;
  materializedCount!: number;

  static from(
    recurrence: Recurrence,
    amount: number,
    materializedCount: number,
  ): RecurrenceResponseDto {
    return {
      id: recurrence.id,
      type: recurrence.type,
      description: recurrence.description,
      amount,
      currency: recurrence.currency,
      accountId: recurrence.accountId,
      destinationAccountId: recurrence.destinationAccountId,
      categoryId: recurrence.categoryId,
      scheduleType: recurrence.scheduleType,
      dayOfMonth: recurrence.dayOfMonth,
      adjustment: recurrence.adjustment,
      startsOn: recurrence.startsOn.slice(0, 7),
      endsOn: recurrence.endsOn?.slice(0, 7) ?? null,
      installments: recurrence.installments,
      paused: recurrence.pausedAt !== null,
      materializedCount,
    };
  }
}
