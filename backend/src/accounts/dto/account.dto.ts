import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { Account, AccountType } from '../entities/account.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const upper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.toUpperCase() : value;

const ICON_SLUG = /^[a-z0-9][a-z0-9-]{0,31}$/;
const ICON_MESSAGE = 'Icone invalido: use o identificador de um banco do catalogo.';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(trim)
  name!: string;

  @IsEnum(AccountType, {
    message: 'type deve ser checking, savings, credit_card, cash ou investment.',
  })
  type!: AccountType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Saldo inicial com no maximo 2 casas decimais.' })
  initialBalance?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data no formato AAAA-MM-DD.' })
  @IsISO8601({ strict: true })
  initialBalanceAt?: string;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @Length(3, 3, { message: 'Moeda em ISO-4217 (3 letras).' })
  currency?: string;

  @IsOptional()
  @IsString()
  @Matches(ICON_SLUG, { message: ICON_MESSAGE })
  icon?: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(trim)
  name?: string;

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Saldo inicial com no maximo 2 casas decimais.' })
  initialBalance?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data no formato AAAA-MM-DD.' })
  @IsISO8601({ strict: true })
  initialBalanceAt?: string;

  @IsOptional()
  @IsString()
  @Matches(ICON_SLUG, { message: ICON_MESSAGE })
  icon?: string | null;
}

export class ListAccountsQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  withBalance?: boolean;
}

export class AccountResponseDto {
  id!: string;
  name!: string;
  type!: AccountType;
  initialBalance!: number;
  initialBalanceAt!: string;
  currency!: string;
  icon!: string | null;
  archivedAt!: string | null;
  balance?: number;

  static from(account: Account, balance?: number): AccountResponseDto {
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      initialBalance: account.initialBalance,
      initialBalanceAt: account.initialBalanceAt,
      currency: account.currency,
      icon: account.icon ?? null,
      archivedAt: account.archivedAt?.toISOString() ?? null,
      ...(balance === undefined ? {} : { balance }),
    };
  }
}

export class WalletSummaryDto {
  balance!: number;
  currency!: string;
  accounts!: AccountResponseDto[];
}
