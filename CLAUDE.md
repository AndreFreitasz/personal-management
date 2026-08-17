# managment-finances

Sistema de gerenciamento de finanças. Duas pastas independentes, cada uma com o
seu próprio `package.json`, `CLAUDE.md` e disciplina de trabalho.

```
backend/    NestJS + TypeORM + PostgreSQL   → regido por superpowers
frontend/   React + Vite + TS + Tailwind    → regido por frontend-design
```

## Plugins

`.claude/settings.json` habilita `superpowers` e `frontend-design`. Plugins são
carregados **por sessão, não por diretório** — `enabledPlugins` não aceita escopo
de subpasta. A separação é comportamental e está descrita abaixo:

- Trabalhando em `backend/` → siga [backend/CLAUDE.md](backend/CLAUDE.md).
  Brainstorm antes de codar, TDD red/green, debugging sistemático, code review
  por subagente. **Não** aplique heurística de design visual aqui.
- Trabalhando em `frontend/` → siga [frontend/CLAUDE.md](frontend/CLAUDE.md).
  Design primeiro, depois implementação.

## Docker

`docker compose up` na raiz sobe os três serviços — `postgres`, `backend`,
`frontend` — com hot reload nos dois lados. É o caminho padrão para rodar o
projeto; `npm run start:dev` / `npm run dev` no host continuam válidos, mas os
dois modos disputam as mesmas portas e não rodam juntos.

- [docker-compose.yml](docker-compose.yml) — dev. Único lugar onde o Postgres é
  definido; `npm run db:up` no backend aponta para cá. Todas as variáveis têm
  default, então subir não exige `.env`.
- [docker-compose.prod.yml](docker-compose.prod.yml) — arquivo autônomo, não um
  override. Backend sem código-fonte na imagem, frontend estático em nginx.
- `node_modules` **nunca** vem do host: fica em volume nomeado, porque o do host
  é win32 e o container é Linux (esbuild e rollup têm binário por plataforma).
  Mexeu em `package.json` → `docker compose up -d --build <serviço>`.
- Hot reload em bind mount Windows→Linux **exige polling** — inotify não
  atravessa. Backend: `watchOptions` em
  [backend/tsconfig.docker.json](backend/tsconfig.docker.json). Frontend:
  `VITE_USE_POLLING`, lido em [frontend/vite.config.ts](frontend/vite.config.ts).
- Migration **não roda no boot** do container, por coerência com a regra de
  schema do backend: `docker compose exec backend npm run migration:run`.
- Variáveis do compose sobrescrevem `backend/.env` (no `@nestjs/config` o
  `process.env` tem precedência sobre o arquivo). É assim que `DB_HOST` vira
  `postgres` dentro da rede do compose sem editar o `.env` de ninguém.

## Regras que valem para as duas pastas

- **Dinheiro nunca é `float`.** Ver a seção de dinheiro em cada `CLAUDE.md`.
- Datas trafegam em ISO-8601 UTC na API; a formatação para `pt-BR` acontece
  só na borda de renderização do frontend.
- Nenhum segredo em código. `.env` é gitignorado; `.env.example` é o contrato.
