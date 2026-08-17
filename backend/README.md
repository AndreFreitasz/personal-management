# backend — API de finanças

API REST do sistema de gerenciamento de finanças pessoais. NestJS sobre
PostgreSQL, TypeScript em modo `strict`, sem ORM automágico: schema versionado em
migration e agregação de dinheiro em SQL.

> Este arquivo descreve **o que existe e por quê**. As regras de trabalho para
> quem for programar aqui estão em [CLAUDE.md](CLAUDE.md).

## Tecnologias

| Camada           | Escolha                                  | Papel                                                        |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Runtime          | Node.js 22                               | —                                                             |
| Framework        | NestJS 11                                | injeção de dependência, módulos, guards, pipes                |
| Persistência     | TypeORM 0.3 + PostgreSQL 16              | entidades, migrations, query builder                          |
| Validação        | class-validator + class-transformer      | `ValidationPipe` global com `whitelist`                       |
| Autenticação     | `@nestjs/jwt` + `@node-rs/argon2`        | access JWT curto, refresh opaco rotativo, senha em Argon2id   |
| Agendamento      | `@nestjs/schedule`                       | cron horário que materializa recorrências                     |
| Proteção HTTP    | helmet + `@nestjs/throttler`             | cabeçalhos e rate limit no login                              |
| Testes           | Jest + Supertest                         | unit nas regras puras, e2e contra Postgres real               |
| Qualidade        | ESLint (typescript-eslint) + Prettier    | `npm run lint` aplica os dois                                 |

## Arquitetura

### Módulo por domínio, não por camada

A pasta é o domínio. Não existe `controllers/`, `services/` e `entities/` na raiz
com tudo dentro: existe `transactions/` com o controller, o service, os DTOs e as
entidades **de lançamento**. Mexer numa feature é abrir uma pasta, e o acoplamento
entre domínios fica visível como `import` entre pastas — não escondido dentro de
uma camada compartilhada.

```
src/<dominio>/
  <dominio>.module.ts       registra controller, service e entidades
  <dominio>.controller.ts   rota, DTO de entrada, DTO de saída
  <dominio>.service.ts      regra de negócio e acesso a dados
  dto/                      entrada (class-validator) e saída (shape da resposta)
  entities/*.entity.ts      mapeamento TypeORM ↔ tabela
```

### O fluxo de um request

```
HTTP → helmet → CORS → JwtAuthGuard (global) → ValidationPipe (global)
     → Controller → Service → TypeORM/QueryBuilder → PostgreSQL
     → DTO de saída → HTTP
```

Três coisas valem para todo request, e não são opcionais:

- **Guard global.** `APP_GUARD` no `AuthModule`: rota nova nasce protegida. Abrir
  acesso é ato deliberado, com `@Public()`.
- **`ValidationPipe` global** com `whitelist` + `forbidNonWhitelisted`: campo não
  declarado no DTO devolve 400 em vez de passar adiante.
- **Entidade nunca vira resposta.** Sempre há um DTO de saída no meio. É o que
  impede `password_hash` de vazar por descuido.

### Estrutura de pastas

```
src/
  main.ts                       bootstrap: prefixo /api, helmet, CORS, ValidationPipe
  app.module.ts                 ConfigModule + TypeOrmModule + módulos de domínio

  config/env.validation.ts      .env inválido derruba o boot, não o primeiro request

  database/
    data-source.ts              opções compartilhadas entre runtime e CLI de migration
    migrations/                 migrations versionadas, em ordem de timestamp

  common/
    database/base.entity.ts     id uuid + created_at/updated_at
    database/numeric.transformer.ts   numeric(14,2) ↔ number, sem float
    date/competence.ts          mês do lançamento — a chave dos relatórios
    date/business-days.ts       dia útil = seg–sex, feriado não conta
    pagination/cursor.ts        paginação por cursor, nunca OFFSET grande

  auth/                         registro, login, refresh rotativo, reset de senha
  users/                        perfil (GET/PATCH /users/me)
  accounts/                     contas financeiras e saldo derivado em SQL
  categories/                   seed das 6 padrão, CRUD, arquivar e excluir com realocação
  transactions/                 lançamentos, filtros, auditoria
  recurrences/                  motor de datas e materialização idempotente
  dashboard/                    agregações de leitura, tudo em SQL
  health/                       GET /api/health

test/                           e2e contra Postgres (banco dedicado finances_test)
```

`common/` só recebe código que **mais de um domínio** usa e que não pertence a
nenhum deles. Regra de negócio de um domínio mora no domínio, mesmo que pareça
genérica.

## Modelagem de dados

```
users ──┬── accounts ──────────┐
        ├── categories ────────┤
        ├── recurrences ───────┼──> transactions ──> transaction_audits
        │      ├── recurrence_amounts
        │      └── generated_transactions ──┘
        ├── refresh_tokens
        └── password_reset_tokens
```

| Tabela                   | Papel                                                                   |
| ------------------------ | ----------------------------------------------------------------------- |
| `users`                  | conta de acesso; `password_hash` é `select: false`                       |
| `accounts`               | conta financeira (corrente, cartão, carteira); `icon` é slug de catálogo |
| `categories`             | árvore de um nível — raiz e subcategoria — por `kind`                    |
| `transactions`           | o lançamento; centro de tudo que o app lê                                |
| `transaction_audits`     | trilha de alteração de lançamento                                        |
| `recurrences`            | a regra: quando repete, como ajusta                                      |
| `recurrence_amounts`     | valor vigente por período — reajuste é INSERT, nunca UPDATE              |
| `generated_transactions` | o que já foi materializado; `UNIQUE (recurrence_id, competence)`         |
| `refresh_tokens`         | família de sessão, guardada como SHA-256                                 |
| `password_reset_tokens`  | token de uso único para redefinição                                      |

**Colunas que carregam decisão**

| Coluna                        | Regra                                                                       |
| ----------------------------- | --------------------------------------------------------------------------- |
| `transactions.amount`         | `numeric(14,2)` com transformer `money`. **Sempre positivo**                 |
| `transactions.type`           | `credit` \| `debit` \| `transfer` — o sinal vive aqui, não no valor          |
| `transactions.currency`       | ISO-4217, explícito mesmo só existindo BRL                                   |
| `transactions.occurred_at`    | `timestamptz` em UTC — quando o dinheiro se moveu                            |
| `transactions.competence`     | `date` no primeiro dia do mês — a que mês o lançamento pertence              |
| `transactions.status`         | `pending` \| `paid` — pendente fica fora do saldo realizado                  |
| `recurrences.schedule_type`   | `day_of_month` \| `fifth_business_day` \| `last_business_day`                |
| `recurrences.adjustment`      | `none` \| `previous_business_day` \| `next_business_day`                     |

**Índices** — `transactions (user_id, occurred_at DESC)` é a base de todo filtro;
`transactions (user_id, category_id, competence)` serve a agregação por categoria.

### Dinheiro

A regra que atravessa o projeto inteiro: **dinheiro nunca é `float`**.

- Coluna `numeric(14,2)` com o transformer `money` de
  [numeric.transformer.ts](src/common/database/numeric.transformer.ts).
- **Agregação roda em SQL** — `SUM`, `AVG`, window function. Nunca acumulando em
  JavaScript, onde `0.1 + 0.2 !== 0.3` e o erro se propaga por uma lista inteira.
- Valor sempre positivo, sinal num `type` separado. `-0` e comparação de sinal são
  fonte recorrente de bug.

### Schema

`synchronize` está **desligado** em toda configuração. Toda mudança de schema é
uma migration versionada, revisada antes de rodar, com `down` que realmente
reverte. As migrations aplicadas permanecem no repositório mesmo quando desfazem
uma feature inteira — migration que já rodou em banco de verdade é história, não
rascunho.

## Autenticação

- **Access token JWT curto** (15 min) + **refresh opaco e rotativo**, guardado
  como SHA-256. Cada login abre uma *família*; reapresentar um refresh já queimado
  revoga a família inteira.
- O access carrega `sid` (a família que o originou) e o guard confirma que ela
  segue viva. É o que faz logout e troca de senha derrubarem a sessão na hora, em
  vez de esperar o token expirar.
- Senha em **Argon2id** (perfil OWASP). `password_hash` nunca sai do backend.
- E-mail inexistente e senha errada respondem a mesma mensagem, no mesmo tempo
  (hash descartável), para não virar oráculo de cadastro.
- O e-mail de redefinição sai pelo `MailerPort` — hoje um adaptador que loga o
  link. Um SMTP entra aí sem tocar no domínio.

## Recorrências

Um motor só para renda e gasto fixo: a diferença está no `type` e no ajuste
padrão, nunca no cálculo.
[recurrence-schedule.ts](src/recurrences/recurrence-schedule.ts) é função pura
sobre string de data — nenhum `new Date()` sem argumento, porque "hoje" implícito
faz o teste passar em agosto e falhar em março.

- Dia útil = segunda a sexta; feriado não entra na conta (decisão de projeto, com
  o custo medido no arquivo).
- Dia 31 **clampa**, nunca pula o mês. Fevereiro vira 28 ou 29.
- Reajuste é INSERT em `recurrence_amounts`. Uma coluna `amount` na recorrência
  transformaria todo aumento numa falsificação retroativa do histórico.
- **Idempotência é constraint, não `if`.** `UNIQUE (recurrence_id, competence)` é
  a trava contra salário dobrado; um `if` na aplicação perde a corrida entre duas
  réplicas.
- O cron roda **de hora em hora**, não uma vez por mês: mensal é frágil, porque um
  container parado naquele minuto significaria ninguém receber salário no mês. A
  frequência só é segura porque a idempotência é constraint.

## Dashboard

Módulo de **leitura pura**: oito rotas sobre `transactions`, nenhuma entidade
própria, toda soma em SQL.

- O predicado de filtro é compartilhado com a lista de lançamentos —
  [transaction-filter.ts](src/transactions/transaction-filter.ts) é o único lugar
  do backend que escreve `andWhere` de filtro. Duas cópias do `WHERE` fariam a
  soma da tabela divergir do total do cartão no primeiro filtro novo.
- O painel mostra o **realizado** (`status = 'paid'` e `occurred_at <= now()`), o
  mesmo recorte do saldo da carteira. Pendente e futuro aparecem na projeção.
- O comparativo mensal agrupa por `competence`, não por `occurred_at`: a conta de
  agosto paga em setembro é despesa de agosto.

## Contrato de API

Prefixo `/api`. Datas em ISO-8601 UTC. Erros no formato do `ValidationPipe`.

```
POST   /auth/register             POST   /auth/login
POST   /auth/refresh              POST   /auth/logout
POST   /auth/forgot-password      POST   /auth/reset-password

GET    /users/me                  PATCH  /users/me

GET    /accounts                  POST   /accounts
GET    /accounts/wallet           GET    /accounts/:id
PATCH  /accounts/:id              POST   /accounts/:id/archive

GET    /categories                POST   /categories
PATCH  /categories/:id            POST   /categories/:id/archive
GET    /categories/:id/usage      DELETE /categories/:id

GET    /transactions              POST   /transactions
GET    /transactions/:id          GET    /transactions/:id/audit
PATCH  /transactions/:id          DELETE /transactions/:id
POST   /transactions/:id/categorize
POST   /transactions/:id/duplicate

GET    /recurrences               POST   /recurrences
GET    /recurrences/:id           GET    /recurrences/:id/preview
PATCH  /recurrences/:id           POST   /recurrences/:id/pause
POST   /recurrences/:id/adjust    POST   /recurrences/:id/backfill

GET    /dashboard/summary         GET    /dashboard/by-category
GET    /dashboard/by-account      GET    /dashboard/balance-series
GET    /dashboard/day             GET    /dashboard/monthly-comparison
GET    /dashboard/top-merchants   GET    /dashboard/projection

GET    /health
```

Listagens longas paginam por **cursor**, não por `OFFSET`: offset grande fica
lento e pula registro quando algo é inserido entre duas páginas.

## Rodando

```bash
cp .env.example .env      # primeira vez
npm install
npm run db:up             # sobe o Postgres do compose da raiz
npm run migration:run
npm run start:dev         # http://localhost:3000/api
```

Ou, com o stack inteiro em container a partir da raiz do repositório:

```bash
docker compose up
docker compose exec backend npm run migration:run
```

As variáveis do compose têm precedência sobre o `.env` local — é assim que
`DB_HOST` vira `postgres` dentro da rede do compose sem editar o arquivo de
ninguém.

### Comandos

```bash
npm run start:dev         # API em watch
npm run build             # nest build → dist/
npm run start:prod        # node dist/main
npm test                  # unit
npm run test:e2e          # e2e (precisa do banco de pé)
npm run lint              # eslint --fix, com prettier junto

npm run migration:generate -- src/database/migrations/NomeDaMigration
npm run migration:run
npm run migration:revert
```

## Testes

`npm test` cobre a lógica pura — dinheiro, competência, dias úteis, motor de
recorrência, período do dashboard. São as regras onde um erro é silencioso e caro,
e são as que se escrevem primeiro, começando pelo teste que falha.

`npm run test:e2e` sobe o `AppModule` inteiro contra o Postgres e exercita a API
de ponta a ponta.

> **O e2e roda contra um banco dedicado, `finances_test`.** Duas defesas
> garantem isso, e as duas precisam continuar de pé: `test/setup-env.ts`
> redireciona `DB_DATABASE` antes de o `AppModule` ser importado, e
> `resetDatabase` **recusa truncar** banco cujo nome não termine em `_test`. Toda
> tabela pende de `users` em `CASCADE` — um `TRUNCATE` no banco errado apaga
> dados reais, e já apagou uma vez.

Banco de teste novo: `CREATE DATABASE finances_test OWNER finances` e
`DB_DATABASE=finances_test npm run migration:run`.

`jest-e2e.json` fixa `maxWorkers: 1`: as suítes dividem esse banco e, em paralelo,
uma apagaria os dados da outra no meio do teste.

## Convenções

- DTO de entrada sempre com `class-validator`.
- Entidade nunca vai direto na resposta HTTP.
- Datas na API em ISO-8601 UTC; conversão de fuso é problema da borda de exibição.
- Config só via `ConfigService` tipado. `process.env` direto apenas em
  `data-source.ts`, que roda fora do contexto do Nest (CLI de migration).
- Nenhum segredo em código: `.env` é gitignorado, `.env.example` é o contrato.
