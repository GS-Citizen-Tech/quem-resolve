"""Baixa a malha dos 96 distritos de São Paulo (IBGE) e salva em app/data/distritos_sp.geojson.

Não é obrigatório: a API já baixa sozinha na primeira vez que sobe (v1.3). Serve para baixar de novo à mão.
Rodar dentro de api/:   python scripts/baixar_distritos.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.providers import malha_ibge  # noqa: E402
from app.providers.distritos import ARQUIVO  # noqa: E402


def main():
    try:
        dados = malha_ibge.montar(avisar=print)
    except malha_ibge.ErroMalha as e:
        sys.exit(f"{e}. Nada foi salvo.")
    malha_ibge.salvar(dados, ARQUIVO)
    print(f"Pronto: {len(dados['features'])} distritos em {ARQUIVO} ({ARQUIVO.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
