# TelaConsole

Tela de amostra (desktop, 1280px) do console da gestão: topo de vidro, trilho, três indicadores, gráfico de barras com dois filtros e dock.

- Indicadores em `kpi` (36–40px, peso 500, números tabulares) com rótulo em 14px e nota em `caption` (12px, piso do console).
- O gráfico da prévia é SVG; no produto ele é Plotly com `marker.color` = `chart-bar`, grade `chart-grid`, fonte `--font-sans`, sem fundo (`paper_bgcolor` e `plot_bgcolor` transparentes) para o vidro aparecer.
- O gráfico tem `aria-label` com todos os valores; no produto, ofereça também a tabela.
