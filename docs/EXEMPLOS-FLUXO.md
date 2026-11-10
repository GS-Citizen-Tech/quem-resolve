# Exemplos de fluxo: Quem Resolve?

> 07/11/2026 · Complementa o `PLANO-FRONT.md` (seções 3 e 4). Usa as personas do PRD.

---

## 1. Cidadão: Dona Cida reporta um buraco

1. **Início.** Dona Cida abre o app e toca em "Reportar problema".
2. **Captura.** Ela fala "tem um buraco enorme na frente de casa", tira uma foto, e o app pega a localização sozinho.
3. **Analisando.** Aparece uma barra com as etapas "olhando a foto…" e "descobrindo quem resolve…". Por trás, a foto vai para a **Visão Computacional** (`/visao/detectar`), que acha um buraco com 82% de certeza, e o texto vai para a API (`/reportes/analisar`), que confirma a categoria.
4. **Resultado.** "Isso parece ser **buraco na via**. Quem resolve: **subprefeitura**, pelo SP156." Com selo verde de "confiança alta" e a foto com o buraco marcado.
5. **"Não é isso".** Se a IA errasse, ela trocaria a categoria aqui. É o ponto em que o humano corrige a IA (**human-in-the-loop**).
6. **Confirmação → Protocolo.** Ela confirma (`POST /ocorrencias`) e recebe "Protocolo QR-261107-A1B2C". Depois o **robô de RPA** envia o e-mail para o órgão e marca a ocorrência como "enviada".

### Desvios

| Situação | Exemplo | O que acontece |
|---|---|---|
| **Emergência** (nível 1 ou 2) | "tem uma casa pegando fogo" | O fluxo para. Aparece direto o botão "Ligar 193" e nada do que ela escreveu é guardado. |
| **Risco** (nível 3) | "fio soltando faísca" | Mostra primeiro o aviso com o 193 e depois deixa continuar o reporte. |
| **Internet ou IA fora do ar** | API não responde | O app pede para escolher a categoria numa lista e o reporte segue normal. |

---

## 2. Gestão: Marina trata as ocorrências

Marina é servidora da subprefeitura de Itaquera. O exemplo continua o buraco da Dona Cida.

1. **Visão geral.** Ela abre o console e vê os números do mês: 120 ocorrências, 22% fora da competência da Prefeitura, 12% corrigidas pelo cidadão. Embaixo, o **gráfico Plotly** de ocorrências por categoria. Ela usa os **filtros** (órgão = subprefeitura, categoria = buraco) e o gráfico muda na hora.
2. **Mapa.** Ela vê os pontos em Itaquera. O buraco da Dona Cida aparece com ícone de "cidadão + frota", porque um ônibus também filmou esse buraco no dia anterior. As duas viraram **uma ocorrência só**, com prioridade maior.
3. **Filas.** Na fila da subprefeitura, ordenada por prioridade, o buraco está no topo com o selo vermelho "Prioridade 4 · alta". Abaixo há uma "calçada quebrada" que na verdade era "árvore", e ela **reclassifica** (human-in-the-loop do gestor). Depois marca o buraco como "resolvido".
4. **Frota.** Ela vê o trajeto da linha 3789 no mapa e o que o ônibus detectou em cada trecho. Na passagem seguinte o ônibus não vê mais o buraco, e a ocorrência vira "possivelmente resolvida".
5. **Qualidade da IA.** Ela confere a confiança média da visão, as classificações de baixa confiança esperando revisão e quantas vezes o guardrail disparou (só números anônimos, sem texto de ninguém).

---

## Resumo

**O cidadão alimenta, a frota complementa e a gestão prioriza e corrige.**

| Passo | Matéria que aparece |
|---|---|
| Foto analisada | Visão Computacional |
| Texto entendido, fonte citada | Generative AI |
| Fala em vez de digitar | PLN (voz) |
| Alerta de emergência | Generative AI + Governança |
| E-mail ao órgão | RPA |
| Ônibus detectando problemas | Visão Computacional + Cluster |
| Telas, HITL, Plotly, filtros | Front-end |
| Alerta de sirene para surdos | IoT (OuviAí) |
| Quais ônibus equipar, como priorizar | Computação Quântica (roadmap) |
