import { useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button, Container } from '@/components/ui';
import { logout, useSession } from '@/lib/session';

const NAV = [
  { to: '/', label: 'Carteira', end: true },
  { to: '/painel', label: 'Painel', end: false },
  { to: '/lancamentos', label: 'Lançamentos', end: false },
  { to: '/recorrencias', label: 'Recorrências', end: false },
  { to: '/categorias', label: 'Categorias', end: false },
];

interface Pill {
  x: number;
  w: number;
}

export function App() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();

  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<Pill | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measure = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) return setPill(null);

      const next = { x: active.offsetLeft, w: active.offsetWidth };
      setPill((prev) => (prev && prev.x === next.x && prev.w === next.w ? prev : next));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [pathname]);

  async function handleLogout() {
    await logout();
    queryClient.clear();
    void navigate('/entrar', { replace: true });
  }

  return (
    <div className="min-h-dvh">
      <header className="border-border bg-surface border-b">
        <Container className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3 sm:py-4">
          <p className="text-primary-ink order-1 text-sm font-semibold tracking-wide uppercase">
            Finanças
          </p>

          <nav
            ref={navRef}
            aria-label="Seções"
            className="no-scrollbar relative order-3 flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto"
          >
            {pill && (
              <span
                aria-hidden="true"
                className="nav-pill bg-primary-soft absolute inset-y-0 left-0 rounded-lg"
                style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
              />
            )}

            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `tap relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive ? 'text-primary-ink' : 'text-ink-muted hover:text-primary-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="order-2 ml-auto flex items-center gap-2 sm:order-3 sm:gap-3">
            <span className="text-ink-muted hidden text-sm sm:inline">{user?.name}</span>
            <ThemeToggle />
            <Button variant="ghost" onClick={() => void handleLogout()}>
              Sair
            </Button>
          </div>
        </Container>
      </header>

      <main className="py-6 sm:py-8">
        <Container>
          <Outlet />
        </Container>
      </main>
    </div>
  );
}
