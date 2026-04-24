@echo off
chcp 65001 >nul
echo === ICP — Iniciando servidor ===
cd /d "%~dp0app"
echo 🌐 Acesse: http://localhost:3004
echo 🔑 Login: admin@empresa.com / admin
echo.
npm run start
