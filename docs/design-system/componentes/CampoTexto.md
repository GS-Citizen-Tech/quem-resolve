# CampoTexto

Campo com rótulo sempre visível, dica opcional e mensagem de erro com ícone.

- O consumidor fornece `label` (17px, 600), `hint` opcional (16px `ink-muted`), o valor e, em erro, uma frase que diz o que fazer.
- Campo sólido (`surface-raised`) mesmo dentro do vidro: o que a pessoa digita nunca fica sobre transparência.
- Borda `line-strong` 1.5px (3:1); em erro, `danger` 2px + `aria-invalid` + ícone `circle-alert` + texto. O placeholder é um exemplo real, nunca o rótulo.
- Altura `touch-target`. Ao lado, o botão de microfone (48px) para quem prefere falar.
