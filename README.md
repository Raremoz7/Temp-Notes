# Do It Later

**A gaveta do depois.** Um app para guardar as pequenas pendências da vida que
não são urgentes, mas continuam ocupando espaço na cabeça. Você joga a pendência
na gaveta sem decidir *quando* vai fazer. Depois, quando bater tempo, energia ou
disposição, abre a roleta e o app **sorteia uma missão** compatível.

> Não é agenda. Não é cobrança. É a gaveta do depois.

Este repositório é o **protótipo visual** (primeira etapa): dados fictícios
locais, sem login, sem backend, sem pagamentos. O objetivo é validar navegação,
composição visual, responsividade, animações e a experiência da roleta antes de
levar o produto para Flutter.

## O ciclo

**Guardar → Sortear → Aceitar → Fazer ou devolver para a gaveta.**

Sem punição: aceitar, devolver ou tentar outra missão são todos caminhos válidos.
Uma tarefa devolvida volta a ficar disponível para sorteios futuros.

## Telas

Navegação inferior com quatro áreas, mais o onboarding e os overlays:

- **Gaveta (Inbox)** — tudo o que está guardado. Criar, editar, excluir, filtrar
  por categoria e ver há quanto tempo cada coisa espera.
- **Roleta** — o diferencial. Escolha tempo, energia, lugar e categoria; toque em
  *Tirar uma missão* e o app sorteia entre as tarefas compatíveis, com o ritual
  do título girando até parar numa.
- **Missão** — a tarefa sorteada em destaque: aceitar, sortear de novo, devolver
  ou marcar como já feita. Ao aceitar, entra em *andamento*; ao concluir, sai da
  cabeça e vai para o histórico.
- **Feitas** — histórico das concluídas, com data e opção de restaurar, além de
  estatísticas leves.
- **Perfil** — tema (claro/escuro/auto), configurações da roleta, Modo Sem Culpa,
  o plano Pro e o reset da demonstração.

Inclui o **modal de limite** da versão gratuita (30 tarefas ativas) e a
**apresentação do Pro**.

## Direção visual

Artística, editorial, retrofuturista — nada com cara de gerenciador corporativo
genérico.

- **Paleta autoral** — base em azuis (nunca branco puro dominante no claro),
  vermelho e amarelo vivos como acento, azul elétrico e creme no escuro. O
  contraste vem de cores complementares e variações de tom.
- **Tipografia expressiva** — manchete de pôster (display pesado), rótulos em
  mono retrofuturista e frases em serifada itálica, a voz mais humana.
- **Textura de impressão** — pontilhado (halftone) e grão de filme discretos
  tiram o aspecto "chapado digital".
- **Componentes com personalidade** — cartões com faixa de categoria, botões
  grandes, formas orgânicas no onboarding, estados de toque bem perceptíveis.
- **Claro e escuro** com a mesma identidade, e respeito a `prefers-reduced-motion`
  e `prefers-color-scheme`.

## Como rodar

O app usa módulos ES, então precisa ser **servido por HTTP** (não abra o arquivo
por `file://`):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Também roda direto pelo GitHub Pages.

## Estrutura

O código é separado por responsabilidade — o sistema de cores, tipografia e
espaçamento fica centralizado para permitir mudar temas e futuras skins sem
tocar em cada tela.

```
index.html                # marcação das telas e overlays

assets/css/
  tokens.css              # SISTEMA DE TEMAS: cores light/dark, tipografia, espaço, raios
  base.css                # reset + atmosfera (grão, halftone, fundo, foco)
  components.css          # botões, chips, cartões, navegação, sheets, campos, toggles
  screens.css             # layout de cada tela, onboarding, missão

assets/js/
  models.js               # MODELOS: tarefa, categorias, tempos, energias, filtros, formatação
  store.js                # ESTADO + PERSISTÊNCIA local (localStorage) e assinatura
  seed.js                 # dados fictícios da gaveta de estreia
  roulette.js             # lógica do sorteio + animação do giro
  app.js                  # orquestração: router de telas, render, formulários, overlays
```

## Próximos passos (etapa funcional / Flutter)

O protótipo já foi pensado para virar produto: persistência isolada em `store.js`
(troca por backend sem tocar nas telas), estados de tarefa modelados
(`ativa · em andamento · concluída`), limite gratuito, temas centralizados e
estrutura preparada para tags, filtros completos, widgets, backup/sincronização e
notificações — tudo do plano Pro e das etapas seguintes descritas no briefing.

---

Protótipo visual · v0.1 — sem login, sem backend, sem cobrança.
