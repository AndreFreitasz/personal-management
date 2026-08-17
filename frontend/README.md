# frontend — interface de finanças

Single-page app do sistema de gerenciamento de finanças pessoais. React sobre
Vite, TypeScript em modo `strict`, Tailwind 4 com design tokens próprios e uma
regra que atravessa tudo: **o cliente formata dinheiro, não calcula**.

> Este arquivo descreve **o que existe e por quê**. As regras de trabalho para
> quem for programar aqui estão em [CLAUDE.md](CLAUDE.md).

## Tecnologias

| Camada            | Escolha               | Papel                                               |
| ----------------- | --------------------- | --------------------------------------------------- |
| Build             | Vite 6                | dev server com HMR, bundle de produção              |
| UI                | React 19              | —                                                   |
| Linguagem         | TypeScript strict     | —                                                   |
| Estilo            | Tailwind 4 (`@theme`) | utilitários sobre tokens definidos em CSS           |
| Dados do servidor | TanStack Query 5      | cache, revalidação, estados de carregamento         |
| Rotas             | React Router 7        | rotas públicas e protegidas, filtro na query string |
| Datas             | react-day-picker      | **única** biblioteca de UI do projeto               |
| Gráficos          | SVG escrito à mão     | sem biblioteca — ver "Gráficos" abaixo              |
| Qualidade         | ESLint + `tsc -b`     | `npm run lint`, `npm run typecheck`                 |

Duas famílias tipográficas são **autohospedadas** em `public/fonts` (subconjunto
latino, ~79 KB): Bodoni Moda e Space Mono. Não via CDN, porque a tela onde elas
mais aparecem é onde o usuário digita a senha — não é lugar de abrir conexão para
domínio de terceiro.

## Rotas

| Caminho         | Tela                          | Acesso    |
| --------------- | ----------------------------- | --------- |
| `/entrar`       | login                         | público   |
| `/criar-conta`  | cadastro                      | público   |
| `/`             | carteira — saldo e contas     | protegido |
| `/painel`       | painel com filtros e gráficos | protegido |
| `/lancamentos`  | extrato, filtros, agendado    | protegido |
| `/recorrencias` | renda e gastos recorrentes    | protegido |
| `/categorias`   | árvore de categorias          | protegido |

O bloco protegido passa por `require-auth.tsx`, que conhece **três** estados de
sessão — `loading`, `authenticated`, `anonymous`. O terceiro existe porque, ao
recarregar a página, a sessão só é conhecida depois que o refresh volta do
servidor; sem ele, um F5 no painel chutaria o usuário autenticado para o login.

## Design system

### Tokens, não valores soltos

A paleta e o vocabulário de movimento vivem em `@theme` dentro de
[src/index.css](src/index.css), nunca espalhados em classes arbitrárias. Tailwind
4 expõe cada custom property como utilitário: `--color-positive` vira
`text-positive` e `bg-positive`.

Precisando de uma cor nova, **adiciona-se um token** — não se escreve
`text-[#1f9d55]` no componente. As cores são declaradas em OKLCH para que o par
claro/escuro mantenha a mesma luminância percebida.

A paleta é a **Cédula**: verde-cofre, papel, tinta. O verde tem dois papéis
separados, `--color-primary` para preenchimento de botão e `--color-primary-ink`
para texto e link, porque o mesmo verde que passa em contraste como fundo reprova
como texto.

### Tema

Três preferências, não duas: `light`, `dark` e `system`. O padrão é claro.

O CSS conhece só `:root[data-theme='dark']`; `system` é resolvido em JavaScript,
em [lib/theme.ts](src/lib/theme.ts). O tema é decidido **antes da primeira
pintura**, por um script inline no `<head>` do [index.html](index.html) — deixar
isso para o bundle significaria pintar claro e trocar para escuro quando o módulo
chegasse, um flash branco em tela cheia a cada reload.

### Movimento

Um vocabulário só para o app inteiro, em tokens: três tempos (`--motion-press`,
`--motion-tint`, `--motion-settle`) e uma mola (`--ease-ios-spring`). Botão, link,
campo e a pílula da navegação usam a mesma curva — é o que faz a interface soar
como um instrumento só.

Sob `prefers-reduced-motion` o transform é neutralizado, não acelerado. A **cor**
continua atravessando: reduzir movimento não é reduzir informação.

Três peças cobrem tudo que entra ou sai de tela, e elas bastam:

- **`<Collapse open>`** para o que revela — formulário que abre, painel de erro.
- **`<Modal>`** sobre `<dialog>` nativo, de onde vêm prisão de foco, Esc e `inert`
  no fundo de graça.
- **`<ConfirmDialog>`** para a ação destrutiva que cabe numa frase.

### Campos de valor e data

`<MoneyInput>` e `<DateField>` / `<MonthField>` são o **único** caminho para valor
e data. O que se vê não é o que se envia: o campo visível não tem `name`, e quem
responde pelo formulário é um `<input type="hidden">` com o valor canônico
(`1234.56`, `AAAA-MM-DD`).

Na máscara de dinheiro não existe `Number()` — ela move dígitos como texto.
Converter para float e formatar de volta reintroduziria `0,1 + 0,2` bem na borda
de entrada.

## Gráficos

Os gráficos são **SVG escrito à mão**, em [components/charts.tsx](src/components/charts.tsx),
e não por gosto: a cédula já é SVG gerado por código, o motion vem de tokens e a
cor sai de uma função validada — uma biblioteca traria o próprio sistema dos três,
e a primeira tarefa seria desligá-los.

- **A cor de gráfico é calculada, não escolhida.**
  [lib/chart-color.ts](src/lib/chart-color.ts) recebe o hex que o usuário escolheu
  para a categoria e devolve o mesmo matiz com luminosidade e croma dentro da
  faixa que o tema exige. Nenhum hex digitado num seletor de cor sobrevive à troca
  de tema e ao teste de daltonismo por acaso.
- **A ordem das fatias da rosca é fixa**, e é mecanismo de segurança: só vizinhos
  se tocam, e é o par vizinho que precisa passar no teste de daltonismo.
- **Todo gráfico tem tabela gêmea** e toda dica tem equivalente no teclado. Cor e
  mouse nunca são o único caminho até o número.
- No comparativo mensal a **posição** é a codificação primária — entrada acima da
  linha, saída abaixo. A cor é redundante, e é isso que faz o gráfico sobreviver
  em escala de cinza.

## Responsividade

Responsivo é requisito de pronto, não etapa posterior. Os alvos são **360px,
768px, 1280px e 1920px**.

- **A largura da página mora num lugar só**: `<Container>`. Nunca se escreve
  `max-w-*` ou `px-*` de página numa rota — se a largura precisa mudar, muda o
  token `--container-page` e muda para o app inteiro.
- A classe sem prefixo é o celular; `sm:`, `lg:` e `xl:` acrescentam.
- `min-w-0` em todo filho de flex que contenha texto, senão `truncate` não trunca.
- Tela larga pede **layout novo**, não coluna esticada.
- Rolagem horizontal na página é bug.

## Regras não negociáveis

- **Aritmética de dinheiro não acontece aqui.** Totais, saldos e médias vêm
  calculados do backend, em SQL. O cliente formata o que recebe.
- **Formatação só na borda de renderização**, via [lib/format.ts](src/lib/format.ts).
  Nada de `toFixed(2)` espalhado por componente.
- **Cor nunca é o único sinal.** Entrada e saída carregam também sinal, rótulo ou
  ícone.
- **Valores monetários usam `tabular-nums`** (classe `.tnum`), senão a coluna do
  extrato dança a cada dígito.
- **Todo estado assíncrono tem três telas**: carregando, vazio e erro. Tela em
  branco quando a API cai é bug, não caso de borda.
- Datas chegam em ISO-8601 UTC e viram local só em `formatDate`. Para data padrão
  de formulário use `todayForInput()`, nunca `new Date().toISOString().slice(0,10)`
  — o segundo erra por um dia depois das 21h em São Paulo.

## Rodando

```bash
cp .env.example .env      # primeira vez
npm install
npm run dev               # http://localhost:5173
```

O Vite faz proxy de `/api` para `http://localhost:3000`, então em desenvolvimento
o frontend não precisa de CORS nem de URL absoluta. O backend precisa estar de pé.

Ou, com o stack inteiro em container a partir da raiz do repositório:

```bash
docker compose up
```

Lá o alvo do proxy vira `http://backend:3000` e o watcher usa polling — ambos por
variável de ambiente (`VITE_PROXY_TARGET`, `VITE_USE_POLLING`), sem tocar no
`vite.config.ts`.

> **Dependência nova exige `docker compose exec frontend npm install`.** O
> `npm install` do host não alcança o `node_modules` do container, que é volume
> nomeado — e `--build` também não basta, porque o volume sobrepõe o
> `node_modules` da imagem.

### Comandos

```bash
npm run dev         # dev server com HMR
npm run build       # typecheck + bundle de produção
npm run preview     # serve o bundle gerado
npm run lint
npm run typecheck
```
