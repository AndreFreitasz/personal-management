# managment-finances

Sistema de gerenciamento de finanças pessoais: contas, categorias, lançamentos,
renda e gastos recorrentes, e um painel que responde para onde o dinheiro foi.

Duas aplicações independentes num repositório só, cada uma com o próprio
`package.json` e o próprio README.

| Pasta                  | Stack                                       | Porta | Documentação                             |
| ---------------------- | ------------------------------------------- | ----- | ---------------------------------------- |
| [backend/](backend/)   | NestJS 11 · TypeORM 0.3 · PostgreSQL 16     | 3000  | [backend/README.md](backend/README.md)   |
| [frontend/](frontend/) | React 19 · Vite 6 · TypeScript · Tailwind 4 | 5173  | [frontend/README.md](frontend/README.md) |

## O que o sistema faz

- **Contas e carteira** — conta corrente, cartão, dinheiro em espécie. O saldo é
  derivado em SQL a partir dos lançamentos, nunca guardado numa coluna que possa
  divergir.
- **Categorias** — árvore de um nível, com seis padrão criadas junto da conta.
  Arquivar preserva o histórico; excluir exige destino explícito para os
  lançamentos presos.
- **Lançamentos** — entrada, saída e transferência, com filtro na URL, paginação
  por cursor, trilha de auditoria e separação entre o que já aconteceu e o que
  está agendado.
- **Recorrências** — salário e conta fixa caindo sozinhos. Motor de datas com
  dia útil, clamp de dia 31 e ajuste de fim de semana; materialização idempotente
  por constraint, disparada de hora em hora.
- **Painel** — resumo, gastos por categoria e por conta, série de saldo, dia a
  dia, comparativo mensal e projeção de fim de mês. Toda soma acontece em SQL.

## Como está montado

```
                 ┌──────────────────────────────┐
   navegador ───▶│  frontend  (React + Vite)    │
                 │  SPA, proxy /api em dev      │
                 └──────────────┬───────────────┘
                                │  HTTP /api, JSON, ISO-8601 UTC
                 ┌──────────────▼───────────────┐
                 │  backend  (NestJS)           │
                 │  guard global, ValidationPipe│
                 │  módulo por domínio          │
                 └──────────────┬───────────────┘
                                │  TypeORM
                 ┌──────────────▼───────────────┐
                 │  PostgreSQL 16               │
                 │  schema só por migration     │
                 └──────────────────────────────┘
```

A fronteira entre os dois é estrita: o backend calcula e o frontend apresenta.
Nenhum total, saldo ou média é somado no cliente.

## Rodando com Docker (recomendado)

Precisa só do Docker Desktop. Um comando sobe banco, API e web juntos:

```bash
docker compose up          # -d para rodar em background
```

| Serviço  | URL                       |
| -------- | ------------------------- |
| web      | http://localhost:5173     |
| api      | http://localhost:3000/api |
| postgres | `localhost:5432`          |

Hot reload funciona nos dois lados: o código vem do host por bind mount, e
`backend/` e `frontend/` recarregam ao salvar um arquivo. `node_modules` fica em
volume nomeado — o do host é win32 e não roda no container Linux.

Toda variável tem default, então não é preciso criar `.env` para subir. Para
customizar porta, senha do banco ou CORS: `cp .env.example .env`.

```bash
docker compose logs -f backend      # logs de um serviço
docker compose exec backend sh      # shell dentro do container
docker compose down                 # derruba (o volume do banco sobrevive)
docker compose down -v              # derruba e apaga os dados do banco
```

`synchronize` está desligado por escolha de projeto, então migration é passo
explícito — não roda sozinha no boot do container:

```bash
docker compose exec backend npm run migration:run
```

Depois de mexer em `package.json`, reconstrua a imagem e recrie o volume de
dependências daquele serviço:

```bash
docker compose up -d --build backend
docker compose exec backend npm install     # ou, se algo ficar inconsistente:
docker compose down && docker volume rm managment-finances_backend-node-modules
```

## Testes

```bash
cd backend && npm test          # unit: dinheiro, datas, recorrência, período
cd backend && npm run test:e2e  # e2e contra Postgres (banco dedicado finances_test)
cd frontend && npm run build    # typecheck + bundle
```

## Regras que valem para as duas pastas

- **Dinheiro nunca é `float`.** `numeric(14,2)` no banco, agregação em SQL, valor
  sempre positivo com o sinal num `type` separado.
- **Aritmética de dinheiro não acontece no frontend.** Total vem calculado.
- **Schema muda só por migration.** `synchronize` permanece desligado.
- Datas trafegam em ISO-8601 UTC na API; a formatação para `pt-BR` acontece só na
  borda de renderização do frontend.
- Nenhum segredo em código. `.env` é gitignorado; `.env.example` é o contrato.
