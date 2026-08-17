import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail invalido.' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'A senha precisa de ao menos 8 caracteres.' })
  @MaxLength(128)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail invalido.' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail invalido.' })
  @MaxLength(255)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'A senha precisa de ao menos 8 caracteres.' })
  @MaxLength(128)
  password!: string;
}
