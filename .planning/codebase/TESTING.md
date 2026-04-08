# Testing Guide

## Test Framework & Configuration

### Framework: Vitest
- **Version**: ^4.1.2
- **Environment**: Node.js
- **Runner**: `vitest run` (single execution), `vitest` (watch mode)

### Vitest Config (`vitest.config.ts`)
```typescript
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["app/lib/calc.ts"],  // Only calc.ts in coverage report
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

### Key Settings
- **globals: true** — `describe()`, `it()`, `expect()` available without imports
- **include pattern** — `**/__tests__/**/*.test.ts` — all test files in `__tests__/` directories
- **Coverage** — Tracks only `app/lib/calc.ts` (business logic focus)

## Test Execution

### Commands
```bash
# Single run (CI mode)
npm test

# Watch mode (development)
npm run test:watch

# With UI
npm run test:ui  # If @vitest/ui installed
```

## Test File Structure & Locations

### Directory Structure
```
app/
├── __tests__/
│   ├── calc.test.ts          # 206 lines
│   └── validators.test.ts    # 230 lines
```

### File Pattern
- **Name**: `[module].test.ts`
- **Location**: `__tests__/` at project root
- **Module under test**: Must be importable from same level as `__tests__/`

## What IS Tested

### 1. **calc.ts** (calc.test.ts)
Pure business-logic functions — 206 lines of tests covering:

#### calcularNota(tipo, polaridade, valorRealizado, metaAlvo, metaMinima, metaMaxima)
- **MAIOR_MELHOR strategy** (default, e.g., revenue)
  - realizado = alvo → nota 100
  - realizado > alvo without cap → capped at 120
  - realizado > alvo with metaMaxima → cap by max ratio
  - realizado < metaMinima → nota 0
  - realizado between min and alvo → proportional 0-100
  - Edge case: metaAlvo = 0 → returns 0 (avoid division)
  - Edge case: realizado < 0 → returns 0

- **MENOR_MELHOR strategy** (e.g., cost, defects)
  - realizado = alvo → nota 100
  - realizado < alvo (better) → nota > 100, capped at 120
  - realizado > alvo (worse) → nota < 100
  - realizado > metaMaxima → nota 0
  - Edge case: realizado = 0 → 120 (perfect, no cost)

- **PROJETO_MARCO strategy** (pass/fail milestone)
  - realizado >= 1 → 100 (delivered)
  - realizado = 0 → 0 (not delivered)
  - No additional 120% cap (binary scoring)

#### calcularPremio(salarioBase, targetMultiploSalarial, nota, pesoNaCesta)
Formula: `salario × multiplo × (nota/100) × (peso/100)`

Test coverage:
- Base formula with all factors at 100%
- Partial nota reduces prêmio proportionally
- Partial peso reduces prêmio proportionally
- Combined partial factors (nota 80%, peso 60%)
- nota = 0 → prêmio = 0
- salario = 0 → prêmio = 0
- nota > 100 (overachievement) → prêmio > target

#### normalizarLinhaColaborador(raw: Record<string, unknown>)
CSV import row normalization:
- Removes BOM (Byte Order Mark) from keys
- Trims whitespace from keys and values
- Converts null/undefined values to empty strings
- Preserves normal values intact

#### parseSalario(raw: string | null | undefined)
Parses Brazilian and international number formats:
- "8000.50" (international dot) → 8000.5
- "8000,50" (Brazilian comma) → 8000.5
- "8.000,50" (Brazilian format with thousands) → 8000.5
- "12.500" (integer with thousands) → 12500
- "" (empty string) → 0
- null/undefined → 0
- "abc" (non-numeric) → 0

### 2. **validators.ts** (validators.test.ts)
Input validation for bulk import rows — 230 lines of tests.

#### validarLinhaColaborador(raw: Record<string, unknown>)
Returns: `{ erro: string | null; dados: ColaboradorRow }`

Field validation:
- `matricula` required
- `nomeCompleto` required
- `salarioBase` non-negative, parses Brazilian format
- `dataAdmissao` valid ISO date (optional, defaults on validation pass)
- `email` regex match (optional, defaults on validation pass)

Edge cases:
- BOM + extra spaces normalized before validation
- Empty optional fields are valid (use defaults on API route)

#### validarLinhaMeta(raw: Record<string, string>)
Returns: `string | null` (error message or null if valid)

Field validation:
- `indicadorCodigo` required
- `metaAlvo` required, must be > 0, numeric
- `pesoNaCesta` optional (default 100), must be 0–100
- `metaMinima` if provided, must be < metaAlvo
- `metaMaxima` if provided, must be > metaAlvo
- `centroCustoCodigo` optional (meta can be corporate)

Edge cases:
- metaAlvo = 0 → error "maior que zero"
- metaMinima >= metaAlvo → error
- metaMaxima <= metaAlvo → error
- Both min/max absent → valid (nullable)

#### validarLinhaRealizacao(raw: { matricula?, metaCodigo?, codigo_indicador?, valorRealizado?, valor_realizado? })
Returns: `{ erro: string | null; dados: RealizacaoRow }`

Field validation:
- `matricula` required
- `metaCodigo` required (or alias `codigo_indicador`)
- `valorRealizado` required (or alias `valor_realizado`), numeric, >= 0
- Supports field aliases for legacy CSV formats

Edge cases:
- valorRealizado = 0 → valid (meta not achieved yet)
- Non-numeric valorRealizado → error
- Negative valorRealizado → error

## What IS NOT Tested

### Exclusions (by design, per CLAUDE.md)
1. **UI Components**
   - React component rendering
   - Event handlers in components
   - Tailwind styling

2. **API Routes**
   - HTTP request/response handling
   - Prisma queries in routes
   - Authentication/authorization

3. **Database Operations**
   - Prisma migrations
   - Data persistence
   - Query logic
   - **Explicit: No DB mocks per CLAUDE.md**

4. **End-to-End Flows**
   - Complete request → process → response cycles
   - Multi-step workflows

### Rationale
- **calc.ts & validators.ts** are pure functions — portable and easily testable
- **React components** benefit more from visual QA than unit tests
- **API routes** should be tested via integration tests (not in Vitest)
- **Prisma queries** change frequently; mock brittleness not worth it

## Test Patterns & Best Practices

### 1. Pure Function Tests
All tests in this codebase test pure functions (no side effects, no DB access).

```typescript
import { describe, it, expect } from "vitest";
import { calcularNota } from "../app/lib/calc";

describe("calcularNota — MAIOR_MELHOR", () => {
  const tipo = "VOLUME_FINANCEIRO";
  const pol = "MAIOR_MELHOR";

  it("realizado = alvo → nota 100", () => {
    expect(calcularNota(tipo, pol, 100, 100, null, null)).toBe(100);
  });

  it("realizado > alvo sem cap → nota proporcional capped em 120", () => {
    expect(calcularNota(tipo, pol, 130, 100, null, null)).toBe(120);
  });
});
```

### 2. No Database Mocks
Tests do NOT mock Prisma or the database. This keeps tests simple and focused on pure logic.

```typescript
// ✗ NOT done in this project
jest.mock("@/app/lib/prisma", () => ({ ... }));

// ✓ Only pure function tests
expect(calcularNota(100, 100, null, null)).toBe(100);
```

### 3. Describe Blocks Group by Concern
Each `describe()` groups tests for a single function or strategy.

```typescript
describe("calcularNota — MAIOR_MELHOR", () => { ... });
describe("calcularNota — MENOR_MELHOR", () => { ... });
describe("calcularNota — PROJETO_MARCO", () => { ... });
describe("calcularPremio", () => { ... });
describe("validarLinhaColaborador — campos obrigatórios", () => { ... });
```

### 4. Assertion Styles
```typescript
// Exact equality
expect(nota).toBe(100);

// Floating-point tolerance
expect(nota).toBeCloseTo(90);

// Comparisons
expect(nota).toBeGreaterThan(0);
expect(nota).toBeLessThan(100);

// Nullability
expect(erro).toBeNull();
expect(erro).toMatch(/matricula/i);  // Regex match on strings

// Truthiness
expect(Array.isArray(data)).toBe(true);
```

### 5. Test Data Setup
Use base objects and spread to avoid repetition:

```typescript
const base = {
  matricula: "M001",
  nomeCompleto: "João Silva",
  cpf: "123.456.789-00",
  email: "joao@empresa.com",
  salarioBase: "8000",
};

it("sem matricula → erro", () => {
  const { erro } = validarLinhaColaborador({ ...base, matricula: "" });
  expect(erro).toMatch(/matricula/i);
});
```

## Coverage Report

### Current Configuration
```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "lcov"],
  include: ["app/lib/calc.ts"],
}
```

### Coverage Gaps

#### calc.ts — Mostly Covered
- `calcularNota()` — all three strategies (MAIOR_MELHOR, MENOR_MELHOR, PROJETO_MARCO)
- `calcularPremio()` — all parameter combinations
- `normalizarLinhaColaborador()` — BOM removal, trimming, null handling
- `parseSalario()` — Brazilian format, edge cases

**Gap**: None identified — comprehensive test suite.

#### validators.ts — Partially Covered
- `validarLinhaColaborador()` — good coverage, all validations
- `validarLinhaMeta()` — good coverage, all constraints
- `validarLinhaRealizacao()` — good coverage, aliases and edge cases

**Gap**: None identified — comprehensive test suite.

#### Untested Modules (By Design)
- `janelas.ts` — window logic (no tests — integration concern)
- `auth.ts` — NextAuth config (no tests — auth framework)
- `prisma.ts` — client instantiation (no tests — no logic)
- API routes — no unit tests (integration tests would be needed)
- React components — no unit tests (visual QA instead)

## Running Tests in CI/CD

### Command
```bash
npm test
```

### Expected Output
```
✓ __tests__/calc.test.ts (52 tests)
✓ __tests__/validators.test.ts (65 tests)

Test Files  2 passed (2)
Tests      117 passed (117)

Coverage Summary
  app/lib/calc.ts        100%  lines, 100%  functions
```

### CI Integration
- Run `npm test` in GitHub Actions (or equivalent)
- Fail if any test fails
- Optional: Report coverage (lcov format available)

## Adding New Tests

### When to Add Tests
- ✓ New pure function in `calc.ts` or `validators.ts`
- ✓ Bug fix — add regression test first
- ✗ New React component (use visual QA instead)
- ✗ New API route (use integration tests instead)

### How to Add Tests
1. Create `__tests__/[module].test.ts` if not exists
2. Import the function and Vitest utilities
3. Use `describe()` for the function/strategy
4. Use `it()` for individual cases
5. Organize with section dividers

### Example
```typescript
import { describe, it, expect } from "vitest";
import { calcularNota } from "../app/lib/calc";

describe("calcularNota — NEW_STRATEGY", () => {
  it("edge case → expected result", () => {
    expect(calcularNota(...)).toBe(...);
  });
});
```

## Debugging Tests

### Watch Mode
```bash
npm run test:watch
```
Tests re-run on file changes. Press `p` to filter by filename, `t` to filter by test name.

### Print Debugging
```typescript
it("debug test", () => {
  const result = calcularNota(100, 100, null, null);
  console.log("Result:", result);  // Shows in terminal
  expect(result).toBe(100);
});
```

### UI Dashboard
```bash
npm run test:ui
```
Opens Vitest UI on http://localhost:51204 with interactive test results (if @vitest/ui installed).
