# SeloConfianca

Diz o quanto a IA tem certeza da classificação, sempre com cor, ícone e palavra (nunca só cor).

- O consumidor fornece o nível (`alta` ≥ 80%, `media` 50–79%, `baixa` < 50%) e a porcentagem.
- Alta: `ok` sobre `ok-soft` + ícone `circle-check`. Média: `warn` sobre `warn-soft` + `triangle-alert`. Baixa: `danger` sobre `danger-soft` + `circle-help` (pergunta, não erro).
- No cidadão o texto é completo ("Confiança alta (92%)") em 16px; no console, `qr-badge--console` com a palavra só (13px).
- Com confiança baixa, mostre junto o botão "Não é isso" em destaque e peça mais detalhes.
