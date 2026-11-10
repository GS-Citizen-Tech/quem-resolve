# CartaoVidro

Bloco de conteúdo de vidro (`qr-glass-card`) dentro do painel principal de vidro (`qr-glass`), sobre a cena (`qr-scene has-photo`).

- O consumidor fornece um rótulo com ícone Lucide em `accent`, um título (`heading`) e o conteúdo.
- Camadas fixas: foto → `scrim` → `glass` (64% no claro) → `glass-card`. Essa pilha é o que garante 4.5:1 mesmo com a foto toda preta ou toda branca atrás; não reduza a opacidade.
- Raios: painel `radius-panel` (27px), cartão `radius-card` (17px). Filete de luz `glass-edge` em cima, `shadow-card` embaixo.
- Entrada: classe `qr-enter` com `--i` (0, 1, 2…) para cascata de 70ms; desligada com movimento reduzido.
- Com transparência reduzida ou sem `backdrop-filter`, o vidro vira `surface-solid` sozinho. No alto contraste vira preto com borda branca.
