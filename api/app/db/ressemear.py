"""Troca os dados de exemplo à força (normalmente não precisa: a API já troca sozinha na subida
quando a versão da simulação muda, ver simulacao.atualizar_se_preciso).

Rodar dentro de api/, com a API parada:   python -m app.db.ressemear
Apaga só o que está marcado como simulado (ocorrências e passagens da frota). Reportes reais ficam.
"""
from app import config
from app.pipelines import simulacao
from app.providers import repositorio


def main() -> None:
    repositorio.preparar()
    print(f"Banco: {repositorio.nome()}")
    repositorio.gravar_meta("simulacao", "forcar")
    print(simulacao.atualizar_se_preciso(config.SEED_OCORRENCIAS or 120))


if __name__ == "__main__":
    main()
