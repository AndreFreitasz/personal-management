import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { Loading } from '@/components/ui';
import { useSession } from '@/lib/session';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loading label="Retomando sua sessão…" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loading label="Verificando…" />
      </div>
    );
  }

  return status === 'authenticated' ? <Navigate to="/" replace /> : <>{children}</>;
}
