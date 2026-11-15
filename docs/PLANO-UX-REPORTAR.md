# Plano UX · Nova tela inicial e novo Reportar (separado da F4)

> Versão 0.2 · 15/11/2026 · decisões aprovadas pelo Ian (bola de falar, sem campo de referência, endereço pela API). Trabalho separado da F4.

## 1. O que incomoda hoje

| Onde | Problema |
|---|---|
| Tela inicial | Só um título, um texto e três botões. Quem abre o app não entende de cara o que fazer. |
| Reportar | Parece formulário: descrição → foto → "Onde fica?" → campo de rua → botão, tudo empilhado. |
| Local | Depois de ajustar no mapa aparece só "Local marcado no mapa", sem o endereço. Por isso existe o campo "Rua ou ponto de referência", que deixa de fazer sentido. |
| Bug | No celular, o dock de navegação cobre o botão "Descobrir quem resolve" quando o mapa está aberto (print `f3/8-cl-cidadao-ajustar-no-mapa.png`). |

## 2. Tela inicial nova

```
┌───────────────────────────────┐
│  📍 Você está em Rua Augusta, 900 · Consolação   (some se não houver permissão)
│                               │
│     Viu um problema na rua?   │
│                               │
│          ╭─────────╮          │
│          │   🎤    │  ← bola grande (≈160 px), pulsa de leve
│          ╰─────────╯          │
│      Toque e conte o que viu  │
│                               │
│  [ 📷 Tirar foto ] [ ✏️ Escrever ] │
│                               │
│  Exemplos: buraco · lixo · poste apagado · fio solto   (chips que preenchem o texto)
└───────────────────────────────┘
```

- **A bola é o centro.** Tocou, já está ouvindo e já está dentro do Reportar. Tocar de novo para.
- Foto e Escrever são as outras duas portas do mesmo fluxo, com o mesmo peso visual entre si.
- Navegador sem ditado (ex.: Firefox): a bola vira **"Reportar um problema"** com ícone de câmera e abre o Reportar normal. Nunca fica desabilitada.
- Acessibilidade: a bola é um `<button>` com rótulo "Reportar falando", foco visível, alvo de 48 px+ de sobra, a animação respeita `prefers-reduced-motion`.
- "Tenho uma dúvida" continua no dock (Tirar dúvida); sai da tela inicial para não competir com o Reportar.

## 3. Reportar novo: uma tela de "cartões", sem cara de formulário

O cidadão entra já com algo em mãos (fala, foto ou texto). A tela mostra **o que já temos** em três cartões e só pede o que falta.

```
┌───────────────────────────────┐
│ Novo reporte                  │
│ ┌ 🎤 O que você viu ─────────┐ │
│ │ "Tem um buraco grande no   │ │
│ │  asfalto perto do ponto"   │ │  toque para editar · 🎤 falar mais
│ └────────────────────────────┘ │
│ ┌ 📷 Foto ───────────────────┐ │
│ │ [miniatura]  Trocar · Tirar│ │  vazio: "Adicionar foto (ajuda a identificar)"
│ └────────────────────────────┘ │
│ ┌ 📍 Local ──────────────────┐ │
│ │ Rua Augusta, 900           │ │
│ │ Consolação, São Paulo      │ │
│ │ [mapinha estático]  Não é aqui? Ajustar │
│ └────────────────────────────┘ │
│ [   Descobrir quem resolve  →  ] │  fica acima do dock, sempre visível
└───────────────────────────────┘
```

- **Local automático:** ao entrar, o app pede a localização uma vez e já mostra o endereço por extenso. Sem campo de rua.
- **"Não é aqui? Ajustar"** abre o mapa em tela cheia (folha que sobe de baixo):
  - o pino fica **fixo no centro** e a pessoa arrasta o mapa (mais fácil no celular do que arrastar o pino);
  - embaixo, o endereço atualiza ao parar de mexer: **"Você está marcando: Rua Augusta, 912"**;
  - campo **"Procurar endereço"** em cima, para quem negou a localização ou está reportando de longe;
  - botão **"Usar este local"** fecha a folha e o cartão mostra o novo endereço.
- Sem permissão de localização: o cartão diz "Não consegui sua localização" e já abre a busca de endereço. Sem o local, o botão final continua ativo e explica: "Falta dizer onde fica".
- O campo "Rua ou ponto de referência" **sai**. O endereço do mapa vai junto com o reporte no lugar dele (o gestor vê o endereço na fila).
- Validação continua a mesma (descrição com 5+ letras, local obrigatório), com a mensagem no cartão que falta.
- O resto do fluxo (analisando → resultado com "Não é isso" → confirmação → protocolo) não muda, só ganha o endereço no resumo e no protocolo.

## 4. Endereço por extenso: de onde vem

- **OpenStreetMap / Nominatim** (o mesmo mapa que já usamos, grátis, sem chave).
- A chamada passa **pela API**, não pelo navegador: a API manda o User-Agent do projeto, guarda em cache (coordenadas arredondadas a ~10 m) e respeita o limite de 1 pedido por segundo. Assim a localização do cidadão não vai direto do aparelho para um terceiro.
- Contrato **v1.1**, dois endpoints novos:
  - `GET /geo/endereco?lat=&lon=` → `{ rua, numero, bairro, cidade, texto_curto, fonte }`
  - `GET /geo/buscar?q=` → até 5 resultados `{ texto_curto, lat, lon }`, limitados à cidade de São Paulo
- Falha do Nominatim (fora do ar, lento): o cartão mostra "Local marcado (−23,5505, −46,6333)" e o reporte segue. Nunca trava.
- Bônus de nota: conta como "múltiplas fontes de dados (APIs públicas)" nos diferenciais do Front.

## 5. O que muda no código

| Camada | Arquivo | Mudança |
|---|---|---|
| web/features | `inicio/Inicio.tsx` | Tela nova (bola, Foto, Escrever, chips de exemplo, chip "Você está em") |
| web/features | `reportar/Captura.tsx` | Vira a tela de cartões; sai o campo de referência |
| web/ui | `BolaFalar.tsx` (novo), `CartaoLocal.tsx` (novo), `FolhaMapa.tsx` (novo) | Componentes reutilizáveis (a bola também pode entrar no Tirar dúvida) |
| web/ui | `MapaOcorrencias.tsx` | Modo "pino fixo no centro" além do pino arrastável |
| web/state | `rascunho.ts` | `referencia` → `endereco` (texto curto); rascunhos antigos continuam abrindo |
| web/providers | `api.ts` | `api.endereco()` e `api.buscarEndereco()` com timeout |
| api/routers | `geo.py` (novo) | Os dois endpoints |
| api/providers | `geocodificacao.py` (novo) | Nominatim + cache + mock para testes (`GEO_PROVIDER=mock|nominatim`) |
| api/schemas | `geo.py` (novo) | `Endereco`, `ResultadoBusca` (Pydantic) |
| layout | `LayoutCidadao.tsx` | Espaço reservado para o dock (corrige o bug do botão coberto) |
| docs | `CONTRATOS.md` v1.1, prints novos em `docs/evidencias/f4/` | |

Testes: pytest dos endpoints com o provider mock; Playwright refaz os prints da tela inicial e do Reportar nos 3 temas e no celular.

## 6. Decisões para o Ian

1. **Tela inicial:** bola de falar no centro com Foto e Escrever embaixo (recomendado), ou um botão grande "Reportar um problema" no centro?
2. **Campo de referência:** tirar de vez (recomendado), ou deixar escondido em "Adicionar detalhe do local" para casos como "em frente ao portão 3"?
3. **Endereço via Nominatim pela API** (recomendado), aceitando a pequena mudança de contrato v1.1?

## 7. Tamanho

Cerca de meio dia de trabalho. Pode ser feito hoje (15/11) antes do LLM real, sem atrasar o resto da F4 (LLM real, deploy, README, teste com 3 pessoas, vídeo em 18/11).

## 8. Resultado (15/11, feito)

Feito como planejado, com as 3 decisões do Ian (bola de falar, sem campo de referência, endereço pela API).

- **API (contrato v1.1):** `GET /geo/endereco` e `GET /geo/buscar` em `api/app/routers/geo.py`, `schemas/geo.py` e `providers/geocodificacao.py` (Nominatim com User-Agent, 1 pedido/s, cache ~10 m; `GEO_PROVIDER=mock|nominatim`, padrão `nominatim`). 7 testes novos em `tests/test_geo.py` (Nominatim simulado, falha vira 503, sem endereço vira 404). Suíte: 80 passam, 7 pulados (Postgres).
- **Tela inicial:** `features/inicio/Inicio.tsx` com a bola (`ui/BolaFalar.tsx`), Tirar foto (a foto vai direto para o Reportar), Escrever, 6 exemplos e o chip "Você está em …" (só aparece sozinho se a permissão já foi dada; senão, "Mostrar onde estou").
- **Reportar:** `features/reportar/Captura.tsx` em 3 cartões. O local vem sozinho ao abrir, com o endereço por extenso. "Não é aqui? Ajustar no mapa" abre `ui/FolhaMapa.tsx` (tela cheia, pino fixo no centro, busca, "Minha localização", endereço ao vivo). Campo de referência removido; o endereço vai no fim da descrição e aparece na confirmação.
- **Componentes reutilizados com parâmetros diferentes:** `BolaFalar` (grande na tela inicial, média no cartão), `MapaOcorrencias` (pontos no console, pino arrastável, pino fixo), `CampoTexto` (novo `rotuloOculto`), `FotoEntrada` (novo `comTitulo`).
- **Dock:** o botão "Descobrir quem resolve" fica acima do dock no fim da tela (o print antigo era da captura de página inteira, que desenha o dock fixo no meio).
- **Prints:** `docs/evidencias/ux/` (3 temas, celular 390 px, e desktop). Script: `ux.playwright.js`.
- **No PC:** ponha `GEO_PROVIDER=nominatim` no `api/.env` (ou deixe sem a linha, o padrão já é `nominatim`).
