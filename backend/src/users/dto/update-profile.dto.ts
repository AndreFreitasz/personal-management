import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export const SUPPORTED_TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Bahia',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Porto_Velho',
  'America/Rio_Branco',
  'America/Noronha',
  'UTC',
] as const;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3, { message: 'Moeda em ISO-4217 (3 letras).' })
  defaultCurrency?: string;

  @IsOptional()
  @IsIn(SUPPORTED_TIMEZONES, { message: 'Fuso nao suportado.' })
  timezone?: string;
}
