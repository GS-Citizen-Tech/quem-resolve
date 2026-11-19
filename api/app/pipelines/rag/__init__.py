"""Assistente RAG (disciplina 05 · Generative AI), portado do notebook GS-GENAI-CITIZENTECH.

Mesma técnica avaliada no notebook, aplicada à base "Quem resolve o quê" (app/data/voz):
- corpus.py      chunking estrutural (um trecho por categoria e por seção do FAQ, até 1200 caracteres, overlap 150)
- seguranca.py   sanitização na ingestão (quarentena), lista de fontes permitidas, máscara de PII, pós-validação
- recuperacao.py BM25 + denso (multilingual-e5-small) com RRF k=60, reranker cross-encoder sobre 20 candidatos
- gerador.py     prompt com escopo fechado e citações, Gemini com JSON preso a um esquema e lista de modelos reserva
- pipeline.py    guarda de entrada → recuperação → gate de similaridade → LLM → pós-validação
"""
