# Plano · Mapa do console (funcionário da prefeitura)

> Versão 1.0 · 15/11/2026 · aprovado pelo Ian (96 distritos, bola = nº de reportes, simuladas com pontos quentes) e **construído** (contrato v1.3). Trabalho separado da F4. Resultado na seção 7.

## 1. O que incomoda hoje (print `docs/evidencias/f3/3-cl-mapa.png`)

| Problema | Por quê |
|---|---|
| "Só um mapa com pontos e legenda" | Mapa pequeno (420 px), filtros em cima como formulário, resumo vazio do lado, legenda longa embaixo e uma lista enorme de coordenadas. |
| Todos os pontos iguais | Tamanho fixo. Um buraco com 8 reportes parece igual a um com 1. |
| Não dá para olhar uma região | Não existe bairro. O gestor vê a cidade inteira misturada. |
| Dados de exemplo não mostram nada | As 120 ocorrências simuladas são espalhadas ao acaso: quase nenhuma se repete no mesmo lugar, então o "mesmo buraco reportado por várias pessoas" quase não aparece. |

## 2. Como fica

### 2.1 Visão da cidade: os bairros pintados

Ao abrir, o mapa mostra **São Paulo dividida nos 96 distritos oficiais** (é o que a Prefeitura usa como "bairro" com fronteira; ex.: Pinheiros, Itaquera, Sé, Capão Redondo).

- Cada distrito é pintado pela **quantidade de problemas abertos** (5 tons do verde do design system, do claro ao escuro).
- Passar o mouse ou focar com o teclado mostra o nome e o número: "Itaquera · 14 abertos · 3 de prioridade alta".
- Cor nunca sozinha: a legenda diz as faixas em números ("0", "1–3", "4–8", "9–15", "16+"), e o painel lateral lista os 5 distritos com mais problemas.

### 2.2 Focar num bairro

- **Clicar num distrito** (ou escolher na busca "Ir para o bairro…") faz o mapa voar até ele, apagar o resto da cidade e mostrar **só os relatos daquele distrito**.
- No topo aparece o caminho: **São Paulo › Itaquera** (clicar em "São Paulo" volta para a cidade).
- O painel lateral vira o **resumo do bairro**: total aberto, quantos de prioridade alta, os 3 tipos de problema mais comuns (barrinhas Plotly com hover), o problema aberto mais antigo e o botão **"Abrir a fila deste bairro"**.
- O bairro escolhido fica na URL (`?distrito=itaquera`): dá para mandar o link ou voltar com o botão do navegador.

### 2.3 Bolas que crescem com os reportes

- **Tamanho da bola = quantas pessoas (e ônibus) reportaram aquele mesmo problema** naquele lugar (o agrupamento de duplicatas que a API já faz, 30 m e mesma categoria). 1 reporte = bola pequena; 8 reportes = bola grande, com o número escrito dentro ("8").
- **Cor = prioridade** (como hoje: alta, média, baixa, resolvida), e a **forma continua dizendo quem achou** (círculo cidadão, quadrado ônibus, losango os dois).
- Prioridade já sobe com o número de reportes (regra atual da API), então bola grande quase sempre é vermelha: o olho vai direto para o que importa. A área da bola cresce com a raiz do número de reportes, para 20 reportes não cobrir o bairro inteiro.
- Bolas grandes ficam por cima das pequenas.

### 2.4 Tela inteira para o mapa

```
┌──────────────────────────────────────────────────────────────┐
│ São Paulo › Itaquera        [Ir para o bairro…]   [Atualizar] │
│ [Buraco ✕] [Prioridade alta ✕] [+ Filtro]   Mostrar: (Bolas|Bairros) │
├─────────────────────────────────────────────┬────────────────┤
│                                             │ Itaquera        │
│        mapa grande (altura da tela)         │ 14 abertos      │
│      bolas por tamanho e cor                │ 3 alta          │
│                                             │ ▇▇▇ Buraco 6    │
│                                             │ ▇▇ Lixo 4       │
│                                             │ [Abrir a fila]  │
│  legenda recolhível (canto)                 │ — ou o ponto    │
│                                             │   clicado —     │
└─────────────────────────────────────────────┴────────────────┘
  Lista acessível (recolhida por padrão: "Ver em lista · 14 pontos")
```

- Mapa ocupa a altura da tela. Filtros viram **chips** em cima (os mesmos de hoje: categoria, órgão, origem, status) mais **"Período"** (7 dias, 30 dias, tudo).
- Painel lateral com 3 estados: resumo da cidade (top 5 bairros), resumo do bairro, ou o **ponto clicado** (como hoje: categoria, nº de reportes, foto borrada se houver, status, "Abrir na fila").
- **Legenda** vira um botão "Legenda" no canto do mapa, que abre e fecha.
- **Lista** continua (exigência de acessibilidade e funciona sem mapa), mas recolhida, com endereço em vez de coordenada quando tiver, e ordenada por número de reportes.
- No celular: mapa em cima, painel vira uma gaveta que sobe de baixo.
- Gestor da Sabesp ou da Subprefeitura: um atalho "Só o meu órgão" já ligado.

### 2.5 Dados de exemplo que mostram tudo isso

Trocar a simulação por uma com **pontos quentes**: ~15 lugares em distritos diferentes com 2 a 9 reportes do mesmo problema (o buraco da Av. Itaquera com 8 reportes, o lixo em Capão Redondo com 5…), mais reportes soltos. Assim o vídeo mostra bolas de tamanhos diferentes e bairros com tons diferentes.

## 3. De onde vêm os bairros

- **Malha oficial do IBGE** dos distritos do município de São Paulo (código 3550308), em GeoJSON, pela API pública `servicodados.ibge.gov.br` (dado aberto). É o diferencial "múltiplas fontes de dados abertos" do enunciado de Front.
- Baixado **uma vez** por um script (`api/scripts/baixar_distritos.py`), simplificado para ~150 KB e salvo em `api/app/data/distritos_sp.geojson`. Assim o app não depende do IBGE no ar durante o vídeo.
- Meu ambiente aqui não tem internet: o script precisa rodar no seu PC (um comando; ou eu rodo por você com o controle remoto, se você liberar).

## 4. O que muda no código

| Camada | Mudança |
|---|---|
| api/providers | `distritos.py`: carrega o GeoJSON e diz em qual distrito cai cada ponto (ponto-no-polígono, sem biblioteca nova) |
| api/routers + schemas | `GET /geo/distritos` (fronteiras simplificadas + nome) e campo `distrito` em cada ocorrência devolvida; filtro `?distrito=` em `GET /ocorrencias` e `GET /ocorrencias/metricas` · contrato **v1.3** |
| api/pipelines | `metricas`: contagem por distrito (abertos e prioridade alta); `simulacao`: pontos quentes |
| banco | Nada a migrar: o distrito é calculado na hora pela coordenada |
| web/ui | `MapaOcorrencias` ganha camada de distritos (coroplético) e bolas com tamanho e número; `LegendaMapa` recolhível |
| web/features/gestao | `Mapa.tsx` refeito (layout de tela cheia, painel com 3 estados, chips, caminho "São Paulo › bairro"); `Filas` e `Visão geral` aceitam `?distrito=` (o mesmo filtro passa entre telas) |
| testes | pytest: ponto-no-polígono, filtro por distrito, métricas por distrito · Playwright: prints novos em `docs/evidencias/mapa/` nos 3 temas e no celular |

## 5. Decisões para o Ian

1. **"Bairro" = os 96 distritos oficiais** (recomendado) ou as 32 subprefeituras (áreas maiores, que são quem resolve buraco e lixo)? Dá para ter os dois depois.
2. **Tamanho da bola = nº de reportes** com a cor mostrando a prioridade (recomendado), ou tamanho = prioridade?
3. **Trocar os dados simulados** do Supabase pelos com pontos quentes? Apaga só as ocorrências marcadas como simuladas (as reais e as de teste ficam). Recomendado, senão as bolas ficam todas iguais no vídeo.

## 6. Tamanho

Cerca de um dia de trabalho (o maior pedaço é o mapa novo). Fazendo hoje à noite e amanhã (16/11), ainda sobra 17/11 para deploy, README e teste com 3 pessoas, e 18/11 para o vídeo.

## 7. Resultado (15/11)

Feito como planejado, com estes detalhes:

- **API:** `providers/distritos.py` (ponto-no-polígono em Python puro, com cache), `GET /geo/distritos` e `GET /geo/distritos.geojson` (503 se a malha não estiver instalada), campo `distrito` e filtro `?distrito=` na lista e nas métricas. 94 testes passando (`tests/test_distritos.py` usa uma malha pequena de teste).
- **Prioridade:** a regra antiga só subia um degrau com 3 reportes, então um buraco com 8 reportes ficava "média" (amarelo). Agora sobe mais um com 6 reportes: bola grande fica vermelha.
- **Simulação:** 15 pontos quentes (2 a 8 reportes) + reportes soltos. O buraco de Itaquera saiu de cima da linha 3789-10 da frota, senão o ônibus o marcava como "possivelmente resolvido".
- **Tela:** caminho "São Paulo › bairro", "Ir para o bairro…", período 7/30/tudo, chips dos filtros ativos, filtros completos num botão "Filtros", painel com resumo da cidade (top 5 bairros), do bairro (números, barras Plotly, mais reportado, mais antigo, "Abrir a fila deste bairro") ou do ponto. Legenda e lista recolhidas. `Filas` e `Visão geral` aceitam o mesmo `?distrito=`.
- **Prints** (`docs/evidencias/mapa/`, script `mapa.playwright.js`): feitos com uma malha **de prévia** (20 áreas geradas em volta dos bairros da simulação), porque meu ambiente não alcança o IBGE. Refazer com a malha real depois que o script rodar no PC.

**Sem script (pedido do Ian):** a API baixa os bairros do IBGE sozinha na primeira subida (em segundo plano, guarda o arquivo e não baixa mais) e troca sozinha os dados simulados antigos pelos com pontos quentes (versão anotada na tabela `meta_app`, migração 009; reais ficam). O mapa mostra "Carregando os bairros…" e tenta de novo a cada 30 s enquanto o IBGE não responde.

**Atualização (15/11, tarde):** o IBGE não respondeu no PC do Ian (handshake expirou). Os 96 distritos agora vêm **prontos no repositório**, dos limites oficiais da Prefeitura (GeoSampa, camada Distrito, convertidos por github.com/codigourbano/distritos-sp e simplificados ~25 m, 140 KB). O download do IBGE ficou só como reserva se o arquivo sumir. Ponto quente da Sé ajustado para cair no distrito Sé (simulação v1.3.2).
