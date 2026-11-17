# Plano · Visão geral do console vira "painel de ação"

> Versão 1.0 · 17/11/2026 · Ian · **Aprovado e feito** (ver seção 7)

## 1. O problema de hoje

A Visão geral responde "quantos e de que tipo", mas não responde a pergunta que a Marina tem ao abrir o console:
**"o que eu resolvo agora, onde fica, e como eu resolvo daqui mesmo?"**

| O que tem hoje | Por que atrapalha |
|---|---|
| "Prioridade alta em aberto: 3" | Mostra o número, mas não mostra **quais** são. Para achar, é preciso ir em Filas e procurar. |
| Gráfico por categoria | Útil para relatório, mas não leva a nenhuma ação. |
| "Quem viu o problema" | É curiosidade (cidadão × ônibus) e não ajuda a decidir nada. |
| "Bairros com mais problemas" | Repete o que o Mapa já mostra melhor. |
| "De outros órgãos" e "Corrigidas pelo cidadão" | São números sobre a **qualidade da IA**, não sobre o trabalho do dia. |

## 2. A ideia: bater o olho → clicar → resolver

A tela passa a ter três blocos, nesta ordem de leitura:

1. **4 números que são botões.** Cada número filtra a lista logo abaixo.
2. **"O que fazer agora"**: a lista curta do que pede ação, com um **mapa pequeno ao lado**. Clicar numa linha abre o detalhe numa **gaveta lateral**, sem sair da tela.
3. **Tendência**: um gráfico só, para entender se está melhorando ou piorando.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Visão geral                         [Meu órgão ▾] [Categoria ▾]  [Atualizar] │
├──────────────┬──────────────┬──────────────────┬─────────────────────────────┤
│ ⚠ 6          │ 14           │ 9                │ ✓ 3                         │
│ Prioridade   │ Novos em 24h │ Parados há mais  │ Possivelmente resolvidas    │
│ alta aberta  │              │ de 7 dias        │ (confirmar no local)        │
├──────────────┴──────────────┴──────┬───────────┴─────────────────────────────┤
│ O que fazer agora (6)  Ver todas → │                                         │
│ ⚠ Alta  Fio caído        Sé        │         mapa pequeno                    │
│   8 reportes · há 2 dias · Enel    │   só com os pontos da lista             │
│   [Encaminhar]                     │   (passar o mouse na linha acende       │
│ ⚠ Alta  Buraco       Itaquera      │    o ponto; clicar no ponto abre        │
│   8 reportes · há 5 dias · Subpref │    a mesma gaveta)                      │
│   [Encaminhar]                     │                                         │
│ ...até 8 linhas                    │                                         │
├────────────────────────────────────┴─────────────────────────────────────────┤
│ Novos reportes por dia (30 dias), em camadas por prioridade │ Top categorias │
└──────────────────────────────────────────────────────────────────────────────┘
                                           ┌──────── gaveta (ao clicar) ───────┐
                                           │ Buraco na via · QR-261117-A94B1   │
                                           │ foto, 3 reportes, prioridade e    │
                                           │ por quê, quem resolve             │
                                           │ [Encaminhar] [Marcar resolvida]   │
                                           │ Mudar categoria · Histórico       │
                                           └───────────────────────────────────┘
```

### 2.1 Os 4 números (clicáveis)

| Número | Regra | Ao clicar |
|---|---|---|
| **Prioridade alta aberta** | grupos não resolvidos com prioridade 4 ou 5 | a lista mostra só esses |
| **Novos em 24h** | criados nas últimas 24 horas | a lista mostra os novos |
| **Parados há mais de 7 dias** | ainda "Aguardando envio" e criados há mais de 7 dias | a lista mostra os atrasados |
| **Possivelmente resolvidas** | o ônibus passou de novo e não viu | a lista mostra para confirmar |

O número escolhido fica marcado e é **ícone + palavra**, nunca só cor (regra do design system).

### 2.2 "O que fazer agora"

- Ordem: prioridade (maior primeiro), depois número de reportes, depois o mais antigo.
- Cada linha mostra: selo de prioridade, problema, bairro, nº de reportes, há quantos dias e quem resolve.
- **Botão de ação direto na linha.** "Encaminhar" muda para "Enviada". O botão aparece só no que é do meu órgão; no que é de outro órgão aparece "Ver" e um aviso de "de outro órgão".
- Até 8 linhas, com "Ver todas na fila →" (leva para Filas com o mesmo filtro).
- A gaveta lateral reaproveita o `DetalheOcorrencia` que já existe em Filas (foto, status, reclassificar, histórico, desfazer). Assim não é código novo e o comportamento é o mesmo nas duas telas.
- **"Por que é alta?"** aparece na gaveta, em uma frase, usando a regra que já existe: "risco à segurança + 8 pessoas reportaram". Isso responde a dúvida de como a prioridade é calculada.

### 2.3 Mapa pequeno ao lado

- Mostra só os pontos da lista (não a cidade inteira).
- Passar o mouse numa linha acende o ponto, e clicar no ponto abre a mesma gaveta.
- Usa o `MapaOcorrencias` que já existe; o zoom no ponto escolhido já foi feito hoje.

### 2.4 Tendência (um gráfico)

- "Novos reportes por dia, últimos 30 dias", em barras empilhadas por prioridade (alta, média, baixa).
- Ao lado, as 5 categorias que mais aparecem, como lista com barrinha. Clicar filtra a tela toda, como hoje.

### 2.5 O que sai da Visão geral

- "Quem viu o problema" → vai para a Frota (lá faz sentido).
- "Bairros com mais problemas" → sai (o Mapa já faz isso).
- "De outros órgãos" e "Corrigidas pelo cidadão" → vão para **Qualidade da IA**.

## 3. O que não muda

- **Contrato da API: nenhuma mudança.** Tudo sai de `GET /ocorrencias` e `GET /metricas`, que a tela já chama.
- Filas e Mapa continuam iguais; a Visão geral só passa a ser o atalho para o trabalho do dia.
- Regras do design system: console sólido, piso de 12 px, controles de 36 px, cor sempre com ícone + palavra, nada de botão desabilitado.

**Limitação a dizer no vídeo:** "parado há mais de 7 dias" usa a data de criação, porque a lista não traz a data da última mudança. Para ficar exato, seria preciso um campo `atualizada_em` (contrato v1.6). Fica como melhoria futura.

## 4. Celular

Os 4 números ficam em 2 × 2, a lista vira cartões, o mapa pequeno some e a gaveta abre em tela cheia.

## 5. Decisões para o Ian

| # | Pergunta | Recomendação |
|---|---|---|
| D1 | A lista começa filtrada pelo **meu órgão** ou com **todos**? | **Meu órgão.** É o que a pessoa pode alterar, e "Todos" fica a um clique. |
| D2 | Detalhe numa **gaveta lateral** ou indo para Filas? | **Gaveta.** É a mesma peça de Filas, e quem usa não sai da tela. |
| D3 | Levar os 2 números da IA para a Qualidade? | **Sim.** A Visão geral fica só com o trabalho do dia. |
| D4 | Fazer agora ou depois da F4 (deploy, README, teste com 3 pessoas)? | Fazer **agora**, se o vídeo for amanhã (18/11): esta é a tela que abre o console no vídeo. Leva umas 3 horas, com prints nos 3 temas. |

## 6. Passos depois do ok

1. Calcular os 4 números e a lista ordenada a partir de `/ocorrencias` (`features/gestao/VisaoGeral.tsx`).
2. Criar a gaveta lateral (`ui/Gaveta`, com foco preso, Esc e voltar o foco) usando o `DetalheOcorrencia`.
3. Mapa pequeno ligado à lista (passar o mouse acende, clicar abre).
4. Gráfico por dia empilhado por prioridade (Plotly, que já está no projeto).
5. Mover "Quem viu" para a Frota e os 2 números da IA para a Qualidade.
6. Prints nos 3 temas e no celular em `docs/evidencias/visao-geral/`. Atualizar o CLAUDE.md.

## 7. Resultado (17/11)

Ian aprovou as 4 recomendações ("pode fazer"). Feito:

- `features/gestao/VisaoGeral.tsx` reescrita: 4 atalhos (botões com `aria-pressed`) que filtram "O que fazer agora"; lista com até 8 problemas, ação na linha ("Encaminhar" → Enviada; "Confirmar resolvida" nas possivelmente resolvidas), "Desfazer" na hora e aviso se a API recusar; mapa pequeno só com esses pontos (passar o mouse acende, clicar abre a gaveta); gráfico "Reportes novos por dia" empilhado por prioridade; "Mais comuns em aberto" que filtra a tela. Abre no órgão de quem entrou.
- `ui/Gaveta.tsx` (novo): `<dialog>` lateral, Esc fecha, foco preso e devolvido; no celular, tela cheia.
- `DetalheOcorrencia` (Filas) ganhou `empilhado` e a linha **"Por que esta prioridade"** (`porquePrioridade`, mesma regra da API). Aparece nas Filas também.
- `ui/GraficoPlotly.tsx`: `GraficoDias` (colunas empilhadas, legenda escrita e tabela).
- `ui/MapaOcorrencias.tsx`: `seguir={false}` (o ponto cresce sem o mapa voar).
- "Quem viu o problema" foi para a Frota; "Foram para outros órgãos" e a taxa de correção do cidadão foram para a Qualidade.
- API: `PATCH /ocorrencias/{id}/status` agora devolve o `distrito` (antes o bairro sumia da linha depois de salvar). Formato igual ao contrato.

Prints: `docs/evidencias/visao-geral/` (claro, escuro, alto contraste, gaveta, encaminhar/desfazer, celular).
