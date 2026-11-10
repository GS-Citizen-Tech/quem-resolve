# Botao

Ações do app: primário (`qr-btn--primary`), secundário (`qr-btn--secondary`) e emergência (`qr-btn--emergency`); `qr-btn--console` reduz para 36px só no console.

- O consumidor fornece o rótulo (verbo primeiro, frase curta), um ícone Lucide opcional à esquerda e o destino (`<button>` para ação, `<a href="tel:193">` para ligação).
- Um primário por tela. O secundário é a saída honesta ("Não é isso").
- Altura mínima `touch-target` (48px) no cidadão; rótulo 17px peso 600.
- **Emergência não é vidro:** `emergency` sólido, `emergency-height` (64px), 20px peso 700, sempre com ícone de telefone e o número escrito. Só aparece quando há risco (fio caído, alagamento, incêndio).
- Primário: `on-brand` sobre `brand` (9.7:1 no claro). Secundário: borda `line-strong` (3:1 sobre o vidro).
- Não use botão desabilitado: mantenha ativo e explique o que falta.
