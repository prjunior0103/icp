@echo off
chcp 65001 >nul
echo === ICP — Aplicando atualização ===
cd /d "%~dp0app"

echo 🗄️  Atualizando banco de dados...
call npx prisma db push

echo 🔨 Fazendo novo build...
call npm run build

echo.
echo === Atualização concluída ===
echo ▶️  Execute start.bat para iniciar
echo.
pause
