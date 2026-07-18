# lapso

**Palavras com prazo de validade.** Um bloco de notas onde o que você escreve
se desfaz em cinza depois de um tempo — para te forçar a *fazer* o que anotou
antes que suma, ou simplesmente para botar um desabafo pra fora e deixar ir.

Sem contas, sem servidor, sem nuvem. Tudo acontece no seu navegador e some de
verdade. Abra o `index.html` e comece a escrever.

---

## A ideia

Uma nota que dura para sempre vira mais uma coisa acumulada. Uma nota com hora
para morrer tem outro peso: ou você age, ou você perde. `lapso` transforma o
tempo no material da interface — ele não é um detalhe no canto, é o protagonista.

Dois jeitos de usar:

- **Prazo** — você escolhe quanto tempo a nota vive (`15s`, `1min`, `10min`,
  `1h`). A contagem começa na primeira tecla. Um *pavio* queima na lateral e a
  brasa esquenta de cinza a vermelho conforme o fim se aproxima. No zero, as
  palavras viram fagulha e se desfazem.
- **Desabafo** — não tem relógio. Enquanto você escreve, a nota vive. Se você
  parar, ela começa a se esvair e, se você não voltar, some. Escrever de novo
  devolve fôlego. É pra quando o importante é só deixar sair.

## Decisões de design

O objetivo era um objeto com autoria — nada com "cara de template de IA".

- **Tipografia editorial** — o texto é servido numa serifada quente (old-style),
  porque uma nota *é* texto e merece respeito tipográfico. O cromo da interface
  é monoespaçado e discreto.
- **Carvão, não preto** — o fundo é um carvão morno com uma luz sutil no topo,
  não `#000`. A tinta é um branco-papel (`#ece5d6`), nunca branco puro.
- **Cor com significado** — existe uma única escala de cor, do cinza morno à
  brasa, controlada por uma variável de "calor" que reflete o tempo restante.
  A cor não decora: ela conta quanto falta.
- **O pavio** — o indicador de progresso é uma linha vertical que queima de cima
  para baixo, com uma brasa que brilha no ponto de queima. Substitui a barra de
  progresso genérica por algo que pertence ao tema.
- **A morte** — motor de partículas próprio (canvas, sem bibliotecas): o texto
  renderizado é amostrado pixel a pixel, cada ponto vira uma partícula. São
  **quatro animações à escolha** (no botão de configurações, com preview ao vivo
  de cada uma): `brasa` (fagulha e cinza ao vento), `vapor` (desfoca e evapora),
  `poeira` (as letras se esfarelam) e `glitch` (corrompe com aberração cromática
  e colapsa).
- **Grão de filme e vinheta** — uma camada de ruído e uma vinheta que esquenta
  perto do fim matam o aspecto "chapado digital".
- **Respeito ao usuário** — `prefers-reduced-motion` desliga tremores e a
  tempestade de partículas (troca por um fade sóbrio); nada de auto-play de som.

## Como rodar

Abra `index.html` no navegador — um duplo-clique basta, não precisa de build nem
de servidor. Se preferir servir localmente:

```bash
python3 -m http.server 8000
# depois abra http://localhost:8000
```

## Estrutura

```
index.html            # marcação e estados da tela
assets/css/style.css  # sistema visual (tokens, calor, pavio, atmosfera)
assets/js/dissolve.js # motor de partículas — o texto virando cinza
assets/js/app.js      # orquestração: modos, contagem, calor, morte
```

## Ajustes rápidos

- **Tempos disponíveis** — os botões em `index.html` (`data-secs`). Troque os
  valores ou adicione opções.
- **Ritmo do desabafo** — `GRACE` (fôlego antes de esvair) e `DRAIN` (tempo até
  sumir parado) no topo de `app.js`.
- **Curva do calor** — o expoente em `Math.pow(progress, 2.2)` em `app.js`:
  maior = fica calmo por mais tempo e só esquenta no fim.
- **Cores** — `--ash`, `--ember` e `--ink` no `:root` de `style.css`.

## Privacidade

Nada sai do seu dispositivo. Não há servidor, telemetria ou rede — quando a nota
some, ela some. A única coisa guardada no navegador é a sua preferência de
animação do fim (em `localStorage`); **o conteúdo das notas nunca é salvo**. É
esse o ponto.
