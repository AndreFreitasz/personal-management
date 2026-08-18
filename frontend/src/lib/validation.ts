import { looksLikeEmail } from './note';

export function nameError(value: string): string | undefined {
  if (value.trim().length === 0) return 'Digite seu nome.';
  return undefined;
}

export function emailError(value: string): string | undefined {
  if (value.trim().length === 0) return 'Digite seu e-mail.';
  if (!looksLikeEmail(value)) return 'Confira o e-mail — algo como nome@dominio.com.';
  return undefined;
}

export function passwordError(value: string, minLength?: number): string | undefined {
  if (value.length === 0) return 'Digite sua senha.';
  if (minLength !== undefined && value.length < minLength) {
    return `A senha precisa de ao menos ${minLength} caracteres.`;
  }
  return undefined;
}
