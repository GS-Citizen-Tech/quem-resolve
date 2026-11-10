# Aviso

Mensagem de estado dentro de um cartão: título curto + uma frase com o que fazer.

- O consumidor fornece o tipo (`ok`, `info`, `warn`, `danger`), o título e a frase.
- Cada tipo tem ícone fixo: `circle-check`, `info`, `triangle-alert`, `octagon-alert`. A cor nunca aparece sozinha.
- Título na cor do tipo; a frase em `ink` sobre o fundo `*-soft`.
- `danger` usa `role="alert"` e, se houver risco à vida, vem acompanhado do botão de emergência.
