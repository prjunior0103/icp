#!/bin/sh
# =============================================================================
# Entrypoint do container ICP.
# Aplica as migrations do Prisma no banco (volume /data) ANTES de subir a app.
# =============================================================================
set -e

echo "[entrypoint] DATABASE_URL=${DATABASE_URL}"

# Existem migrations versionadas neste projeto, entao usamos `migrate deploy`
# (aplica apenas migrations ja criadas, nunca gera novas — seguro p/ producao).
# Se algum dia o projeto deixar de ter migrations, troque por:
#   npx prisma db push --skip-generate
echo "[entrypoint] Aplicando migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[entrypoint] Migrations OK. Subindo a aplicacao..."
exec "$@"
