# Prompt para o Claude Design

> Copie tudo abaixo da linha e cole no Claude Design. Se quiser, anexe também o `EXEMPLOS-FLUXO.md`.

---

Quero criar a identidade visual e as telas-chave de um app chamado **Quem Resolve?**. É um projeto acadêmico (FIAP, Global Solution 2026, desafio CitizenTech) que compete com outros grupos, então o visual precisa ser marcante, mas sobretudo claro e acessível.

## O produto

Em São Paulo, quem vê um problema na rua (buraco, fio pendurado, lixo acumulado, bueiro entupido, poste apagado) não sabe a quem recorrer: Prefeitura, subprefeitura, Enel, Sabesp, CET ou operadora de telecom. O **Quem Resolve?** é um app em que o cidadão tira uma foto e/ou descreve o problema (por texto ou voz), e a IA diz **quem resolve, por qual canal e o que fazer**, gerando a solicitação pronta. Ele fica **na frente** dos canais oficiais (como o SP156), sem substituí-los.

Ele tem duas partes:
1. **App do cidadão** (celular, mobile-first): reportar um problema, tirar dúvidas num chat, falar por voz, receber alertas sonoros visuais para pessoas surdas.
2. **Console da gestão** (desktop, com login): servidores públicos veem as ocorrências num mapa, em filas por órgão e em gráficos, e corrigem a classificação da IA.

Ônibus com câmera também detectam problemas automaticamente pelas rotas, e essas detecções aparecem no console junto com os reportes dos cidadãos.

## Para quem

- **Dona Cida, 64 anos, Zona Leste.** Usa WhatsApp, mas trava em sites. Precisa de texto grande, poucos passos e opção de voz.
- **Rafael, 29 anos, ciclista.** Quer reportar em segundos, sem cadastro.
- **Marina, 41 anos, servidora da subprefeitura.** Quer ver o que é dela, priorizado e com evidência.

## Personalidade da marca

Confiável, acolhedora, direta e cidadã. **Não** pode parecer um site burocrático de governo nem copiar a identidade visual da Prefeitura, do SP156 ou de qualquer órgão real. É um produto independente que ajuda o cidadão a chegar ao canal certo. Tom de voz: simples, sem jargão, frases curtas, "você".

## Regras obrigatórias (fazem parte da nota)

- **Acessibilidade WCAG 2.1 AA:** contraste mínimo de 4.5:1 no texto, alvos de toque de no mínimo 48 px, rótulo visível em todos os campos, foco visível.
- **Cor nunca sozinha:** toda cor de criticidade (ok, atenção, perigo) vem sempre com **ícone e texto**.
- **Modo alto contraste:** uma variação da paleta (fundo preto, texto branco, cores claras).
- **Fonte legível:** sugiro Atkinson Hyperlegible (feita para baixa visão). Pode propor outra, se justificar.
- **Uma ação principal por tela** no app do cidadão.
- **Transparência da IA:** sempre mostrar o nível de confiança e permitir corrigir ("Não é isso").
- Tudo em **português do Brasil**.
- Vai ser construído em **Next.js + Tailwind CSS**, e os gráficos em **Plotly**. Pense em componentes que dão para fazer com isso.

## O que eu preciso

### 1. Identidade visual
- **Logo** simples (funciona pequeno, como ícone de app, e em preto e branco).
- **Paleta** com cores primárias, neutras e semânticas (ok, atenção, perigo, informação), na versão normal e na de alto contraste, com os valores em hex.
- **Tipografia** (títulos, corpo, tamanhos).
- Me entregue no final os **tokens** (cores, fontes, espaçamentos, raios de borda) em formato que eu consiga colar no Tailwind.

### 2. Folha de componentes
- **Selo** (cor + ícone + texto) em 4 variações: confiança alta, média e baixa; prioridade alta, média e baixa; origem do reporte (cidadão, ônibus, ambos).
- **Botões:** primário, secundário, perigo (emergência) e link.
- **Cartão**, campo de texto com rótulo e mensagem de erro, estado de carregando, estado vazio e mensagem de erro.
- **Botão de ligar para emergência** (grande, com número e nome, ex.: "📞 Ligar 193 · Bombeiros").

### 3. Três telas-chave

**Tela A · Início do cidadão (celular).**
Um botão principal grande "Reportar problema" (abre a câmera), um secundário "Tenho uma dúvida" e um botão de microfone "Falar". Acesso ao alto contraste. Sem cadastro.

**Tela B · Resultado do cidadão (celular).** Use este exemplo real:
- Dona Cida falou: "tem um buraco enorme na frente de casa" e mandou uma foto.
- Mostrar: "Isso parece ser **Buraco na via**", selo verde "Confiança alta (92%)", selo "Identificado pela foto", a foto com o buraco marcado por uma caixa, um bloco destacado **"Quem resolve: Prefeitura (subprefeitura) · Canal: SP156 · 156"**, uma explicação curta, botão principal **"Confirmar e gerar solicitação"**, botão **"Não é isso"** (abre uma lista para corrigir) e "🔊 Ouvir resposta".

**Tela C · Console da gestão (desktop).** Exemplo: Marina, da subprefeitura de Itaquera, logada.
- Topo: 3 indicadores (120 ocorrências no mês, 22% fora da competência da Prefeitura, 12% corrigidas pelo cidadão).
- Um **gráfico de barras** de ocorrências por categoria (Plotly) e **2 filtros** acima dele (categoria e órgão responsável), mais um filtro de origem (cidadão, ônibus, ambos).
- Uma **fila** em tabela, ordenada por prioridade: protocolo, categoria, endereço aproximado, origem, selo de prioridade, ações (mudar status, reclassificar).
- Um espaço para o mapa (pode ser um placeholder).
- Navegação lateral: Visão geral, Mapa, Filas, Frota, Qualidade da IA, Sair.

### 4. Se der tempo (opcional)
- **Tela de emergência:** aparece quando o cidadão escreve algo como "tem uma casa pegando fogo". Mostra o botão grande "Ligar 193 · Bombeiros", outros canais abaixo (190, 192, 199) e "Não é uma emergência, continuar". Existe também uma versão **discreta** para violência doméstica: sem vermelho, sem alarde e com um botão "Sair rápido" no canto.
- **Faixa de alerta sonoro (OuviAí):** uma faixa no topo de qualquer tela dizendo "🚨 Sirene por perto. Veículo de emergência pode estar passando", pensada para pessoas surdas.

## Como quero trabalhar

Comece pela identidade visual e me mostre 2 ou 3 direções diferentes antes de seguir. Depois de eu escolher uma, faça a folha de componentes e as 3 telas nessa direção. Explique rapidamente cada escolha de cor e de layout pensando em acessibilidade.
