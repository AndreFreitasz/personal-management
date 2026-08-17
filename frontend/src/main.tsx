import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { App } from './App';
import './index.css';
import { ApiError } from './lib/api';
import { bootstrapSession } from './lib/session';
import { initTheme } from './lib/theme';
import { CategoriesPage } from './routes/categories';
import { DashboardPage } from './routes/dashboard';
import { LoginPage } from './routes/login';
import { RecurrencesPage } from './routes/recurrences';
import { RegisterPage } from './routes/register';
import { RedirectIfAuthenticated, RequireAuth } from './routes/require-auth';
import { TransactionsPage } from './routes/transactions';
import { WalletPage } from './routes/wallet';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 1;
      },
    },
  },
});

initTheme();

bootstrapSession();

const root = document.getElementById('root');
if (!root) throw new Error('#root não encontrado em index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/entrar"
            element={
              <RedirectIfAuthenticated>
                <LoginPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/criar-conta"
            element={
              <RedirectIfAuthenticated>
                <RegisterPage />
              </RedirectIfAuthenticated>
            }
          />

          <Route
            element={
              <RequireAuth>
                <App />
              </RequireAuth>
            }
          >
            <Route path="/" element={<WalletPage />} />
            <Route path="/painel" element={<DashboardPage />} />
            <Route path="/lancamentos" element={<TransactionsPage />} />
            <Route path="/recorrencias" element={<RecurrencesPage />} />
            <Route path="/categorias" element={<CategoriesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
