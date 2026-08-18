import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Banknote } from '@/components/banknote';
import { Button, Field, Input } from '@/components/ui';
import { ALL_PLATES, BLANK_PLATES, initialsFromEmail, serialFrom } from '@/lib/note';
import { login } from '@/lib/session';
import { emailError, passwordError } from '@/lib/validation';
import { AuthShell, PressStatus } from './auth-shell';

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [inked, setInked] = useState(false);
  useEffect(() => setInked(true), []);

  const initials = initialsFromEmail(email);
  const serial = serialFrom(email);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const errors: FieldErrors = {
      email: emailError(email),
      password: passwordError(password),
    };

    if (errors.email ?? errors.password) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setPending(true);

    try {
      await login(email, password);
      void navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Cédula emitida"
      title="Entrar na sua carteira"
      subtitle="Seus lançamentos, saldos e categorias, do jeito que você deixou."
      note={
        <Banknote
          plates={inked ? ALL_PLATES : BLANK_PLATES}
          initials={initials}
          serial={serial}
          checking={pending}
        />
      }
      status={
        pending ? (
          <PressStatus
            mark="···"
            headline="Conferindo a nota"
            hint="Estamos validando suas credenciais no servidor."
          />
        ) : (
          <PressStatus
            mark="4/4"
            headline="Nota emitida em seu nome"
            hint="A efígie e a numeração vêm do e-mail que você digitar."
          />
        )
      }
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link
            to="/criar-conta"
            className="link-ios text-primary-ink hover:text-primary-hover font-medium underline decoration-1 underline-offset-2 hover:decoration-2"
          >
            Criar uma agora
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="E-mail" error={fieldErrors.email}>
          {(id) => (
            <Input
              id={id}
              size="lg"
              type="email"
              autoComplete="email"
              required
              aria-invalid={fieldErrors.email ? true : undefined}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError('email');
              }}
            />
          )}
        </Field>

        <Field label="Senha" error={fieldErrors.password}>
          {(id) => (
            <Input
              id={id}
              size="lg"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={fieldErrors.password ? true : undefined}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
            />
          )}
        </Field>

        {error && (
          <p role="alert" className="text-negative text-sm">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthShell>
  );
}
