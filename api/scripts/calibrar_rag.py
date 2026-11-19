"""Calibra o gate do RAG e mede a recuperação na base do Quem Resolve (notebook, Seções 5 e 5.2). Não chama o LLM.

Rodar dentro de api/:  python -m scripts.calibrar_rag
Saída: Hit@1/Hit@3/MRR@5 das perguntas do tema e as similaridades máximas (tema × fora do tema) com o limiar
sugerido para RAG_LIMIAR (ponto médio entre o menor do tema e o maior fora dele, ou um valor conservador se sobrepõem).
"""
import statistics

from app import config
from app.pipelines.rag.corpus import carregar_documentos, chunk_estrutural
from app.pipelines.rag.recuperacao import Indice
from app.pipelines.rag.seguranca import sanitizar
from app.providers.rag import BASE_RAG

# (pergunta, id do documento que deve vir)
NO_TEMA = [
    ("Tem um buraco enorme na minha rua, quem conserta?", "buraco"),
    ("O poste da esquina está apagado faz uma semana", "iluminacao"),
    ("Tem um fio de internet pendurado na calçada, quem eu chamo?", "fio_telecom"),
    ("Está vazando água limpa na rua há dias", "vazamento_agua"),
    ("Tá saindo esgoto na frente de casa, cheiro horrível", "esgoto"),
    ("Sinto cheiro de gás na rua", "gas"),
    ("A calçada em frente da casa do vizinho está quebrada, de quem é a responsabilidade?", "calcada"),
    ("Uma árvore caiu e está bloqueando a rua", "arvore"),
    ("O semáforo do cruzamento está desligado", "semaforo"),
    ("O caminhão do lixo não passou essa semana", "coleta_lixo"),
    ("Jogaram entulho e sofá velho na esquina", "descarte_irregular"),
    ("A boca de lobo está entupida e alaga tudo quando chove", "boca_de_lobo"),
    ("Tem um carro abandonado há meses na minha rua", "veiculo_abandonado"),
    ("Acabou a luz na minha casa, quem eu chamo?", None),
    ("O que é o SP156?", None),
    ("Onde descarto um sofá velho de graça?", None),
]
FORA = [
    "Me passa uma receita de bolo de cenoura",
    "Quem ganhou o jogo do Corinthians ontem?",
    "Como eu tiro o passaporte?",
    "Qual remédio tomo para dor de cabeça?",
    "Em quem devo votar para prefeito?",
    "Como faço para pedir o seguro-desemprego?",
    "Me ajuda a fazer meu currículo",
    "Qual a capital da França?",
]


def main():
    trechos = chunk_estrutural(carregar_documentos(BASE_RAG))
    sanitizar(trechos)
    print(f"Trechos: {len(trechos)} | em quarentena: {[t.id for t in trechos if t.quarentena]}")
    idx = Indice(trechos, config.RAG_EMBEDDINGS, config.RAG_RERANKER or None, n_cand=config.RAG_CANDIDATOS)
    ids = {t.doc_id for t in idx.trechos}

    hits1, hits3, mrr = [], [], []
    print("\nRecuperação (top-5, híbrido + rerank):")
    for q, alvo in NO_TEMA:
        res = [t.doc_id for t in idx.buscar(q, 5)]
        if alvo and alvo in ids:
            pos = res.index(alvo) + 1 if alvo in res else None
            hits1.append(pos == 1)
            hits3.append(bool(pos and pos <= 3))
            mrr.append(1 / pos if pos else 0.0)
        print(f"  {'ok ' if not alvo or alvo in res[:3] else 'ERRO'} {q[:55]:55} -> {res[:3]}")
    if hits1:
        print(f"Hit@1 {statistics.mean(hits1):.2f} | Hit@3 {statistics.mean(hits3):.2f} | MRR@5 {statistics.mean(mrr):.2f}")

    tema = [idx.max_sim(q) for q, _ in NO_TEMA]
    fora = [idx.max_sim(q) for q in FORA]
    print(f"\nSimilaridade máxima no tema: min {min(tema):.3f} média {statistics.mean(tema):.3f}")
    print(f"Similaridade máxima fora:    max {max(fora):.3f} média {statistics.mean(fora):.3f}")
    for q in FORA:
        print(f"  {idx.max_sim(q):.3f} {q}")
    if max(fora) < min(tema):
        print(f"\nSeparáveis. RAG_LIMIAR sugerido = {(max(fora) + min(tema)) / 2:.3f}")
    else:
        print(f"\nSobrepõem. RAG_LIMIAR conservador = {sorted(tema)[0] - 0.01:.3f} (o prompt trata o restante)")


if __name__ == "__main__":
    main()
