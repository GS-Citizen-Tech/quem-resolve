# Quem Resolve?

Roteador inteligente de problemas de zeladoria e limpeza urbana em São Paulo. Global Solution 2026.2 · FIAP · desafio CitizenTech.

> README em construção: a versão completa (problema, ODS, arquitetura, decisões, ética, validação) entra na fase F4.

## Acesse online

- **App do cidadão:** https://quem-resolve.vercel.app (troque pelo endereço que a Vercel der)
- **Console da gestão:** mesmo endereço + `/gestao` (entre como `marina` / `demo-123`)
- **API (documentação):** https://quem-resolve-api.onrender.com/docs

A API fica no plano grátis do Render e "dorme" depois de 15 minutos sem uso: a primeira abertura pode levar até 1 minuto (o site avisa "Ligando o servidor"). Como publicar: `docs/DEPLOY.md`.

## Estrutura

```
api/    FastAPI · routers/ schemas/ pipelines/ providers/ (módulos começam com dados falsos)
web/    Next.js · features/ ui/ state/ providers/ (visual do design system)
docs/   PRD, contratos da API, plano do front, exemplos de fluxo e design system
```

## Como rodar

**Atalho no Windows:** dê dois cliques em `start-all.bat`. Na primeira vez ele cria o ambiente Python e roda o `npm install`; depois abre a API e o front em duas janelas e o navegador em `localhost:3000`.

**Passo a passo manual:**


**API** (Python 3.11+):
```bash
cd api
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/Mac: source .venv/bin/activate)
pip install -r requirements-dev.txt
copy .env.example .env           # Linux/Mac: cp .env.example .env
uvicorn app.main:app --reload    # http://localhost:8000/docs
pytest                           # testes
```

**Banco:** sem `DATABASE_URL` no `api/.env` a API guarda tudo em memória (some ao reiniciar). Para usar o Supabase (Postgres + fotos no Storage privado), siga `docs/SUPABASE-PASSO-A-PASSO.md`: a API cria as tabelas sozinha. Testes no Postgres: `TEST_DATABASE_URL=postgresql://... pytest` (use um banco só de teste).

A visão computacional usa o modelo real por padrão (`VISAO_PROVIDER=yolo`, arquivo `api/modelos/rdd2022-n-r2.onnx`, roda em CPU com onnxruntime, ~50 ms por foto). Para voltar ao mock, troque para `VISAO_PROVIDER=mock` no `.env`. Treino e métricas do modelo ficam fora da solução, em `Materias/VC`.

Quando o YOLO não acha dano, a foto do cidadão pode ir para uma **reserva multimodal** (Gemini Flash), que reconhece as outras categorias (fio, lixo, poste, árvore, alagamento...). Ligue com `VISAO_RESERVA=gemini` e a chave do Google AI Studio em `VISAO_RESERVA_CHAVE` (ou `LLM_API_KEY`). Antes de sair do servidor a foto é reduzida, perde o EXIF e tem rostos, pessoas e placas borrados (LGPD). Sem chave ou com o Gemini fora do ar, o app segue só com o texto. `VISAO_RESERVA=mock` testa o fluxo sem chave.

**Assistente de voz (disciplina 08, PLN):** o botão "Falar" de `/assistente` chama `POST /voz/conversar`. Com `VOZ_PROVIDER=real` entra o módulo de PLN (`api/app/pipelines/voz/`): faster-whisper transcreve na máquina, o guardrail da API roda antes, o RAG (MiniLM multilíngue sobre `api/app/data/voz/`) recupera as fontes, o LLM (Groq `gpt-oss-120b`, chave em `VOZ_LLM_API_KEY`) responde, a adaptação para fala ajusta números e siglas e o Piper gera o áudio. Instale com `pip install -r requirements-voz.txt` (~1,5 GB). A API carrega os modelos em segundo plano na subida (~20 s). O áudio do cidadão é transcrito da memória e descartado; só o texto vai para o LLM. Sem chave ou com o LLM fora do ar, a voz responde indicando o SP156. Em emergência e violência (nível 1 ou 2) não há áudio. Relatório, testes de WER/TTS/latência e a interface Gradio original ficam fora da solução, em `GS PLN/quem-resolve-voz`.

**Frota (vídeo de rua → ocorrências):** ver `frota/README.md`.

**Com Docker** (API + front de uma vez): `docker compose up --build` na raiz → http://localhost:3000. Sem `api/.env` usa dados de exemplo em memória. Detalhes em `docs/DEPLOY.md`, seção 5.

**Front** (Node 20+):
```bash
cd web
npm install
copy .env.example .env.local     # Linux/Mac: cp .env.example .env.local
npm run dev                      # http://localhost:3000
```

Páginas prontas na F0: `/` (início do cidadão) e `/componentes` (vitrine dos componentes nos 3 temas).
Login de demonstração do gestor (API): `marina` / `demo-123` (Subprefeitura) e `joao` / `demo-123` (Sabesp).

## Créditos e dados de terceiros

- **Traçado das linhas de ônibus:** GTFS oficial da SPTrans (Área do Desenvolvedor), baixado em 17/11/2026. Só o caminho é real; passagens e danos são simulados.
- **Bairros:** 96 distritos oficiais do município (GeoSampa, via `codigourbano/distritos-sp`); reserva pela malha do IBGE.
- **Mapa e endereços:** © colaboradores do OpenStreetMap (tiles e Nominatim, com limite de uso respeitado pela API).
- **Modelo de visão:** YOLOv8n treinado no dataset RDD2022 (danos no asfalto).
- **Foto de fundo:** Avenida Paulista, São Paulo.
