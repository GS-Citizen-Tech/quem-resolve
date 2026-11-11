# Quem Resolve?

Roteador inteligente de problemas de zeladoria e limpeza urbana em São Paulo. Global Solution 2026.2 · FIAP · desafio CitizenTech.

> README em construção: a versão completa (problema, ODS, arquitetura, decisões, ética, validação) entra na fase F4.

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

A visão computacional usa o modelo real por padrão (`VISAO_PROVIDER=yolo`, arquivo `api/modelos/rdd2022-n-r2.onnx`, roda em CPU com onnxruntime, ~50 ms por foto). Para voltar ao mock, troque para `VISAO_PROVIDER=mock` no `.env`. Treino e métricas do modelo ficam fora da solução, em `Materias/VC`.

Quando o YOLO não acha dano, a foto do cidadão pode ir para uma **reserva multimodal** (Gemini Flash), que reconhece as outras categorias (fio, lixo, poste, árvore, alagamento...). Ligue com `VISAO_RESERVA=gemini` e a chave do Google AI Studio em `VISAO_RESERVA_CHAVE` (ou `LLM_API_KEY`). Antes de sair do servidor a foto é reduzida, perde o EXIF e tem rostos, pessoas e placas borrados (LGPD). Sem chave ou com o Gemini fora do ar, o app segue só com o texto. `VISAO_RESERVA=mock` testa o fluxo sem chave.

**Frota (vídeo de rua → ocorrências):** ver `frota/README.md`.

**Front** (Node 20+):
```bash
cd web
npm install
copy .env.example .env.local     # Linux/Mac: cp .env.example .env.local
npm run dev                      # http://localhost:3000
```

Páginas prontas na F0: `/` (início do cidadão) e `/componentes` (vitrine dos componentes nos 3 temas).
Login de demonstração do gestor (API): `marina` / `demo-123`.
