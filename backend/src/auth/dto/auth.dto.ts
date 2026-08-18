import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail invalido.' })
  @MaxLength(255, { message: 'E-mail com no maximo 255 caracteres.' })
  email!: string;

  @IsString({ message: 'Informe a senha.' })
  @MinLength(8, { message: 'A senha precisa de ao menos 8 caracteres.' })
  @MaxLength(128, { message: 'A senha pode ter no maximo 128 caracteres.' })
  password!: string;

  @IsString({ message: 'Informe o nome.' })
  @IsNotEmpty({ message: 'Informe o nome.' })
  @MaxLength(120, { message: 'Nome com no maximo 120 caracteres.' })
  name!: string;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail invalido.' })
  @MaxLength(255, { message: 'E-mail com no maximo 255 caracteres.' })
  email!: string;

  @IsString({ message: 'Informe a senha.' })
  @IsNotEmpty({ message: 'Informe a senha.' })
  @MaxLength(128, { message: 'A senha pode ter no maximo 128 caracteres.' })
  password!: string;
}

export class RefreshDto {
  @IsString({ message: 'Sessao invalida. Entre novamente.' })
  @IsNotEmpty({ message: 'Sessao invalida. Entre novamente.' })
  @MaxLength(512, { message: 'Sessao invalida. Entre novamente.' })
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'E-mail invalido.' })
  @MaxLength(255, { message: 'E-mail com no maximo 255 caracteres.' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString({ message: 'Link de redefinicao invalido ou expirado.' })
  @IsNotEmpty({ message: 'Link de redefinicao invalido ou expirado.' })
  @MaxLength(512, { message: 'Link de redefinicao invalido ou expirado.' })
  token!: string;

  @IsString({ message: 'Informe a nova senha.' })
  @MinLength(8, { message: 'A senha precisa de ao menos 8 caracteres.' })
  @MaxLength(128, { message: 'A senha pode ter no maximo 128 caracteres.' })
  password!: string;
}
