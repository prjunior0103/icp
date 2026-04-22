# ICP — Comparativo de Versões

## Variantes

| Aspecto | `saas/` (VPS Produção) | `icp_GCB/` (Local Vendível) |
|---------|------------------------|------------------------------|
| Ambiente | VPS (root@187.77.34.25) | Instalação local do cliente |
| Porta | 3003 | 3004 |
| Banco de dados | SQLite (`dev.db`) na VPS | SQLite local (isolado) |
| Serviço | `icp.service` (systemd) | `npm run dev` ou `npm start` |
| Auth | NextAuth v5 JWT | NextAuth v5 JWT |
| Admin padrão | `admin@empresa.com` | Definido no setup inicial |

## Regra de Replicação

Toda mudança de **negócio ou funcionalidade** implementada em `saas/` deve ser replicada em `icp_GCB/` (e vice-versa), salvo quando explicitamente marcada como exclusiva de uma variante.

Mudanças de **infraestrutura** (paths, serviços, VPS) são exclusivas de cada variante.

## Setup icp_GCB (primeira vez)

```bash
cd icp_GCB/app
cp .env.example .env          # editar AUTH_SECRET e senha admin
npm install
npx prisma db push
npm run dev                    # http://localhost:3004
```

## Segurança icp_GCB

- Nunca usar senha padrão "admin" em produção
- Gerar `AUTH_SECRET` único: `openssl rand -hex 32`
- Configurar `AUTH_TRUST_HOST=true` somente em rede local isolada
