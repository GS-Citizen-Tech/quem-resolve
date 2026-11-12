@echo off
chcp 65001 >nul
setlocal
title Quem Resolve? - iniciar tudo
cd /d "%~dp0"

echo ============================================
echo   Quem Resolve? - API + Front
echo ============================================

where python >nul 2>nul || (echo [ERRO] Python nao encontrado. Instale o Python 3.11+ e marque "Add to PATH". & pause & exit /b 1)
where npm >nul 2>nul || (echo [ERRO] Node.js nao encontrado. Instale o Node 20+ em nodejs.org. & pause & exit /b 1)

rem ---------- API ----------
if not exist "api\.venv\Scripts\python.exe" (
  echo [API] Criando ambiente virtual (so na primeira vez^)...
  python -m venv "api\.venv" || (echo [ERRO] Nao consegui criar o ambiente virtual. & pause & exit /b 1)
)
rem Sempre confere as dependencias (rapido quando ja estao instaladas; pega pacotes novos, como o onnxruntime da visao)
echo [API] Conferindo dependencias (na primeira vez depois de uma atualizacao pode levar 1 a 2 minutos, nao feche^)...
"api\.venv\Scripts\python.exe" -m pip install --disable-pip-version-check --progress-bar on -r "api\requirements-dev.txt" || (echo [ERRO] Falha ao instalar as dependencias da API. & pause & exit /b 1)
if not exist "api\.env" copy "api\.env.example" "api\.env" >nul

rem ---------- Front ----------
rem Sempre confere as dependencias (rapido quando ja estao instaladas; pega pacotes novos, como o Plotly do console)
echo [WEB] Conferindo dependencias (na primeira vez depois de uma atualizacao pode demorar, nao feche^)...
pushd web
call npm install --no-audit --no-fund || (popd & echo [ERRO] Falha no npm install. & pause & exit /b 1)
popd
if not exist "web\.env.local" copy "web\.env.example" "web\.env.local" >nul

rem ---------- Subir os dois ----------
echo Subindo a API em http://localhost:8000 ...
start "Quem Resolve - API" cmd /k "cd /d "%~dp0api" && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

echo Subindo o front em http://localhost:3000 ...
start "Quem Resolve - Front" cmd /k "cd /d "%~dp0web" && npm run dev"

echo Aguardando o front ficar pronto...
timeout /t 8 /nobreak >nul
start "" http://localhost:3000

echo.
echo Pronto! Duas janelas foram abertas (API e Front).
echo   App:         http://localhost:3000
echo   Componentes: http://localhost:3000/componentes
echo   API (docs):  http://localhost:8000/docs
echo Para parar, feche as duas janelas.
echo.
pause
