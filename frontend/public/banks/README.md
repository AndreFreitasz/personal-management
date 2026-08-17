# Logotipos das instituições

Um arquivo por marca: `<slug>.svg`, onde `<slug>` é exatamente o que fica
gravado em `accounts.icon` no banco.

`<AccountIcon>` pede `/banks/<slug>.svg` para **qualquer** slug. Acrescentar um
banco é largar o arquivo aqui — não há código, tipo nem build para mexer. Se o
arquivo não existir, o componente cai no ladrilho da cor da marca com o
monograma (`src/lib/banks.ts`), e se o slug nem estiver no catálogo, nas
iniciais da conta.

Para o banco novo também aparecer **no seletor**, acrescente uma linha em
[`src/lib/banks.ts`](../../src/lib/banks.ts) — é ela que dá nome, grupo e a cor
de reserva.

## O formato

- `viewBox="0 0 64 64"`, quadrado, com o fundo da própria marca (o ladrilho
  arredondado é parte do desenho, como no ícone de aplicativo do banco).
- Cores embutidas no arquivo. Nada de `currentColor`: a marca do banco não
  acompanha o tema do app.
- Sem `<script>`, sem referência externa, sem fonte web — o arquivo é servido
  como imagem e nada dentro dele é executado ou baixado.
- Renderiza a 20px. Detalhe que só se lê a 64px é detalhe que não existe.

## Procedência de cada arquivo

**Vetor oficial da marca**, extraído do pacote [simple-icons](https://simpleicons.org)
(código SVG em CC0; a marca continua sendo do titular):

`nubank` · `picpay` · `mercado-pago` · `pagbank` · `wise`

**Reprodução** — desenhada aqui a partir da forma e da cor institucional, não é
o arquivo oficial do banco:

`itau` · `inter` · `xp` · `c6` · `btg` · `banco-do-brasil` · `santander` ·
`bradesco` · `caixa`

Para trocar qualquer uma pela oficial, baixe o SVG na página de imprensa/marca
da instituição e **sobrescreva o arquivo com o mesmo nome**. Nada mais precisa
mudar.

## Uso de marca de terceiro

Os logotipos identificam a conta que o próprio usuário cadastrou — uso
nominativo, o mesmo que qualquer agregador financeiro faz. Nenhuma instituição
patrocina ou endossa este projeto.
