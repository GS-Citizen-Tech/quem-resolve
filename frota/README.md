# Frota · processamento de vídeo (VC + Cluster)

Simula a câmera de um ônibus: lê um vídeo de rua (ou uma sequência de fotos), detecta danos no pavimento com o **mesmo modelo da API**
(`api/modelos/rdd2022-n-r2.onnx`), borra rostos, pessoas e placas, junta o mesmo dano visto em quadros seguidos e manda a passagem
para `POST /frota/passagens`. As ocorrências aparecem no console com `origem: "frota"`. O vídeo bruto nunca vai para a API.

## Dois jeitos de usar (mesmo código)

- **Pelo console (v1.0):** na tela **Frota** do painel do gestor, envie um vídeo curto (até 1 min analisado) ou várias fotos.
  A API processa em segundo plano, mostra o progresso, o vídeo anotado e coloca os danos no mapa. Nada para instalar além da API.
- **Dentro do ônibus (este script):** roda no próprio veículo (ou no PC) e só envia o resultado para `POST /frota/passagens`.
  É o caminho para vídeos longos: nenhum vídeo sai do ônibus.

O núcleo (detecção, borrar, rastreio, GPS, vídeo anotado) mora em `api/app/pipelines/frota_video.py`; o script só lê os
argumentos e imprime o resumo.

## Instalar (uma vez)

Usa o mesmo ambiente da API (o OpenCV agora vem nele, porque a API também borra a foto do cidadão):

```
cd "D:\FACULDADE\GS Citizen Tech\Solucao_Final"
api\.venv\Scripts\python.exe -m pip install -r frota\requirements.txt
```

## Rodar

```
api\.venv\Scripts\python.exe frota\processar_video.py CAMINHO\video.mp4 --gpx CAMINHO\trajeto.gpx --enviar http://localhost:8000
```

- **Vídeo:** celular preso no painel, olhando a rua à frente, 1 a 2 min. Analisa 3 quadros por segundo (`--qps`).
- **GPS:** arquivo GPX de um app de trilha (ex.: *GPS Logger*, *Geo Tracker*). Sem `--gpx`, usa um trajeto simulado na Av. Paulista.
  Se o vídeo e o GPX começaram em horários diferentes, ajuste com `--deslocamento-gps SEGUNDOS`.
- **Sequência de fotos:** passe uma pasta no lugar do vídeo (`--fps-seq 2` = 2 fotos por segundo no vídeo anotado).
- **Sem `--enviar`:** só processa e salva os arquivos, sem mandar para a API.

## Saída (`frota/saida/<nome do vídeo>/`, fora do Git)

| Arquivo | O que é |
|---|---|
| `video_anotado.mp4` | Vídeo com as caixas, a confiança, o número do dano e o FPS na tela (já borrado). Vai para o vídeo de demonstração. |
| `passagem.json` | Exatamente o que é enviado para `POST /frota/passagens` (contrato I). |
| `metricas.json` | FPS de processamento, latência por quadro e por detecção, resolução, equipamento, lista de danos. Vai para o relatório de VC. |
| `recortes/` | Recorte de cada dano (borrado). Também segue dentro do `passagem.json` como `recorte_url` em data URL. |

## Escolhas

- **Limiar 0,35** (o da frota, escolhido na validação para precisão ≥ 0,70): sem humano na hora, falso positivo vira ocorrência falsa.
- **Dano só conta se aparecer em 2 quadros seguidos** (`--min-vistos`), o que corta detecção piscando.
- **Rastreio simples por IoU** (mesma classe, caixa sobreposta ou descendo na imagem): um dano = uma ocorrência por passagem.
  Duplicatas entre passagens e com reportes de cidadãos são juntadas pela API (proximidade + categoria).
- **Privacidade:** a detecção roda em memória no quadro original; antes de gravar qualquer imagem, rostos, pessoas e placas são borrados
  com detectores que já vêm no OpenCV (Haar e HOG). Não são perfeitos: por isso o vídeo bruto nunca é enviado nem guardado pelo sistema.
- **Quadros maiores que 1280 px** são reduzidos (`--largura`); o modelo trabalha em 640×640 de qualquer jeito.

Testado em CPU (Linux, 4 núcleos): vídeo 1280×720 a 3 quadros/s → ~7 FPS de processamento (detecção ~40 ms, borrar ~85 ms por quadro),
ou seja, mais rápido que o tempo real.
