# Code Conventions

## TypeScript & Code Style

- **Strict mode enabled** in `tsconfig.json` — all type annotations required
- **Functional components** — React 19 uses functional components exclusively with hooks
- **No external state libraries** — only `useState`, `useEffect`, `useCallback` for state management
- **Explicit return types** on all functions (except inline arrow functions in some cases)
- **Immutable patterns** — use spread operators and array methods rather than mutations

## Naming Conventions

### PascalCase
- **React components** — `CockpitColaborador.tsx`, `PainelGestor.tsx`, `MasterDashboard.tsx`
- **Types/Interfaces** — `ScorecardMeta`, `ScorecardData`, `CheckResult`, `MetaHistorico`
- **Models** (Prisma) — `Colaborador`, `CicloICP`, `Indicador`, `JanelaApuracao`

### camelCase
- **Functions** — `calcularNota()`, `calcularPremio()`, `normalizarLinhaColaborador()`, `parseSalario()`
- **Variables & properties** — `salarioBase`, `dataAdmissao`, `metaAlvo`, `valorRealizado`
- **API routes** — `/api/ciclos`, `/api/metas`, `/api/realizacoes` (kebab-case in URLs)

### SCREAMING_SNAKE_CASE
- **Enum-like constants** — `MAIOR_MELHOR`, `MENOR_MELHOR`, `PROJETO_MARCO`, `VOLUME_FINANCEIRO`
- **Database statuses** — `DRAFT`, `ATIVO`, `APROVADO`, `ENCERRADO`, `CANCELADO`

## API Response Format

All API responses follow a consistent envelope pattern:

### Success Response
```typescript
// Single resource
NextResponse.json({ data: resource }, { status: 200 })

// Array of resources
NextResponse.json({ data: [resource1, resource2] })

// Example from /api/scorecard
return NextResponse.json({ data: scorecardData });
```

### Error Response
```typescript
// Standard error format
NextResponse.json({ error: "Human-readable error message" }, { status: statusCode })

// Examples
{ error: "Campo 'matricula' obrigatorio" }
{ error: "Meta nao encontrada" }
{ error: "Janela de apuracao fechada. Solicite prorrogacao." }
{ error: String(err) }  // For caught exceptions
```

### Status Codes
- **200**: Success (GET, successful POST/PUT/DELETE)
- **201**: Resource created (POST returning new resource)
- **400**: Bad request (validation errors, missing fields)
- **403**: Forbidden (cycle phase blocks operation, janela closed)
- **404**: Not found
- **500**: Server error (caught exceptions)

## Error Handling

### Frontend
```typescript
// Fetch with error handling
fetch('/api/endpoint')
  .then((r) => r.json())
  .then((r) => { if (r.data) setData(r.data); })
  .catch(console.error)
  .finally(() => setLoading(false));
```

### Backend (API Routes)
```typescript
// Try-catch with try/response pattern
try {
  const body = await req.json();
  const result = await prisma.model.findUnique(...);
  if (!result) return NextResponse.json({ error: "Recurso nao encontrado" }, { status: 404 });
  return NextResponse.json({ data: result });
} catch (err) {
  return NextResponse.json({ error: String(err) }, { status: 500 });
}
```

### Validation Errors
Returns object with `erro` and `dados` fields:
```typescript
export function validarLinhaColaborador(raw: Record<string, unknown>): {
  erro: string | null;
  dados: ColaboradorRow;
} {
  if (!r.matricula) return { erro: "Campo 'matricula' obrigatorio", dados: r as ColaboradorRow };
  return { erro: null, dados: r as ColaboradorRow };
}
```

## Brazilian Number Formatting

Handles both Brazilian (8.000,50) and international (8000.50) formats:

### Input Format Conversion
```typescript
export function parseSalario(raw: string | null | undefined): number {
  if (raw == null) return 0;
  // "8.000,50" → 8000.50
  const normalised = raw
    .trim()
    .replace(/\.(?=\d{3}(?:[,.]|$))/g, "")  // Remove thousand-sep dots
    .replace(",", ".");                       // Swap decimal comma
  return Number(normalised) || 0;
}
```

### Display Format
```typescript
function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { 
    style: "currency", 
    currency: "BRL", 
    maximumFractionDigits: 0 
  }).format(v);
}
```

Imported CSV rows with "8.000,50" are parsed to 8000.50 internally, formatted as "R$ 8.000" on display.

## Import Patterns

### Absolute imports
```typescript
// Preferred — use @ alias
import { calcularNota } from "@/app/lib/calc";
import { prisma } from "@/app/lib/prisma";
import CockpitColaborador from "@/components/CockpitColaborador";

// Next.js server-side
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../generated/prisma";
```

### React/UI imports
```typescript
import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
```

## State Management

### Hook-based pattern (No Redux/Zustand)
```typescript
const [data, setData] = useState<ScorecardData | null>(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (!colaboradorId || !cicloId) return;
  setLoading(true);
  fetch(`/api/scorecard?colaboradorId=${colaboradorId}&cicloId=${cicloId}`)
    .then((r) => r.json())
    .then((r) => { if (r.data) setData(r.data); })
    .finally(() => setLoading(false));
}, [colaboradorId, cicloId]);
```

### Callbacks for expensive operations
```typescript
const handleFetchMetaDetails = useCallback(async (metaId: number) => {
  setLoadingMeta(true);
  try {
    const res = await fetch(`/api/metas/${metaId}`);
    const json = await res.json();
    setMetaDetails(json.data);
  } finally {
    setLoadingMeta(false);
  }
}, []);
```

## Tailwind CSS 4 Usage

### Design Tokens (CSS Variables in globals.css)
```css
:root {
  --ink:           #0f172a;
  --ink-secondary: #475569;
  --canvas:        #eef0f3;
  --surface:       #ffffff;
  --nav-bg:        #0e1b2e;
  --accent:        #1e40af;
  --ok-bg:    #ecfdf5;  --ok-text:    #065f46;
  --warn-bg:  #fffbeb; --warn-text:  #92400e;
  --err-bg:   #fef2f2; --err-text:   #991b1b;
}
```

### Component Styling Pattern
```typescript
// Inline with CSS variable fallbacks
<div className="rounded-xl p-5 text-white" style={{ background: "var(--nav-bg)" }}>

// Tailwind utility classes for layout
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  <div className="bg-white p-5 rounded-lg shadow-sm">
```

### Color usage
```typescript
// Semantic colors for status
style={{ backgroundColor: notaCor(nota) }}

function notaCor(nota: number) {
  if (nota >= 100) return "#10b981";   // Green
  if (nota >= 70) return "#f59e0b";    // Amber
  return "#ef4444";                     // Red
}
```

## Prisma Patterns

### Upsert Pattern (Create or Update)
```typescript
const empresa = await prisma.empresa.upsert({
  where: { codigo: "EMP001" },
  update: {},  // No changes on update
  create: { codigo: "EMP001", nome: "Empresa Demo" },
});
```

### Soft Deletes
- **Field**: `ativo: Boolean @default(true)` on applicable models
- **Pattern**: Query with `where: { ativo: true }` to exclude soft-deleted records
- **Deprecation**: Instead of `DELETE`, set `ativo = false`

```typescript
// Soft delete a colaborador
await prisma.colaborador.update({
  where: { id: colaboradorId },
  data: { ativo: false },
});

// Query only active
const colabs = await prisma.colaborador.findMany({
  where: { ativo: true },
});
```

### Audit Trail via MetaHistorico
```typescript
// Automatically track meta changes
await prisma.metaHistorico.create({
  data: {
    metaId: meta.id,
    campo: "metaAlvo",
    valorAntes: String(oldValue),
    valorDepois: String(newValue),
    usuario: req.user?.email,
    criadoEm: new Date(),
  },
});
```

### Parallel Queries with Promise.all
```typescript
// Fetch dashboard data in parallel
const [topPerformers, alertas, janelaAtual] = await Promise.all([
  prisma.realizacao.findMany({ ... }),
  prisma.workflowItem.findMany({ ... }),
  prisma.janelaApuracao.findFirst({ ... }),
]);
```

## Comments & Documentation

### When to Comment
- **Complex business logic** — explain the "why", not the "what"
- **Non-obvious algorithms** — e.g., nota calculation with caps
- **Public APIs** — JSDoc for exported functions
- **Edge cases** — null checks, type coercions

### When NOT to Comment
- Self-explanatory code (variable names are clear)
- Simple CRUD operations
- Standard React patterns

### Comment Style
```typescript
// Inline comments — single line with // prefix
// ─── Section dividers ─────────────────────────────
// Separates major logical blocks with visible divider

/**
 * Pure business-logic function for nota calculation.
 * Extracted here so they can be tested independently of framework / DB.
 */
export function calcularNota(...) { ... }
```

### Examples from codebase
```typescript
// From calc.ts:
// ── Nota calculation ─────────────────────────────────────────────────────────

export function calcularNota(
  tipo: string,
  polaridade: string,
  valorRealizado: number,
  metaAlvo: number,
  metaMinima: number | null,
  metaMaxima: number | null
): number {
  if (metaAlvo === 0) return 0;  // Avoid division by zero
  let nota = 0;

  if (tipo === "PROJETO_MARCO") {
    // Pass/fail: 100 if realizado >= 1 (true), else 0
    nota = valorRealizado >= 1 ? 100 : 0;
  } else if (polaridade === "MENOR_MELHOR") {
    // Ex: custo, prazo, defeitos — menor realizado = melhor nota
    nota = valorRealizado === 0 ? 120 : (metaAlvo / valorRealizado) * 100;
```

## File Organization

### Directory Structure
```
app/
├── app/
│   ├── api/               # API routes (one per resource)
│   ├── components/        # Shared React components
│   ├── lib/              # Pure functions (calc, validators, prisma)
│   ├── login/            # Auth page
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Main dashboard
│   └── globals.css       # Design tokens, Tailwind
├── __tests__/            # Vitest test files
└── prisma/
    └── schema.prisma     # Prisma data model
```

### One API Route per Resource
```
api/
├── ciclos/route.ts       # GET, POST, PUT for cycles
├── metas/route.ts        # GET, POST, PUT for goals
├── realizacoes/route.ts  # GET, POST for actuals
├── colaboradores/route.ts
└── ...
```

## TypeScript-Specific Patterns

### Union Types for Statuses
```typescript
type CycleStatus = "SETUP" | "ATIVO" | "ENCERRADO";
type MetaStatus = "DRAFT" | "ATIVO" | "APROVADO" | "CANCELADO";
type IndicatorType = "VOLUME_FINANCEIRO" | "CUSTO_PRAZO" | "PROJETO_MARCO";
```

### Nullable Relations
```typescript
interface Meta {
  parentMetaId: number | null;
  parentMeta: { id: number; indicador: { nome: string } } | null;
}

interface Realizacao {
  notaCalculada: number | null;
  premioProjetado: number | null;
}
```

### Type Inference
```typescript
// Infer from Prisma response
const ciclo = await prisma.cicloICP.findUnique({ ... });
// ciclo type is CicloICP | null
```

## Performance Considerations

- **Lazy API fetches** — Only fetch on component mount (useEffect with dependencies)
- **Parallel DB queries** — Use Promise.all for independent queries
- **Upsert instead of separate queries** — Single DB round-trip
- **Selective field includes** — Only include needed relations in Prisma queries

```typescript
// Good — only fetch what's needed
const ciclos = await prisma.cicloICP.findMany({
  include: {
    indicadores: { select: { id: true } },  // Only count
    metas: { select: { id: true } },
  },
  orderBy: { anoFiscal: "desc" },
});
```
