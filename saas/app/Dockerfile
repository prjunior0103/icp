# =============================================================================
# ICP — Dockerfile multi-stage (Next.js 16 + Prisma 7 + SQLite/libsql)
# -----------------------------------------------------------------------------
# Observacoes importantes deste projeto (descobertas inspecionando o repo):
#  - O next.config.ts NAO usa `output: 'standalone'`. Por isso usamos o caminho
#    classico: `npm run build` + `npm start` (next start).
#  - O Prisma gera o client em `app/generated/prisma` (que e gitignored), entao
#    rodamos `prisma generate` durante o build.
#  - O banco usa o adapter libsql (@prisma/adapter-libsql). Ele tem binario
#    nativo por plataforma. NUNCA copiamos node_modules do host (que e macOS
#    arm64); instalamos as dependencias DENTRO do container (Linux) para baixar
#    o binario correto (@libsql/linux-*).
#  - Existem migrations Prisma versionadas, entao o entrypoint roda
#    `prisma migrate deploy` (e nao `db push`).
# =============================================================================

# Node 22 LTS (alpine) — o repo nao fixa `engines.node`; 22 LTS e a escolha
# segura e suportada para Next 16.
ARG NODE_VERSION=22-alpine

# -----------------------------------------------------------------------------
# Stage 1 — deps: instala TODAS as dependencias (inclui dev, necessarias p/ build)
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# libc6-compat ajuda bibliotecas nativas (libsql) a carregarem no Alpine.
RUN apk add --no-cache libc6-compat

# Copia apenas os manifests primeiro para aproveitar o cache de camadas.
COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2 — builder: gera o client Prisma e faz o build do Next.js
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gera o Prisma Client (vai para app/generated/prisma).
RUN npx prisma generate

# Build do Next.js. Telemetria desligada para builds limpos/reprodutiveis.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 — runner: imagem final, enxuta, rodando como usuario nao-root
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat wget

# Ambiente de producao. PORT default 3003 (a app escuta em 0.0.0.0 dentro do
# container; o isolamento vem do docker-compose, que publica so em 127.0.0.1).
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3003
ENV HOSTNAME=0.0.0.0
# Caminho do banco DENTRO do container — fica em volume nomeado montado em /data.
ENV DATABASE_URL=file:/data/app.db

# Usuario nao-root.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Diretorio de dados (volume e montado aqui em runtime).
RUN mkdir -p /data && chown -R nextjs:nodejs /data

# Copia o resultado do build + tudo o que o `next start` precisa em runtime.
# (Sem standalone, precisamos de node_modules, .next, public, configs e prisma.)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/app/generated ./app/generated
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs

EXPOSE 3003

# Healthcheck simples: bate na raiz da app. Se nao responder 2xx/3xx, falha.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider "http://127.0.0.1:${PORT}/" || exit 1

# O entrypoint roda as migrations antes de subir o servidor.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
