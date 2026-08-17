# backend — API de finanças

NestJS 11 · TypeORM 0.3 · PostgreSQL 16 · TypeScript strict.

## Disciplina de trabalho nesta pasta: superpowers

O plugin `superpowers` está habilitado na sessão. Dentro de `backend/` ele é a
disciplina padrão — invoque as skills dele antes de escrever código:

1. **Brainstorm antes de implementar.** Regra de negócio financeira raramente é
   óbvia (estorno parcial, transferência entre contas, recorrência que cai em
   feriado). Desenhe os casos antes de abrir o editor.
2. **TDD red/green.** Escreva o teste que falha, veja falhar, então implemente.
   Vale especialmente para arredondamento, saldo e recorrência.
3. **Debugging sistemático.** Bug de saldo é reproduzido com um teste, não
   corrigido por inspeção.
4. **Code review por subagente** antes de considerar uma feature pronta.

Design visual não é assunto daqui — isso é [../frontend/CLAUDE.md](../frontend/CLAUDE.md).

## Comandos

```bash
npm run db:up             # sobe o Postgres (docker compose)
npm run start:dev         # API em watch → http://localhost:3000/api
npm test                  # unit
npm run test:e2e          # e2e (precisa do banco de pé)
npm run lint

npm run migration:generate -- src/database/migrations/NomeDaMigration
npm run migration:run
npm run migration:revert
```

Primeira vez: `cp .env.example .env`.

`db:up` sobe só o serviço `postgres` do [../docker-compose.yml](../docker-compose.yml)
— não existe mais compose próprio nesta pasta.

Rodando o stack inteiro em container (`docker compose up` na raiz), os mesmos
comandos valem com `docker compose exec backend` na frente. O `.env` local ainda
é lido lá dentro (vem pelo bind mount), mas as variáveis do compose têm
precedência — é o que faz `DB_HOST` valer `postgres` sem editar o `.env`:

```bash
docker compose exec backend npm run migration:run
docker compose exec backend npm test
```

## Dinheiro

**Nunca `float`, nunca `number` no banco.**

- Coluna: `@Column('numeric', { precision: 14, scale: 2, transformer: money })`,
  usando `money` de [src/common/database/numeric.transformer.ts](src/common/database/numeric.transformer.ts).
- **Agregação roda em SQL** (`SUM`, `AVG`, window function), nunca acumulando em
  JS. `0.1 + 0.2 !== 0.3`, e numa lista de lançamentos o erro se propaga.
- Sinal: guarde o valor sempre positivo e um `type` (`credit`/`debit`) separado.
  `-0` e comparações de sinal são fonte recorrente de bug.
- Moeda é explícita por transação (coluna `currency`, ISO-4217), mesmo que hoje
  só exista BRL.

## Schema

`synchronize` está **desligado** em toda configuração — ver
[src/database/data-source.ts](src/database/data-source.ts). Toda mudança de
schema é uma migration versionada, revisada antes de rodar. Migration que
transforma dado existente precisa de `down` que realmente reverte, ou de uma
nota explícita de que é irreversível.

## Recorrências (F1)

Um motor só para renda (E5) e gasto fixo (E6): a diferença está no `type` e no
ajuste padrão, **nunca no cálculo**. Tudo em
[src/recurrences/recurrence-schedule.ts](src/recurrences/recurrence-schedule.ts)
é função pura sobre string de data — nenhum `new Date()` sem argumento, porque
"hoje" implícito faz o teste passar em agosto e falhar em março.

- **Dia útil = segunda a sexta, feriado não conta** (decisão #4). O desvio de um
  dia em mês com feriado na primeira semana é conhecido e aceito: em 2026 atinge
  janeiro, maio e novembro, afeta a data prevista e nunca o valor. O caminho de
  volta é uma tabela de feriados e uma condição a mais em `isBusinessDay`, dentro
  de [business-days.ts](src/common/date/business-days.ts) — nada fora do arquivo
  precisa saber.
- **`competence` ≠ `occurred_at`, e é por isso que são duas colunas.** Dia 1 de
  novembro de 2026 é domingo: com `previous_business_day` o dinheiro entra em
  30/10, mas a competência continua sendo novembro.
- **Dia 31 clampa, nunca pula o mês.** Fevereiro vira 28 (ou 29).
- **Reajuste é INSERT em `recurrence_amounts`, nunca UPDATE.** Uma coluna
  `amount` na recorrência transformaria todo aumento numa falsificação
  retroativa do histórico.
- **Idempotência é constraint, não `if`.** `UNIQUE (recurrence_id, competence)`
  em `generated_transactions` é a trava contra salário dobrado; um `if` na
  aplicação perde a corrida entre duas réplicas.
- **`generated_transactions.transaction_id` é `ON DELETE SET NULL`, não
  CASCADE.** A linha vira lápide quando o usuário apaga o lançamento. Com
  CASCADE a marca sumiria junto e o job recriaria o lançamento — o salário
  apagado voltaria sozinho todo dia.
- **Não retroage antes do cadastro.** Recorrência cadastrada em agosto com
  início em maio não inventa maio a julho; isso é ação explícita do usuário
  (`includeBeforeCreation`). O mesmo piso faz o job recuperar meses perdidos
  quando fica fora do ar.
- **`status = 'pending'` fica fora do saldo realizado.** Gasto recorrente nasce
  pendente; sem o filtro no `BALANCE_SQL`, materializar a conta de luz debitaria
  a conta no mesmo instante.
- **O cron roda de hora em hora, não uma vez por mês.** Mensal parece o óbvio e
  é frágil: container parado naquele minuto = ninguém recebe salário no mês. A
  frequência só é segura porque a idempotência é constraint — as execuções
  extras saem sem escrever nada.
- **Cadastrar e retomar materializam na hora**, não só o cron. Deixar tudo com
  o job abria um buraco de até 59 minutos em que a recorrência existia na
  listagem, dizia "todo dia 20", e não estava no extrato nem na projeção do fim
  do mês — sem nada na tela explicando a espera. É a mesma chamada que o job
  faz (`materializeOne`, o diff contra `generated_transactions`), então o job
  continua correto e simplesmente não acha trabalho depois. **Isto muda quando,
  não o quê**: recorrência que começa no futuro continua não gerando nada,
  porque o teto de `dueCompetences` é a competência corrente.
- **Retomar recupera as competências da pausa.** `dueCompetences` não conhece a
  janela de pausa — ela não está no schema —, então elas entram no diff. Já era
  assim pelo cron; a materialização no clique só torna visível na hora. Mudar
  isso exige guardar a janela, e é outra tarefa.
- **Competência trafega como `AAAA-MM` e é normalizada no service**, por
  `parseCompetence` — nunca num `@Transform` de DTO, que roda **antes** dos
  validadores e faria o `@Matches` reprovar o formato que ele mesmo produziu.

## Dashboard (F4)

Módulo de leitura pura: oito rotas sobre `transactions`, nenhuma entidade
própria. Tudo em [src/dashboard/period.ts](src/dashboard/period.ts) é função
pura sobre instante, pela mesma razão do motor de recorrências — `new Date()`
sem argumento faz o teste passar em agosto e falhar em março.

- **O predicado de filtro é compartilhado com a lista de lançamentos.**
  [transaction-filter.ts](src/transactions/transaction-filter.ts) é o único
  lugar do backend que escreve `andWhere` de filtro. O critério de aceite de E9
  é "soma da tabela === total do cartão"; com duas cópias do `WHERE` isso vira
  promessa, e a primeira diverge no filtro seguinte que alguém adicionar.
- **O painel mostra o realizado**: `status = 'paid'` e `occurred_at <= now()`,
  exatamente o recorte do `BALANCE_SQL`. Pendente e futuro existem, mas na
  projeção — é a diferença entre "para onde foi meu dinheiro" e "quanto vou ter
  depois de pagar tudo".
- **A projeção ignora o período de propósito**, e a tela diz isso. "Como estará
  meu saldo no fim do mês" respondido sobre um recorte de março passado seria um
  número sem significado. O filtro de conta continua valendo.
- **O comparativo agrupa por `competence`, não por `occurred_at`.** A conta de
  agosto paga em 2 de setembro é despesa de agosto; agrupar pela data de
  pagamento faria o gráfico medir o calendário do banco.
- **O acumulado é do recorte, começando em zero** — não o saldo absoluto. Com
  filtro de categoria o saldo da carteira não significa nada ("saldo filtrado
  por Alimentação"), enquanto o acumulado significa. Saldo absoluto é a
  Carteira; fim do mês é a projeção.
- **Subcategoria soma dentro da mãe** (`COALESCE(leaf.parent_id, leaf.id)`). O
  lançamento aponta para a folha, mas "para onde foi o dinheiro" se responde no
  nível em que o orçamento é definido — e a rosca comporta seis fatias, que duas
  categorias com três filhas cada já estouram.
- **...e a fatia carrega a própria quebra em `children`.** Somar dentro da mãe
  responde "quanto"; a pergunta seguinte é sempre "mãe onde?". São duas
  consultas, não um `GROUPING SETS`: a de cima desenha a rosca assim que chega e
  a de baixo só importa no clique. Derivar a de cima somando a de baixo seria
  possível e seria pior — obrigaria a reduzir dinheiro em JavaScript.
- **`children` nunca vem vazia, e `categoryId: null` nela não é dado faltando.**
  É o lançamento que parou na mãe e não desceu para subcategoria nenhuma —
  categoria sem filhas devolve exatamente um item, esse. Lista vazia leria como
  "não consegui calcular", que é a leitura errada mais provável.
- **`share` do filho é dentro da mãe**, não do recorte: "metade da alimentação
  foi padaria" é a leitura útil; "padaria é 4% do meu mês" a rosca já respondeu
  um nível acima.
- **Orçamento é mensal e o recorte pode não ser.** Num trimestre o teto
  comparável é o triplo, senão toda categoria dentro do previsto acusa estouro.
- **`generate_series` para os dias vazios.** Dia sem lançamento é ponto de altura
  zero, não buraco: uma série que pula o fim de semana desenha entre sexta e
  segunda uma reta que não aconteceu.
- **`AT TIME ZONE 'UTC'` nos dois lados do `date_trunc`, e a data sai como
  texto.** Sem o primeiro, o dia quebra conforme o fuso da sessão; sem o
  segundo, o driver devolve `timestamp` como Date local e a data anda um dia
  para trás num container fora de UTC.
- **O dia a dia não é rota nova: são duas colunas a mais na série diária.**
  `income` e `expense` por `occurred_at`, ao lado do `net` que já existia. Uma
  sétima rota faria o mesmo `WHERE` uma vez a mais, e o painel passaria a poder
  mostrar um total mensal que não bate com a soma dos dias.
- **`by-account` ordena por SAÍDA, não por saldo.** A pergunta é "de qual cartão
  está saindo mais", e cartão de crédito costuma ter saldo zero e ser o maior
  gasto do mês. Saldo é assunto da Carteira. `transfer` fica de fora — ela tem
  os dois pés no comparativo e dobraria o valor movido em toda leitura —, conta
  sem movimento entra com zero (ausência lê como dado faltando), e arquivada só
  aparece se teve movimento no recorte.
- **O denominador de `share` sai de uma window function**, não de um `reduce`
  sobre as linhas devolvidas: a participação é razão, mas o total é dinheiro.
- **`GET /dashboard/day` existe porque `GET /transactions` daria a lista
  errada.** A lista de lançamentos não conhece o realizado (`paid` + passado) e
  não sabe expressar categoria excluída, faixa de valor nem várias contas — a
  gaveta abriria o boleto pendente de R$ 300 embaixo de uma coluna de R$ 80.
  Aqui é o mesmo `realized()` dos gráficos, então a gaveta não tem como
  discordar da coluna.
- **O dia é meia-noite UTC a meia-noite UTC**, o mesmo recorte que o
  `date_trunc(... AT TIME ZONE 'UTC')` da série produz. Usar o dia local do
  servidor faria um lançamento das 22h cair num dia no gráfico e noutro na
  lista.
- **A lista do dia vem truncada (50) com a contagem cheia**, como
  `GET /categories/:id/usage`. Os totais vêm da consulta, não de uma soma dos
  itens devolvidos — que é o que salvaria o dia com duzentos lançamentos.

## Contas: a marca do banco

`accounts.icon` guarda um **slug de catálogo** (`nubank`, `banco-do-brasil`), não
um arquivo nem uma URL — o desenho de cada marca vive no frontend, em SVG.

- **Não existe upload, e é decisão, não pendência.** Aceitar imagem do usuário
  exigiria storage, limite de tamanho, varredura de conteúdo e uma rota que
  serve binário autenticado; o problema real — reconhecer o cartão numa lista —
  se resolve com trinta e seis ladrilhos e nenhuma dessas peças.
- **A validação é de formato, nunca de catálogo.** Um `@IsEnum` aqui obrigaria
  deploy de backend para cada banco novo. O que o backend garante é que o valor
  é um identificador inofensivo (`^[a-z0-9][a-z0-9-]{0,31}$`), e o CHECK da
  migration repete a mesma regra no banco. Slug que a tela não conhece cai no
  ladrilho de iniciais — some o desenho, nunca a linha.
- **`icon` no PATCH tem três estados**, como o `reassignToId` de categorias:
  ausente não mexe, `null` remove, string troca. Um `?? null` no service
  apagaria o ícone de quem só quis renomear a conta.

## Categorias: arquivar e excluir

Duas saídas para a mesma categoria, e elas respondem a perguntas diferentes.
**Arquivar** (`POST /:id/archive`) tira das listas e preserva o histórico — a
categoria continua existindo para quem for ler um mês fechado. **Excluir**
(`DELETE /:id`) apaga a linha.

- **A regra que as duas dividem é a única inegociável: lançamento não fica
  órfão.** Havendo vínculo, a operação exige destino explícito. É por isso que
  não existe `ON DELETE CASCADE` em `transactions.category_id` — o banco recusar
  é a última linha de defesa, não a primeira.
- **`reassignToId` na exclusão tem três estados, e é de propósito.** Ausente →
  409 com a contagem (o aviso que a tela transforma em lista); `null` →
  desvincula, e os lançamentos voltam para a fila de revisão; UUID → realoca
  para uma categoria do mesmo `kind`. `@IsOptional()` pula a validação em
  `undefined` **e** em `null`, que é o que permite os três com um campo só — e
  é o que obriga o corpo a ir num DELETE, já que query string não sabe dizer
  `null`.
- **Desvincular zera `classification_source` e `classified_at`.** Um
  `'manual'` sobre `category_id IS NULL` descreveria uma escolha que não está
  mais lá, e a fila de revisão lê exatamente essa coluna.
- **Recorrência segura a categoria tanto quanto lançamento.** Contar só
  `transactions` deixaria o DELETE passar pela validação e estourar no FK de
  `recurrences` — 500 no lugar de um aviso. As duas entram na contagem e as duas
  são realocadas.
- **Categoria padrão também se exclui.** Ela nasce com a conta por conveniência,
  e conveniência que não se pode recusar é obstáculo. O que protege o histórico
  é a realocação obrigatória, não a imortalidade da linha.
- **`GET /:id/usage` é conselho, não permissão.** Existe para a tela poder
  mostrar *quais* lançamentos seguram a categoria antes do clique destrutivo. A
  lista vem truncada (50) com a contagem cheia; entre a consulta e o DELETE cabe
  um lançamento novo em outra aba, e é o 409 que continua sendo a guarda.

## Lançamentos: a lista

- **`order=asc` existe para o agendado.** A lista é `occurred_at DESC` por
  padrão, que é a leitura de extrato. No que ainda vai acontecer a ordem se
  inverte: o topo tem de ser o próximo, não o mais distante — com `desc`, a
  primeira página do futuro traz dezembro e esconde amanhã atrás de três
  "carregar mais". **A comparação do cursor acompanha a ordem** (`>` em vez de
  `<`); mantê-la fixa faria o "carregar mais" repetir a mesma página para
  sempre.

## Convenções

- Módulo por domínio: `src/<dominio>/` com `*.module.ts`, `*.controller.ts`,
  `*.service.ts`, `dto/`, `entities/*.entity.ts`.
- DTO de entrada sempre com `class-validator`. O `ValidationPipe` global usa
  `whitelist` + `forbidNonWhitelisted`, então campo não declarado gera 400.
- Entidade **nunca** vai direto na resposta HTTP — mapeie para um DTO de saída.
  Evita vazar `password_hash`, `internal_notes` e afins por descuido.
- Datas na API: ISO-8601 UTC. Conversão de fuso é problema da borda de exibição.
- Config só via `ConfigService` tipado; `process.env` direto apenas em
  `data-source.ts`, que roda fora do contexto do Nest (CLI de migration).

## Autenticação

Guard **global** (`APP_GUARD` no `AuthModule`): rota nova nasce protegida, e abrir
acesso é um ato deliberado com `@Public()` no controller.

- Access token JWT curto + refresh **opaco e rotativo**, guardado como SHA-256.
  Cada login abre uma *família*; reapresentar um refresh já queimado revoga a
  família inteira.
- O access carrega `sid` (a família que o originou) e o guard confirma que ela
  segue viva — é o que faz logout e troca de senha derrubarem a sessão na hora,
  em vez de esperar os 15 minutos do token. Custa um `SELECT` indexado por
  request; ver [src/auth/sessions.service.ts](src/auth/sessions.service.ts).
- Senha em Argon2id (`@node-rs/argon2`, perfil OWASP). `password_hash` é
  `select: false` e nunca sai do backend.
- E-mail inexistente e senha errada respondem a mesma mensagem, e o login gasta
  o mesmo tempo nos dois casos (hash descartável).

## Estrutura

```
src/
  main.ts                            bootstrap: prefixo /api, helmet, CORS, ValidationPipe
  app.module.ts                      ConfigModule + TypeOrmModule + módulos de domínio
  config/env.validation.ts           .env inválido derruba o boot, não o primeiro request
  database/data-source.ts            opções compartilhadas runtime ↔ CLI de migration
  database/migrations/               migrations versionadas
  common/database/                   transformers, base entity
  common/date/competence.ts          mês do lançamento (chave dos relatórios)
  common/date/business-days.ts       dia útil = seg–sex, sem feriado (decisão #4)
  common/pagination/cursor.ts        paginação por cursor, nunca OFFSET grande
  auth/                              E1 — registro, login, refresh rotativo, reset de senha
  users/                             E1 — perfil (GET/PATCH /users/me)
  accounts/                          E2 — contas e saldo derivado em SQL
  categories/                        E3 — seed das 6 padrão, CRUD, arquivar e excluir com realocação
  transactions/                      E4 — lançamentos, filtros, auditoria
  recurrences/                       E5/E6 — motor de datas e materialização
  dashboard/                         E9 — agregações de leitura, tudo em SQL
  health/                            GET /api/health
```

## Testes

`npm test` roda unit (lógica pura de dinheiro e data). `npm run test:e2e` sobe o
`AppModule` inteiro contra o Postgres e cobre a API de ponta a ponta — ver a
seção de testes em [README.md](README.md).

O e2e roda contra um banco **dedicado**, `finances_test`, e limpa com `TRUNCATE`
entre os testes. `test/jest-e2e.json` fixa `maxWorkers: 1`: as suítes dividem
esse banco, e em paralelo uma apagaria os usuários da outra no meio do teste.

> **Isto já custou caro.** A suíte rodava contra o banco de desenvolvimento, e
> como toda tabela pende de `users` em `CASCADE`, um `TRUNCATE users` apagou
> contas e lançamentos reais. Duas defesas, e as duas precisam continuar de pé:
>
> - [test/setup-env.ts](test/setup-env.ts) redireciona `DB_DATABASE` antes de o
>   `AppModule` ser importado (`process.env` vence o `.env` no `@nestjs/config`).
> - `resetDatabase` **recusa truncar** banco cujo nome não termine em `_test`.
>
> Banco de teste novo: `CREATE DATABASE finances_test OWNER finances` e
> `DB_DATABASE=finances_test npm run migration:run`.

> **Windows:** se houver um PostgreSQL nativo instalado, ele ocupa a 5432 e o
> `localhost:5432` do host chega nele, não no container — o sintoma é
> `28P01 autenticação do tipo senha falhou`. Rode migration e e2e com
> `docker compose exec backend ...`, que usa a rede interna do compose.
