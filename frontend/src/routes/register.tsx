import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Banknote } from '@/components/banknote';
import { Button, Field, Input } from '@/components/ui';
import {
  initialsFromName,
  looksLikeEmail,
  platesDone,
  serialFrom,
  type Plates,
} from '@/lib/note';
import { register } from '@/lib/session';
import { AuthShell, PressStatus } from './auth-shell';

function strengthOf(password: string): { level: 0 | 1 | 2 | 3 | 4; label: string } {
  if (password.length === 0) return { level: 0, label: 'Mínimo de 8 caracteres' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z0-9]/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;

  const labels = ['Muito curta', 'Fraca', 'Razoável', 'Boa', 'Forte'] as const;
  const level = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  return { level, label: labels[level] };
}

function pressStatusOf(plates: Plates, strong: boolean) {
  const done = platesDone(plates);
  const mark = `${done}/4`;

  if (!plates.engraved) {
    return {
      mark,
      headline: 'Comece pelo seu nome',
      hint: 'Suas iniciais são gravadas no medalhão da nota.',
    };
  }

  if (!plates.numbered) {
    return {
      mark,
      headline: 'Agora o e-mail',
      hint: 'É dele que sai a numeração de série, nos dois cantos.',
    };
  }

  if (!plates.backed) {
    return {
      mark,
      headline: 'Crie uma senha de 8 caracteres',
      hint: 'O fundo de segurança é o que uma cópia não consegue reproduzir.',
    };
  }

  if (!strong) {
    return {
      mark,
      headline: 'Reforce a senha para fechar o selo',
      hint: 'Misture maiúsculas, números e símbolos — ou passe de 12 caracteres.',
    };
  }

  return {
    mark: '4/4',
    headline: 'Nota pronta',
    hint: 'Criar conta emite a sua carteira e leva você para dentro.',
  };
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const strength = strengthOf(password);
  const initials = initialsFromName(name);

  const plates: Plates = {
    engraved: initials.length > 0,
    numbered: looksLikeEmail(email),
    backed: password.length >= 8,
    sealed: strength.level >= 3,
  };

  const status = pressStatusOf(plates, strength.level >= 3);
  const done = platesDone(plates);
  const eyebrow = done === 0 ? 'Cédula em branco' : done === 4 ? 'Cédula pronta' : 'Em impressão';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await register(name, email, password);
      void navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a conta.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      eyebrow={eyebrow}
      title="Criar sua conta"
      subtitle="Preencha os três campos e veja a sua cédula ser impressa — uma chapa por campo."
      note={
        <Banknote
          plates={plates}
          initials={initials}
          serial={serialFrom(email)}
          checking={pending}
        />
      }
      status={<PressStatus mark={status.mark} headline={status.headline} hint={status.hint} />}
      footer={
        <>
          Já tem conta?{' '}
          <Link
            to="/entrar"
            className="link-ios text-primary-ink hover:text-primary-hover font-medium underline decoration-1 underline-offset-2 hover:decoration-2"
          >
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="Nome">
          {(id) => (
            <Input
              id={id}
              size="lg"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        <Field label="E-mail">
          {(id) => (
            <Input
              id={id}
              size="lg"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>

        <Field label="Senha" hint={strength.label}>
          {(id) => (
            <Input
              id={id}
              size="lg"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        {error && (
          <p role="alert" className="text-negative text-sm">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending ? 'Criando…' : 'Criar conta'}
        </Button>
      </form>
    </AuthShell>
  );
}
