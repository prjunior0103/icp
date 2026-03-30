# ICP — Incentivo de Curto Prazo

Sistema de gestão de performance e cálculo de bônus de curto prazo para colaboradores.

## O que é o sistema

Gerencia ciclos de ICP (ano fiscal), metas de performance, realizações mensais e cálculo automático de bônus. Suporta estrutura hierárquica de organizações: Empresa → Centro de Custo → Colaborador, com fluxo de aprovação para metas e realizações.

**Perfis de usuário:** Guardião (admin), BP (Business Partner), Gestor, Colaborador.

## Stack

- **Frontend/Backend:** Next.js (App Router), React 19, TypeScript 5, Tailwind CSS 4
- **Banco de dados:** SQLite via LibSQL + Prisma 7 (com `driverAdapters`)
- **Auth:** NextAuth v5 (JWT, credentials)
- **Charts:** Recharts
- **Cálculos financeiros:** decimal.js
- **Testes:** Vitest

## Estrutura do projeto

```
app/
├── app/
│   ├── api/           # 25 rotas de API
│   ├── lib/
│   │   ├── calc.ts        # Motor de cálculo (nota, prêmio)
│   │   ├── janelas.ts     # Validação de janelas de apuração
│   │   ├── validators.ts  # Validação de linhas no bulk import
│   │   ├── auth.ts        # Config NextAuth
│   │   └── prisma.ts      # Instância do Prisma
│   ├── login/
│   └── page.tsx       # Dashboard principal (~3000 linhas, tudo tabulado)
├── components/
│   ├── MasterDashboard.tsx    # Visão executiva/admin
│   ├── PainelGestor.tsx       # Visão de equipe do gestor
│   └── CockpitColaborador.tsx # Visão pessoal do colaborador
├── prisma/
│   └── schema.prisma  # Modelo completo de dados
├── __tests__/         # Testes Vitest
└── dev.db             # Arquivo SQLite
```

## Como rodar

```bash
cd app
npm install
npm run dev        # http://localhost:3000
npm run build      # Build de produção
npm test           # Testes unitários
```

**Login padrão:** `admin` / `admin` (configurado via `.env`)

**Variáveis de ambiente** (`.env`):
```
DATABASE_URL="file:./dev.db"
AUTH_SECRET=icp_change_this_in_production_now
AUTH_USERNAME=admin
AUTH_PASSWORD=admin
```

## Lógica de negócio central

### Cálculo de Nota (`app/lib/calc.ts`)

```
PROJETO_MARCO:      100 se realizado >= 1, senão 0
MENOR_MELHOR:       nota = metaAlvo / valorRealizado * 100
MAIOR_MELHOR:       nota = valorRealizado / metaAlvo * 100

- Abaixo do mínimo → nota = 0
- Teto: 120
```

### Cálculo de Prêmio

```
prêmio = salarioBase × multiploSalarial × (nota / 100) × (pesoNaCesta / 100)
```

### Janelas de apuração

Submissões só são aceitas se a `JanelaApuracao` do mês/ano estiver `ABERTA` ou `PRORROGADA`. Colaboradores com waiver aprovado passam mesmo com janela fechada.

### Fases do Ciclo

| Fase | Metas | Realizações |
|------|-------|-------------|
| SETUP | Criar/editar | Bloqueado |
| ATIVO | Editar | Permitido |
| ENCERRADO | Bloqueado | Bloqueado |

## Rotas de API principais

| Rota | Função |
|------|--------|
| `/api/ciclos` | CRUD dos ciclos ICP |
| `/api/metas` | CRUD de metas + atribuição |
| `/api/realizacoes` | Submissão de realizações (calcula nota/prêmio automaticamente) |
| `/api/scorecard` | Scorecard individual (metas ponderadas, YTD) |
| `/api/dashboard` | KPIs executivos (top performers, uso do pool) |
| `/api/agrupamentos` | Agrupamentos e cascata de metas para gestores |
| `/api/bulk-import` | Importação em lote de realizações |
| `/api/import-colaboradores` | Importação de colaboradores via Excel |
| `/api/workflow` | Fluxo de aprovação (metas, realizações, waivers) |
| `/api/janelas` | Janelas de apuração por mês/ano |
| `/api/waivers` | Prorrogações de janela fechada |
| `/api/movimentacoes` | Movimentações de RH (admissão, transferência, desligamento) |
| `/api/seed` | Bootstrap de dados de demonstração |
| `/api/reset` | Reset completo do banco |

## Modelos de dados chave

- **CicloICP** — Ciclo anual com pool de bônus e gatilho de EBITDA
- **Indicador** — KPI com tipo (`VOLUME_FINANCEIRO`, `CUSTO_PRAZO`, `PROJETO_MARCO`), polaridade e nível (`CORPORATIVO`, `AREA`, `INDIVIDUAL`)
- **Meta** — Alvo de performance: peso na cesta, faixas min/alvo/max, status (`DRAFT → APROVADO`)
- **MetaColaborador** — N:N colaborador↔meta com peso personalizado opcional
- **Realizacao** — Resultado mensal com `notaCalculada` e `premioProjetado` automáticos
- **JanelaApuracao** — Janela de submissão por mês/ano
- **Agrupamento** — Grupo de metas para cascata a gestores
- **WorkflowItem** — Item de aprovação (META_NOVA, REALIZACAO, MOVIMENTACAO_RH, etc.)
- **MovimentacaoRH** — Registro de admissão, promoção, transferência, desligamento

## Padrões de código

- **Funções de cálculo puras** em `calc.ts` — testáveis isoladamente
- **`Promise.all`** para queries paralelas no dashboard
- **Upsert** nas realizações (cria ou atualiza pelo mês/ano/meta)
- **Soft delete** em colaboradores (`ativo = false`)
- **Auditoria** via `MetaHistorico` (campo, valor anterior/novo, usuário, timestamp)
- Formatação monetária BR: `"8.000,50"` → `8000.50` no import
- Testes em `__tests__/` com Vitest — não usar mocks no banco de dados

## Atenção

- `page.tsx` é muito grande (~3000 linhas). Preferir editar componentes filhos quando possível.
- O Prisma usa `driverAdapters` (preview feature) — necessário para LibSQL.
- O arquivo `dev.db` é o banco SQLite local. Não commitar alterações nele.
- `app/generated/prisma/` é gerado automaticamente — não editar manualmente.
