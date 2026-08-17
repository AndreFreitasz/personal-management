# frontend — interface de finanças

React 19 · Vite 6 · TypeScript strict · Tailwind 4 · TanStack Query · React Router 7.

## Disciplina de trabalho nesta pasta: frontend-design

O plugin `frontend-design` está habilitado na sessão. Dentro de `frontend/` ele é
a disciplina padrão: **decida o design antes de escrever JSX**. Hierarquia,
espaçamento, densidade e estados vazio/carregando/erro são decisões de produto,
não sobras do fim da implementação.

Para gráficos — saldo ao longo do tempo, gastos por categoria, comparativo
mensal — invoque a skill `dataviz` **antes** da primeira linha de código do
gráfico, não depois.

Regra de negócio, schema e persistência não são assunto daqui — isso é
[../backend/CLAUDE.md](../backend/CLAUDE.md).

## Comandos

```bash
npm run dev         # http://localhost:5173, com proxy /api → localhost:3000
npm run build       # typecheck + bundle
npm run lint
npm run typecheck
```

Primeira vez: `cp .env.example .env`. O backend precisa estar de pé.

Alternativa: `docker compose up` na raiz sobe web + API + banco de uma vez, com
HMR funcionando. Lá o alvo do proxy vira `http://backend:3000` e o watcher usa
polling — ambos via variável de ambiente, sem tocar no `vite.config.ts`. Se
mexer no `package.json`, reconstrua: `docker compose up -d --build frontend`.

## Design tokens

A paleta vive em `@theme` dentro de [src/index.css](src/index.css), não espalhada
em classes arbitrárias. Tailwind 4 expõe cada custom property como utilitário:
`--color-positive` vira `text-positive` / `bg-positive`.

Ao precisar de uma cor nova, **adicione um token** — não escreva
`text-[#1f9d55]` no componente. Cores em OKLCH para que o par claro/escuro
mantenha a mesma luminância percebida.

Os tokens implementam a paleta **Cédula** — verde-cofre, papel, tinta. Os valores
em OKLCH saíram de conversão calculada a partir dos HEX de referência e de
verificação de contraste contra o fundo real. Três consequências dessa
verificação, que continuam valendo para qualquer token novo:

- O verde tem dois papéis. `--color-primary` é preenchimento de botão;
  `--color-primary-ink` é texto e link, porque o `#00875A` original dá 4,30:1
  como texto no tema claro — reprova em AA.
- Cor de categoria é **preenchimento**, nunca texto: `#E0A21A` sobre branco dá
  2,25:1. Use `CategoryDot` ao lado do nome em `--color-ink`.
- Seletor de tema: ver a seção "Tema" abaixo. A paleta escura vale para o app
  inteiro, inclusive para a cédula, que no escuro é a mesma nota vista sob luz
  ultravioleta — papel escuro, gravação luminescente.

## Tema

Três preferências, não duas: `light`, `dark` e `system`. A terceira existe
porque quem põe o SO em escuro à noite quer que o app acompanhe, não que ele
fique preso no que foi clicado de manhã. O padrão é **claro** — seguir
`prefers-color-scheme` sem perguntar foi o que fazia o app abrir como uma
parede escura para quem usa o sistema em modo noturno.

O CSS conhece só `:root[data-theme='dark']`; `system` é resolvido em JS
([src/lib/theme.ts](src/lib/theme.ts)). Um seletor só no CSS evita manter a
paleta escura duplicada em dois blocos que precisariam concordar.

- **O tema é decidido antes da primeira pintura**, por um script inline no
  `<head>` do [index.html](index.html). Deixar isso só para o `initTheme()` do
  bundle significaria pintar claro e trocar para escuro quando o módulo
  chegasse — um flash branco em tela cheia, a cada reload, exatamente para quem
  escolheu escuro para não levar branco na cara. É o único código duplicado
  entre HTML e TS, e a chave `financas.tema` é o que os dois compartilham.
- **`initTheme()` no [main.tsx](src/main.tsx) cobre o que o script inline não
  pode**: manter o atributo em dia quando a preferência é `system` e o SO troca
  de tema com o app aberto.
- **`localStorage` lança** quando o navegador bloqueia armazenamento (Safari
  privado, cookies de terceiros desligados). Como `theme.ts` roda no escopo de
  módulo e entra no boot, leitura e escrita são protegidas: preferência é
  enfeite, boot não é.
- **`<ThemeToggle>` são `<input type="radio">` de verdade** com `sr-only`, e o
  desenho no `<span>` ao lado. O navegador dá agrupamento, setas do teclado e
  anúncio de "2 de 3" de graça; uma fileira de `<button aria-pressed>` teria que
  reimplementar os três. O anel de foco vem de `peer-focus-visible` porque o
  `:focus-visible` global acerta o input, que não tem onde desenhar contorno.
- **O item marcado usa `primary-soft`, o mesmo da pílula da navegação.**
  `surface` sobre `surface-sunken` sobe no claro e AFUNDA no escuro, onde a
  paleta tem `surface` em 21,5% e `surface-sunken` em 25%.

## Movimento e hover

Um vocabulário só para o app inteiro, em `@theme` de [src/index.css](src/index.css).
Botão, link, campo e a pílula da navegação usam a **mesma mola** — é isso que faz
a interface soar como um instrumento só, e não como efeitos avulsos.

Três tempos, porque um controle real tem três: `--motion-press` (90ms, a descida
acompanha o dedo), `--motion-tint` (200ms, a cor atravessa para o verde) e
`--motion-settle` (420ms, a subida quica). A mola `--ease-ios-spring` é uma mola
sub-amortecida real (ζ=0,68) amostrada em `linear()`, **não** um bezier: bezier
não passa de 1 e portanto não consegue ultrapassar o alvo, que é justamente o
que separa "iOS" de `transition: all`.

- **A classe `.tap` cuida só de movimento** — transform, tempo e curva. Cor de
  hover vai em utilitário Tailwind no componente. Não é preciosismo: utilitário
  mora na camada `utilities`, que vence `components` por ordem de camada
  independente de especificidade, então um `.tap:hover { color }` perderia
  silenciosamente para o `text-ink-muted` da classe do botão.
- O controle **afunda** (`scale(0.96)`) sob o cursor, não cresce. Botão que
  cresce ao ser apertado não existe fora de uma tela.
- Hover fica atrás de `@media (hover: hover)`: em tela de toque ele gruda
  depois do tap.
- **O `cursor: pointer` de botão é nosso, não do framework.** O preflight do
  Tailwind v3 punha; o v4 tirou para seguir o padrão do navegador — que para
  `<button>` é `default`. A regra está no `@layer base` e cobre `button`,
  `[role=button]`, `select` e os `input` clicáveis. Se sumir, os botões voltam
  a não parecer clicáveis.
- `--color-primary-hover` **escurece** no tema claro e clareia no escuro. O
  branco sobre `--color-primary` já está em 4,56:1 — clarear reprovaria em AA
  justo no estado em que o cursor está no botão.
- **`variant="danger"` é a única coisa que não vira verde**, e é deliberado:
  aqui verde é `--color-positive` e `--color-primary` ao mesmo tempo, então
  pintar de verde o botão que apaga um lançamento mostraria a cor de
  confirmação no instante de destruir um registro. Uniformizar é uma linha em
  `BUTTON_VARIANT`.
- Sob `prefers-reduced-motion`, o transform é **neutralizado**, não acelerado —
  duração zero deixaria o `scale` acontecer como solavanco. A **cor** continua
  atravessando: reduzir movimento não é reduzir informação.

### Aparecer e sumir

Três peças cobrem tudo que entra ou sai de tela. **Use elas** em vez de
inventar a quarta.

- **`<Collapse open>`** para formulário que abre, painel que responde a um erro,
  qualquer revelação. A altura anima por `grid-template-rows: 0fr → 1fr`, que é
  a única forma de chegar a `auto` sem medir em JS — e medir quebraria toda vez
  que o conteúdo mudasse sozinho (o formulário de lançamento ganha um campo
  quando o tipo vira "transferência").
- **`<Modal>`** é a mecânica: `<dialog>` nativo com `showModal()`, de onde vêm
  prisão de foco, Esc, `inert` no fundo e camada de topo. **Não reimplemente com
  `position: fixed`** — a parte que se erra é sempre o foco, justo numa caixa
  que apaga dados. `size="lg"` quando há uma lista para ler dentro; o corpo é
  que rola, não a caixa, senão o botão de confirmar fica escondido atrás de
  trinta lançamentos.
- **`<ConfirmDialog>`** é o `<Modal>` com uma pergunta e dois botões, para a
  ação destrutiva que cabe numa frase. Quando não cabe — excluir categoria
  precisa **mostrar** os lançamentos presos nela antes de perguntar para onde
  vão — use o `<Modal>` direto.
- **`.row-leave` + `data-leaving`** para item saindo de lista. O estado vem da
  própria mutação (`mutation.isPending && mutation.variables === id`), nunca de
  um `setTimeout`: se a API recusar, a linha volta sozinha em vez de sumir de
  uma tela que ainda tem o registro.

Duas regras de mecânica que valem para as três:

- **Animação de saída exige o elemento montado.** `{open && <form/>}` desmonta
  no mesmo quadro do clique e não sobra o que animar. Por isso `Collapse`
  segura o desmonte até o `transitionend`.
- **Animação de entrada é `@starting-style`**, não `requestAnimationFrame`. Em
  `<dialog>`, `display` e `overlay` precisam de `allow-discrete` na transição,
  senão o elemento deixa a camada de topo no mesmo quadro do `close()` e a
  saída nunca aparece.

### O valor mudando

`.value-swap`, em [src/components/money.tsx](src/components/money.tsx). Quando o
saldo muda — criou uma conta, apagou um lançamento — o número novo **entra pelo
lado de onde veio**: de baixo se subiu, de cima se desceu. É a única animação do
app que carrega informação em vez de só acompanhar uma transição.

- **É uma troca, não uma contagem.** Um contador que sobe de 1.200 para 1.450
  passando por 1.317 exibe, por meio segundo, um saldo que nunca existiu. Num
  app cuja regra é que dinheiro não é calculado no cliente, inventar números
  intermediários na tela é a mesma mentira em outro lugar.
- O `tick` que serve de `key` vem de um `setState` **durante o render** — o
  padrão que o React documenta para derivar estado de props. O render em curso é
  descartado e refeito antes de pintar, sem quadro intermediário e sem o vaivém
  de um `useEffect`.
- Na primeira montagem nada anima: chegar na tela é entrada do cartão
  (`animate-rise`), não troca de valor. Duas animações no mesmo instante leem
  como falha de renderização.

### Filtro que não pisca

O extrato filtra pela URL, e o filtro faz parte do `queryKey`. Isso tem duas
consequências que precisam de tratamento explícito, as duas em
[src/routes/transactions.tsx](src/routes/transactions.tsx):

- **A busca por texto é adiada em 300ms** (`useDebouncedSearch`). Sem isso cada
  tecla escrevia na URL e abria uma requisição — chave nova, portanto sem cache,
  portanto trocando a lista por "Buscando lançamentos…". Digitar "mercado"
  disparava sete buscas e sete piscadas; hoje dispara **uma**. `Tipo` e `Conta`
  não esperam: escolha em `<select>` é deliberada, e atrasá-la seria latência
  inventada.
- **`placeholderData: keepPreviousData`**: o resultado anterior fica na tela,
  recuado (`.filtering`), até o novo chegar. O conteúdo anterior ainda é a
  melhor resposta disponível.
- **Dois sinais para dois fatos.** `pendingFilter` ("o que você vê ainda não é o
  que você digitou") vale desde a tecla e vira o texto "Filtrando…" — imediato é
  a partir da tecla, não da requisição. `filtering` (`isPlaceholderData`, "há um
  recorte em voo") é o único que recua a lista: recuar a cada tecla e voltar
  300ms depois seria a lista piscando de novo, agora em opacidade.

### A cédula

`.guilloche` é o filete de linhas paralelas do topo do cartão de saldo — a
citação da cédula que dá nome à paleta. Ficou definido no CSS e sem uso por
muito tempo. Se a home precisar de mais identidade, o caminho é esse, não mais
uma sombra.

## Telas públicas: a cédula que se imprime (E11, entregue)

Login e cadastro não são um cartão centralizado. São uma **mesa de impressão**
(`.press-bed`, verde-cofre) com a cédula à esquerda e o formulário à direita —
[src/routes/auth-shell.tsx](src/routes/auth-shell.tsx) e
[src/components/banknote.tsx](src/components/banknote.tsx). É o
elemento-assinatura da identidade visual do produto.

**Toda a ousadia mora de um lado só.** O formulário continua sendo o mesmo
`Field`/`Input`/`Button` do app autenticado, com o mesmo anel de foco e o mesmo
vocabulário de toque — só que em `size="lg"`. Se a próxima tela pública precisar
de personalidade, ela sai da nota, não de um controle novo.

- **Quatro chapas, uma por campo**, na ordem de uma casa da moeda: calcográfica
  (nome → moldura, medalhão e as iniciais), numeração (e-mail → o serial, que é
  derivado dele), fundo de guilhoché (senha ≥ 8) e selo (senha forte). A senha
  imprimir o fundo de segurança não é arbitrário: o guilhoché é a defesa da nota
  contra cópia, como a senha é a defesa da conta.
- **`Plates` é um objeto de quatro booleanos, não um contador.** Quem cai no
  campo de senha primeiro — autofill, `Tab` fora de ordem, gerenciador de senha —
  veria a nota parada em zero tendo digitado algo.
- **A mecânica é de transição, não de `animation`**, com o estado num
  `data-printed` no grupo de cada chapa. É o que permite a nota **desimprimir**
  pelo mesmo caminho quando o usuário apaga um campo. As classes são `.pl-draw`
  (traço gravado), `.pl-ink` (área entintada), `.pl-digit` (roda da numeradora) e
  `.pl-stamp` (o carimbo do selo); `--i` escalona o atraso de cada uma.
- **`pathLength="1"`** normaliza o comprimento de qualquer forma para 1, e é o
  que deixa um `stroke-dashoffset` só desenhar elipse, arco e retângulo sem
  medir nada em JS.
- **O guilhoché é gerado por código** (`lathe()`): N elipses cujo centro orbita o
  eixo, uma por passo de rotação — o torno de gravura de verdade. `N` é a
  densidade, e ela cresce a cada chapa.
- **O SVG é `aria-hidden`.** O progresso é dito em texto no `<PressStatus>`,
  numa região viva, e sempre no imperativo: a legenda aponta o próximo passo em
  vez de relatar o estado. A barra de força da senha em quatro degraus saiu —
  dizia a mesma coisa que o selo, duas vezes e em cor.
- **`prefers-reduced-motion` zera `transition-delay` também**, não só a duração.
  Sem isso a nota trocava a impressão suave por cem estalos espalhados por um
  segundo — exatamente a sequência que E11 manda não mostrar.
- O paralaxe da nota escreve `--nx`/`--ny` em `style`, sem passar por estado do
  React, e é desligado no JS quando não há ponteiro fino.

### Tipografia da cédula

Duas famílias **autohospedadas** em `public/fonts` (subconjunto latino, 79 KB no
total): **Bodoni Moda** para a gravação — didone de contraste alto é o que sai de
uma chapa gravada a buril — e **Space Mono** para a numeradora, a microimpressão
e as legendas. Entram por `--font-note` e `--font-serial`, tokens novos: trocar
`--font-display` mudaria a letra do app inteiro de tabela.

Autohospedadas, e não via CDN, porque é a tela em que o usuário digita a senha —
não é lugar de abrir conexão para domínio de terceiro. O `<link rel="preload">`
em `index.html` existe para o título não trocar de tipo na frente do usuário.

## Lançamentos: o que já foi e o que está agendado

A lista principal pede `to=agora`; o agendado tem consulta própria com
`from=agora&order=asc` e mora numa gaveta fechada acima dela.

- **Não é organização, é correção de leitura.** Misturados, os agendados ficam
  no topo — a data mais recente vem primeiro —, então quem abre a tela para
  conferir o gasto de ontem esbarra primeiro no boleto do dia 30.
- **Fechada, a gaveta mostra contagem e data do próximo**: é o que responde "vale
  abrir agora". A seta gira com `--ease-ios-spring`, a mesma mola do resto.
- **O instante que separa os dois é fixado uma vez por montagem** (`useState`
  com inicializador). Ele entra no `queryKey`; um `new Date()` a cada render
  trocaria a chave sem parar e a lista recarregaria para sempre.
- **Nenhum total é somado aqui.** A gaveta mostra quantos e quando, não a soma —
  aritmética de dinheiro no cliente é a regra que o app não quebra.

## Valor e data: os dois campos que todo formulário tem

`<MoneyInput>` ([money-input.tsx](src/components/money-input.tsx)) e
`<DateField>` / `<MonthField>` ([date-field.tsx](src/components/date-field.tsx))
são o **único** caminho para valor e data. Não use `<Input inputMode="decimal">`
nem `type="date"` em tela nova.

- **A vírgula não se digita.** Os dígitos entram pelos centavos: `1234` vira
  `12,34`. É o teclado de terminal de caixa, e resolve o defeito real — no
  celular a vírgula está escondida atrás de uma tecla, e no desktop as pessoas
  se dividem entre `.` e `,`.
- **O que se vê não é o que se envia.** O campo visível não tem `name`; quem
  responde pelo formulário é um `<input type="hidden">` com o valor canônico
  (`1234.56`, `AAAA-MM-DD`). Foi assim que os cinco formulários existentes não
  precisaram mudar uma linha de `data.get(...)`.
- **Nenhum `Number()` na máscara de dinheiro.** Ela move dígitos como texto.
  Converter para float e formatar de volta reintroduziria `0,1 + 0,2` na borda
  de entrada — a regra do app, agora no teclado.
- **Vazio continua vazio.** Teto de orçamento e faixa de valor são opcionais, e
  um campo que nasce `0,00` faria "sem teto" virar "teto de zero".
- **`<input type="date">` saiu.** O calendário nativo é do sistema operacional:
  muda de forma entre navegadores, ignora os tokens, não acompanha o tema
  escuro e no Firefox de desktop quase não existe. O de agora é
  `react-day-picker` vestido com os tokens do app — **a única biblioteca de UI
  do projeto**, e ela entrou porque a alternativa era reimplementar navegação de
  mês, teclado e locale.
- **Digitar continua sendo o caminho rápido.** `dd/mm/aaaa` com as barras
  entrando sozinhas; o calendário é atalho, não obrigação. Um seletor que só
  abre no clique transforma "31/08" em seis cliques de navegação.
- **Competência não é data.** `<MonthField>` mostra doze meses, não 31 dias:
  uma grade de dias obrigaria a inventar um dia que o dado não tem, e o usuário
  clicaria no dia 1 sem saber que ele foi ignorado.
- **A gaveta do calendário vive num portal, com `position: fixed`.** Ela era
  `absolute` dentro do campo, e isso a prendia a quem estivesse por cima:
  `.collapse-ios > *` tem `overflow: hidden` — a única forma de a altura chegar
  a zero na animação — e **todo formulário do app mora dentro de um
  `<Collapse>`**. O calendário aparecia cortado na primeira linha de semanas, e
  no formulário de lançamento dava o sintoma pior: `overflow: hidden` também é
  contêiner de rolagem, então o `autoFocus` do `react-day-picker` fazia o
  navegador **rolar o formulário** para trazer o dia focado à vista — os campos
  subiam para fora da caixa e o formulário parecia ter fechado sozinho. Pôr
  `overflow: visible` no `<Collapse>` não é opção: desliga o colapso.
- **O destino do portal é o `<dialog>` mais próximo, e o `<body>` só quando não
  há um.** `<dialog open>` sobe para a camada de topo e inertiza o resto da
  página; uma gaveta pendurada no `<body>` ficaria atrás do fundo escurecido e
  sem aceitar clique.
- **A posição é medida, não herdada** — `useLayoutEffect` antes da pintura, com
  virada para cima quando o rodapé não tem altura, e o `scroll` ouvido em
  `capture` porque o campo pode estar num contêiner que rola sem o evento subir
  até a janela.
- **A gaveta fecha de três jeitos** — Esc, clique fora e ao escolher — e o Esc é
  capturado (`capture: true`) para não vazar até o `<dialog>` que a contém e
  fechar o modal inteiro por baixo dela.
- **`CONTROL`/`CONTROL_SIZE` moram em [control.ts](src/components/control.ts)**,
  não em `ui.tsx`. Um arquivo que exporta componente **e** constante perde o
  fast refresh do Vite, e o sintoma é o formulário remontar e perder o que
  estava digitado a cada salvamento.

> **Dependência nova exige rebuild do container.** `npm install` no host não
> alcança o `node_modules` do container, que é volume nomeado — e `docker
> compose up -d --build frontend` **também não basta**, porque o volume sobrepõe
> o `node_modules` da imagem. O que resolve é
> `docker compose exec frontend npm install`.

## Data padrão de formulário

Use **`todayForInput()`** de `lib/format.ts`, nunca
`new Date().toISOString().slice(0, 10)`. O segundo converte para UTC e erra por
um dia: em São Paulo, tudo depois das 21h já é amanhã em Greenwich, e o
formulário abre com a data de amanhã. Um lançamento gravado assim nasce futuro e
fica fora do saldo — que é quando alguém percebe.

## Categoria e subcategoria

`<CategoryPicker>` é o único caminho para escolher categoria num formulário. São
dois campos, e não uma lista indentada: `<option>` não estiliza, então o recuo
viraria caractere de espaço, que some no Safari e é lido em voz alta. O segundo
campo só aparece quando a categoria tem filhas — **a ausência dele é a
informação** de que não há subcategoria. Sai um `categoryId` só, o da folha.

Na tela de categorias, raiz e subcategoria têm **Excluir**; só a raiz tem
Arquivar, e nessa ordem — a ação reversível no caminho do dedo, a definitiva no
fim.

- **O modal pergunta `GET /categories/:id/usage` ao abrir, não ao falhar.** A
  alternativa era disparar o DELETE, tomar 409 e traduzir a mensagem: o usuário
  descobriria o problema *depois* de mandar apagar. Aqui ele vê a lista de
  lançamentos antes de decidir.
- **O botão de confirmar fica travado enquanto o destino não é escolhido.**
  Havendo vínculo, um clique com o `<select>` intocado mandaria "sem destino" e
  voltaria como erro — punição por não responder uma pergunta que a tela deixou
  passar.
- **"Deixar sem categoria" é uma opção de verdade**, e não um jeito educado de
  dizer não. Forçar uma categoria errada para conseguir apagar outra é pior do
  que devolver os lançamentos para a fila de revisão.
- **A contagem e a lista são coisas diferentes.** O backend trunca em 50; a tela
  diz "e mais N" em vez de deixar o usuário achar que são só os que ele vê.

## Painel e gráficos (F4, entregue)

[routes/dashboard.tsx](src/routes/dashboard.tsx) monta a tela;
[components/charts.tsx](src/components/charts.tsx) tem as formas, todas em SVG
escrito à mão. Sem biblioteca de gráficos, e não por gosto: a cédula de E11 já é
SVG gerado por código, o motion vem de tokens e a cor sai de uma função
validada — uma biblioteca traria o próprio sistema dos três, e a primeira tarefa
seria desligá-los.

- **A cor de gráfico é calculada, não escolhida.**
  [lib/chart-color.ts](src/lib/chart-color.ts) recebe o hex que o usuário
  escolheu para a categoria e devolve o mesmo **matiz** com luminosidade e croma
  dentro da faixa que o tema exige. Cor de categoria é dado do usuário: nenhum
  hex digitado num `<input type="color">` sobrevive à troca de tema e ao teste
  de daltonismo por acaso.
- **A ordem das fatias da rosca é fixa, e é o mecanismo de segurança.** Só
  vizinhos se tocam. A ordem canônica e os alvos de L/C saíram do validador do
  método de dataviz: pior par adjacente em ΔE 8,6 no claro e 9,9 no escuro sob
  deuteranopia (piso 8), e 15,6 / 16,6 na visão normal (piso 15). **Mexeu nos
  números, rode o validador de novo** — quebrar isso não tem sintoma visível
  para quem enxerga as cores.
- **Pizza responde parte-do-todo; barra responde "qual foi o maior".** As duas
  existem porque são perguntas diferentes: ângulo se compara mal, comprimento a
  partir de uma base comum se compara bem.
- **No mês a mês, a posição é a codificação primária.** Entrada acima da linha,
  saída abaixo — a cor é redundante, e é isso que faz o gráfico sobreviver em
  tons de cinza, no par verde/vermelho que é justamente o que colapsa em
  deuteranopia.
- **Todo gráfico tem tabela gêmea** (o botão "Ver tabela") e toda dica tem
  equivalente no teclado: as marcas são focáveis e mostram no foco o que
  mostram no cursor. Cor e mouse nunca são o único caminho até o número.
- **Recarregando, o desenho anterior fica a 55%** (`.filtering[data-busy]`), sem
  esqueleto e sem salto de layout. É a mesma regra da lista de lançamentos.
- **A entrada anima por `transform`, nunca pelo atributo.** `d` de um `path` e
  `height` de um `rect` não transicionam; a coluna cresce por `scaleY` a partir
  da linha zero, e a linha se desenha por `pathLength` normalizado — a mesma
  técnica das chapas da cédula.
- **O filtro inteiro mora na URL**, e é um só para os widgets. Recarregar
  mantém o recorte e o link pode ser guardado — que é o filtro salvo de E9.F9
  sem a tabela que ele pediria.
- **"Dia a dia" é o mês a mês com o zoom aberto, e de propósito na mesma
  gramática**: entrada acima da linha, saída abaixo, uma escala só. O que muda é
  só o que a densidade obriga — marca afinando até 1,5px (duas colunas de 6px se
  sobrepõem numa faixa de 9px, e o gráfico passaria a mentir sobre qual barra é
  de qual dia), rótulo de eixo a cada N dias, faixa recessiva no fim de semana e
  foco só nos dias com movimento.
- **Clicar numa coluna do "dia a dia" abre os lançamentos daquele dia**, numa
  gaveta entre o gráfico e os totais do mês — detalhar a coluna logo acima dela
  é o que dispensa uma seta explicando a relação. O dia aberto fica marcado em
  `primary-soft` e **vence o cursor**: a faixa não pode apagar quando o ponteiro
  passa noutro dia. `role="button"` num `<g>` não ganha Enter/Espaço de graça —
  o teclado é tratado à mão, senão o gráfico teria foco visível e nada
  acontecendo nele.
- **A gaveta consome `GET /dashboard/day`, nunca a lista de lançamentos.** O
  gráfico mostra o realizado e a lista mostra tudo: uma coluna de R$ 80 abriria
  uma gaveta com o boleto pendente de R$ 300 dentro. O `<Collapse>` segura o
  desmonte até o fim da transição, então o dia sai do estado por um segundo
  estado (`closing`) — zerar direto animaria a altura de uma lista vazia.
- **Mês do "dia a dia" e escopo do comparativo de contas são LENTE, não
  recorte.** Nenhum dos dois busca nada nem escreve na URL: recortam o que já
  veio. Desenhar 365 colunas num período de 12 meses daria 3px por dia — o
  gráfico morreria exatamente quando alguém abre um ano para investigar.
- **A barra do comparativo de contas é de uma cor só**, mesmo com o ladrilho
  colorido do banco ao lado. Cor de gráfico aqui é calculada e validada contra
  daltonismo; trinta cores institucionais não passariam. O ladrilho é **chip de
  identidade**, não marca de dado — o comprimento carrega o valor.
- **Clicar numa conta do comparativo joga ela no filtro do painel.** É o caminho
  curto entre "este é o maior" e "então me mostre só ele".

### A faixa de segurança — a fatia aberta por dentro

Clicar numa fatia da roseta abre a quebra por subcategoria, numa gaveta abaixo
dela — a mesma gramática do dia clicado no "dia a dia", e pelo mesmo motivo:
detalhar logo abaixo do que foi tocado dispensa uma seta explicando a relação.

- **Uma barra empilhada de 100%, não uma segunda rosca.** A pergunta mudou: ao
  chegar aqui o leitor já sabe que parte do mês a categoria comeu, e agora quer
  saber em que ela se divide. Uma rosca dentro da rosca faria comparar ângulo
  contra ângulo para responder o que uma linha responde por comprimento.
- **A cor da quebra é rampa SEQUENCIAL** (`chartInkRamp`), um matiz só do forte
  ao fraco. Subcategoria não é categoria nova — pintar "Padaria" de outro matiz
  diria o contrário e brigaria com a ordem canônica validada da roseta.
- **A rampa não é canal de identidade, e não poderia ser.** Dois degraus
  vizinhos separam por pouca luminosidade de propósito. Quem nomeia cada
  segmento é a linha logo abaixo — contagem, nome, valor e parte —, e o que
  separa um segmento do outro no desenho é o vão de 2px, que é geometria.
- **Cinco segmentos, e o número é medido.** Os extremos da rampa ficam dentro da
  faixa validada do tema **e** dentro do que sustenta 3:1 contra a
  `surface-sunken` (WCAG 1.4.11, elemento gráfico): L 0,625 no claro, 0,550 no
  escuro. Sobra 0,11 de luminosidade no escuro — um sexto degrau separaria
  vizinhos por menos de 0,02. Do sexto em diante, "Outras (N)".
- **"Nenhuma subcategoria" ganha hachura, e não só um degrau.** É o único balde
  cuja informação é uma ausência, e ausência não pode depender de reconhecer um
  tom. A frase no rodapé existe porque o rótulo sozinho lê como falha de
  carregamento — ela diz de onde o lançamento veio e aponta o próximo passo.
- **A contagem é o carretel da numeradora**: `03×`, sempre dois dígitos, na
  `font-serial` que já é a letra da numeração de E11. O zero à esquerda mantém a
  coluna alinhada quando uma contagem passa de nove.
- **A legenda abre a quebra tanto quanto o anel.** No celular a fatia tem 18px
  de espessura; uma função que só abrisse pelo arco existiria no desktop e não
  no telefone.
- **Entrada por `animation`, realce por `transition`.** O escalonamento vive em
  `animation-delay`; num `transition` o atraso ficaria colado no elemento e o
  realce do cursor chegaria meio segundo depois do cursor. Onde as duas coisas
  moram no mesmo lugar — os segmentos da barra — são dois `span` aninhados.
- **O filete `.guilloche` finalmente tem uso**, vestido com a tinta da categoria
  (`--guilloche-ink`). É o que identifica o painel sem gastar uma segunda
  etiqueta escrita repetindo o nome.

## A marca da conta

`<AccountIcon>` ([components/account-icon.tsx](src/components/account-icon.tsx))
sobre o catálogo de [lib/banks.ts](src/lib/banks.ts) — uma peça só, usada na
carteira, nos filtros do painel e no comparativo entre cartões. É o que faz "o
roxo" significar Nubank nos três lugares.

- **O logotipo mora em arquivo, não em código.** Cada marca é um SVG em
  [public/banks/`<slug>`.svg](public/banks/README.md), e o componente pede
  `/banks/<slug>.svg` para **qualquer** slug — esteja ele no catálogo ou não.
  Acrescentar um banco é largar um arquivo na pasta; trocar uma reprodução pela
  oficial é sobrescrever o arquivo. Nenhum build, tipo ou componente muda.
- **`banks.ts` não desenha nada.** Ele dá a lista do seletor (nome, grupo,
  ordem) e a cor do ladrilho de reserva. As duas coisas são independentes: banco
  listado sem arquivo mostra ladrilho, arquivo sem entrada no catálogo funciona
  para uma conta já cadastrada.
- **Três degraus, nessa ordem:** logotipo → ladrilho da cor da marca com
  monograma → ladrilho com as iniciais da conta. Não dá para saber se um arquivo
  existe antes de pedir, então o `onError` do `<img>` é o que transforma o 404
  em reserva em vez de ícone quebrado. **Em dev isso não é 404**: o fallback SPA
  do Vite devolve `index.html` com 200, e o `onError` dispara mesmo assim porque
  HTML não decodifica como imagem — está verificado, não suposto.
- **Metade das linhas com desenho e metade sem fica pior que nenhuma**: o olho
  passa a procurar a ausência. Por isso conta sem marca ainda ganha ladrilho.
- **Cinco marcas são vetor oficial** (Nubank, PicPay, Mercado Pago, PagBank,
  Wise, via simple-icons/CC0); as outras nove são **reprodução** desenhada a
  partir da forma e da cor institucional. A procedência de cada uma está no
  README da pasta — não no código, porque quem vai trocar o arquivo está lá.
- **O anel é `ring-ink/10`, não uma borda fixa.** No claro ele escurece a borda
  do ladrilho amarelo do BB; no escuro, clareia a do ladrilho quase preto da XP.
  Cor fixa serviria a um tema e sumiria no outro.
- **O seletor são `<input type="radio">` de verdade** com `sr-only`, como o
  `<ThemeToggle>`: agrupamento, setas do teclado e "12 de 36" saem de graça. O
  anel de foco vem de `has-focus-visible` no ladrilho, porque o input não tem
  onde desenhar contorno.
- **Não passa por `<Field>`** no formulário de conta: ali o rótulo é
  `<label for>`, e não existe controle nativo para ele apontar.

## Layout e responsividade

**Vale para toda tela, toda feature e toda tarefa futura.** Não existe "depois
eu adapto para o celular": responsivo aqui é requisito de pronto, igual aos três
estados de carregamento. Uma tela que só funciona em 1440px não está pronta.

### A largura mora num lugar só

`<Container>` ([src/components/ui.tsx](src/components/ui.tsx)) é a única coisa
que decide largura de página e respiro lateral. Cabeçalho e conteúdo passam por
ele; o que vier depois também passa.

- **Nunca escreva `max-w-*` ou `px-*` de página numa rota.** Foi assim que o app
  ficou preso em `max-w-4xl` (896px) usando metade de uma tela de 1870px. Se a
  largura precisa mudar, muda `--container-page` no `@theme` — hoje 90rem — e
  muda para o app inteiro de uma vez.
- `max-w-*` dentro de uma rota só se presta a **limitar linha de leitura** (o
  `max-w-sm` do texto de estado vazio, por exemplo), nunca a definir a página.

### Mobile primeiro, e de verdade

A classe sem prefixo é o celular; `sm:`, `lg:`, `xl:` acrescentam. Os alvos são
**360px, 768px, 1280px e 1920px** — teste nos quatro antes de dar por pronto.

- **Linha de lista** = bloco de texto com `min-w-0 flex-1` mais um bloco de ação
  `shrink-0` que empilha no celular (`flex-col items-end`) e volta para a linha
  no desktop (`sm:flex-row sm:items-baseline`). Ver a linha do extrato em
  [src/routes/transactions.tsx](src/routes/transactions.tsx). Jogar valor, data e
  botão como irmãos soltos de um `flex-wrap` é o que fazia o botão cair sozinho
  numa terceira linha em tela estreita.
- **`min-w-0` em todo filho de flex que contém texto.** Sem ele o `truncate` não
  trunca: o mínimo automático do flex é o conteúdo, e a linha estoura para fora
  do cartão em vez de cortar.
- **Coluna de largura fixa é privilégio de tela larga.** A data do extrato ocupa
  80px no desktop e desce para a linha de apoio no celular — 80px fixos são 23%
  de uma tela de 360px gastos num dado que cabe ao lado de outro.
- **Formulário acompanha a largura**: `sm:grid-cols-2` e `lg:grid-cols-3` quando
  há campo suficiente. Dois campos de 600px num cartão de 1300px é largura que
  nenhum dos dois usa.
- **Tela larga pede layout novo, não coluna esticada.** A carteira vira duas
  colunas no `xl` (resumo ao lado da lista). Só aumentar o contêiner transforma
  espaço extra em espaço em branco mais largo.
- Nada de `100vw` nem largura fixa em px em contêiner: `vw` ignora a barra de
  rolagem e gera rolagem horizontal. **Rolagem horizontal na página é bug.**

## Regras não negociáveis

- **Cor nunca é o único sinal.** Entrada/saída sempre carrega também sinal (`+`/`−`),
  rótulo ou ícone. Vermelho/verde sozinho exclui ~8% dos homens.
- **Toda tela nasce responsiva**, do celular ao monitor largo, e passa por
  `<Container>`. Ver a seção de layout acima.
- **Valores monetários usam `tabular-nums`** (classe `.tnum`) — sem isso a coluna
  de extrato dança a cada dígito.
- **Formatação só na borda de renderização**, via [src/lib/format.ts](src/lib/format.ts).
  Nada de `toFixed(2)` espalhado por componente.
- **Aritmética de dinheiro não acontece aqui.** Totais, saldos e médias vêm
  calculados do backend, em SQL. O cliente formata o que recebe.
- **Todo estado assíncrono tem três telas**: carregando, vazio e erro. Uma tela
  em branco quando a API cai é bug, não caso de borda.
- Datas chegam em ISO-8601 UTC e são convertidas para local só em `formatDate`.

## Sessão

Três estados, não dois: `loading`, `authenticated`, `anonymous`. O terceiro
existe porque, ao recarregar a página, a sessão só é conhecida depois que o
refresh volta do servidor — sem ele, o F5 no dashboard chutaria o usuário
autenticado para o login.

- **Access token em memória** (expira em 15 min, não precisa sobreviver a
  reload); **refresh no `localStorage`**, senão fechar a aba desloga todo dia.
  O trade-off é conhecido: `localStorage` é alcançável por XSS, e a defesa aqui é
  o refresh ser rotativo — reapresentar um token queimado revoga a família
  inteira. Ver [src/lib/token-store.ts](src/lib/token-store.ts).
- `api.ts` renova a sessão **uma vez** ao tomar 401 e repete a chamada.
  Renovações concorrentes compartilham a mesma promessa: dois 401 simultâneos
  usando o mesmo refresh seriam lidos pelo backend como replay, e derrubariam a
  sessão inteira.
- Sair limpa o cache do React Query. Sem isso, o próximo login veria o dado
  financeiro da conta anterior.

## Estrutura

```
src/
  main.tsx              providers + rotas (públicas e protegidas)
  App.tsx               shell autenticado: cabeçalho, navegação, <Outlet/>
  index.css             @theme com os design tokens + base layer
  components/ui.tsx     contêiner de página, botão, campo, cartão e os três
                        estados assíncronos
  components/money.tsx  valor com sinal, saldo, marcador de categoria
  components/banknote.tsx  a cédula em SVG, impressa por chapa (E11)
  lib/note.ts           série, iniciais e o modelo das quatro chapas
  lib/api.ts            fetch com Bearer e refresh automático no 401
  lib/token-store.ts    estado da sessão, sem HTTP (quebra o ciclo com api.ts)
  lib/session.ts        login, cadastro, refresh, logout + useSession()
  lib/resources.ts      tipos e chamadas de contas, categorias e lançamentos
  lib/format.ts         Intl para moeda e data (pt-BR)
  components/charts.tsx roseta, colunas divergentes, área, barras, medidor
  lib/chart-color.ts    hex do usuário → cor validada no tema (E9)
  routes/               login, cadastro, carteira, painel, lançamentos,
                        recorrências, categorias
```

Alias `@/` aponta para `src/` (configurado em `vite.config.ts` e `tsconfig.app.json`).
