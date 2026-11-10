# Navegacao

Barra do topo (`qr-topbar`), trilho vertical de ícones (`qr-rail`, só desktop) e dock em pílula (`qr-dock`; `qr-dock--mobile` no celular).

- O consumidor fornece os itens (ícone Lucide + rótulo), qual é o atual (`aria-current="page"`) e, no topo, o nome e o órgão da pessoa logada.
- Desktop do console: trilho à esquerda e dock flutuando na base do painel principal. Celular: o dock vira a navegação principal, fixo embaixo, com rótulo sempre visível (13px sob o ícone, alvo de 56px).
- O trilho só tem ícone: cada botão leva `aria-label` e mostra dica ao focar.
- Item ativo: `rail-active` + `on-rail-active` + `shadow-float`; não use só cor para marcar o ativo (a forma da pílula muda).
- Seções do console: Visão geral, Mapa, Filas, Frota, Qualidade da IA. App do cidadão: Reportar, Meus pedidos, Perto de mim, Conta.
