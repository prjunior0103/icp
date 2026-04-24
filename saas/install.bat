@echo off
chcp 65001 >nul
echo === ICP — Instalação (Windows) ===

cd /d "%~dp0app"

:: .env
if not exist .env (
    echo DATABASE_URL=file:dev.db> .env
    echo AUTH_SECRET=TROCAR_ESTA_CHAVE_ALEATORIA_32_CHARS>> .env
    echo AUTH_TRUST_HOST=true>> .env
    echo PORT=3004>> .env
    echo ✅ .env criado
) else (
    echo ℹ️  .env já existe — mantido
)

:: Dependências
echo 📦 Instalando dependências...
call npm install

:: Prisma
echo 🗄️  Gerando cliente Prisma...
call npx prisma generate

echo 🗄️  Criando banco de dados...
call npx prisma db push

:: Build
echo 🔨 Fazendo build...
call npm run build

:: Seed
echo 🌱 Criando usuário admin e ciclo inicial...
start /b npm run start
timeout /t 8 /nobreak >nul
curl -s -X POST http://localhost:3004/api/seed >nul 2>&1

echo.
echo === Instalação concluída ===
echo ▶️  Para iniciar: execute start.bat
echo 🌐 Acesse: http://localhost:3004
echo 🔑 Login: admin@empresa.com / admin
echo.
pause
