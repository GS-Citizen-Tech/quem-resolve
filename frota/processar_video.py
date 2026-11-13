"""Simulação da frota: processa o vídeo (ou uma sequência de fotos) de uma câmera de ônibus.

O que faz (PRD 4.1, RF50–RF56):
 1. pega quadros em intervalo configurável (padrão: 3 por segundo);
 2. detecta danos no pavimento com o MESMO modelo da API (YOLOv8n RDD2022 em ONNX), com o limiar da frota;
 3. borra rostos e placas antes de salvar qualquer imagem (detectores Haar do OpenCV);
 4. junta detecções do mesmo dano em quadros seguidos (rastreio simples por IoU), para não contar duas vezes;
 5. associa cada dano a um ponto do GPS (arquivo GPX do celular) ou a um trajeto simulado;
 6. gera um vídeo anotado (caixas, confiança, FPS) e um relatório de desempenho;
 7. envia a passagem para POST /frota/passagens (opcional). O vídeo bruto nunca vai para a API.

O núcleo mora na API (app/pipelines/frota_video.py) e é o mesmo usado pela tela "Frota" do console, onde o gestor
envia um vídeo curto ou fotos pelo navegador. Este script é a versão "dentro do ônibus": roda no próprio veículo
(ou no PC) e só envia o resultado, sem mandar vídeo nenhum para a API.

Uso:
  python processar_video.py VIDEO.mp4 [--gpx trajeto.gpx] [--enviar http://localhost:8000]
  python processar_video.py PASTA_DE_FOTOS --fps-seq 2       (sequência de imagens)
Saída: pasta saida/<nome>/ com video_anotado.mp4, passagem.json, metricas.json e recortes/.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent / "api"))  # reaproveita o detector e o núcleo da API (mesmo pré e pós-processamento)
from app.pipelines.frota_video import ErroEntrada, Opcoes, processar as processar_nucleo  # noqa: E402
from app.providers.visao import YoloVisao  # noqa: E402

MODELO = AQUI.parent / "api" / "modelos" / "rdd2022-n-r2.onnx"


def processar(args) -> dict:
    entrada = Path(args.entrada)
    saida = Path(args.saida) / entrada.stem
    detector = YoloVisao(Path(args.modelo), Path(args.modelo).with_suffix(".json"))
    op = Opcoes(qps=args.qps, fps_seq=args.fps_seq, largura=args.largura, limiar=args.limiar, min_vistos=args.min_vistos,
                linha=args.linha, gpx=Path(args.gpx) if args.gpx else None,
                inicio=datetime.fromisoformat(args.inicio) if args.inicio else None,
                deslocamento_gps=args.deslocamento_gps, limite=args.limite, formato_video="mp4")
    try:
        r = processar_nucleo(entrada, saida, op, detector)
    except ErroEntrada as e:
        raise SystemExit(str(e))
    m = r.metricas
    print(f"\n{m['quadros_processados']} quadros em {m['tempo_total_s']:.1f} s → {m['fps_processamento']:.1f} FPS "
          f"(detecção média {m['latencia_deteccao_ms']['media']} ms, quadro inteiro {m['latencia_quadro_ms']['media']} ms, "
          f"resolução {m['resolucao_processada']})")
    print(f"{m['danos_unicos']} danos únicos · {m['regioes_borradas']} regiões borradas · GPS {m['gps']}")
    for l in m["danos"]:
        print(f"  #{l['id']:<3} {l['dano']:<16} {l['conf_max']:.0%}  em {l['t_s']:>5.1f} s  ({l['lat']}, {l['lon']})  visto em {l['quadros']} quadro(s)")
    print(f"Saída: {saida}")

    if args.enviar:
        import httpx
        resp = httpx.post(args.enviar.rstrip("/") + "/frota/passagens", json=r.passagem, timeout=60)
        print(f"API: {resp.status_code} {resp.text[:300]}")
        m["envio_api"] = {"status": resp.status_code, "resposta": resp.json() if resp.status_code < 300 else resp.text[:300]}
        (saida / "metricas.json").write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
    return m


def main(argv=None):
    p = argparse.ArgumentParser(description="Processa o vídeo da câmera do ônibus e detecta danos no pavimento.")
    p.add_argument("entrada", help="arquivo de vídeo (mp4, mov…) ou pasta com fotos em sequência")
    p.add_argument("--gpx", help="trajeto GPS gravado pelo celular (sem ele, usa um trajeto simulado na Av. Paulista)")
    p.add_argument("--inicio", help="horário do início do vídeo, ISO 8601 (ex.: 2026-11-12T14:05:00-03:00). Padrão: 1º ponto do GPX")
    p.add_argument("--deslocamento-gps", type=float, default=0.0, help="segundos para alinhar vídeo e GPX")
    p.add_argument("--qps", type=float, default=3.0, help="quadros analisados por segundo de vídeo (RF50)")
    p.add_argument("--fps-seq", type=float, default=2.0, help="para pasta de fotos: quantas fotos equivalem a 1 s")
    p.add_argument("--largura", type=int, default=1280, help="reduz quadros maiores para esta largura (0 = não reduz)")
    p.add_argument("--limiar", type=float, help="confiança mínima (padrão: limiar da frota do modelo, 0,35)")
    p.add_argument("--min-vistos", type=int, default=2, help="vídeo: dano precisa aparecer em N quadros para contar")
    p.add_argument("--linha", default="8000-10", help="linha do ônibus simulado")
    p.add_argument("--modelo", default=str(MODELO))
    p.add_argument("--saida", default=str(AQUI / "saida"))
    p.add_argument("--limite", type=int, default=0, help="para testes: processa no máximo N quadros")
    p.add_argument("--enviar", help="URL da API para enviar a passagem (ex.: http://localhost:8000)")
    return processar(p.parse_args(argv))


if __name__ == "__main__":
    main()
