# ICP Codebase — Concerns & Risks

## Technical Debt

### Monolithic Component
- **`/app/app/page.tsx` (~2,198 lines)** — Main dashboard component contains all UI logic (tabs, forms, data fetching, filtering, state management) in a single file. This creates tight coupling and makes testing difficult.
  - Lines 1–50: Type definitions for 15+ interfaces
  - Lines 100+: Helper functions mixed with JSX
  - Multiple state variables across 2000+ lines of render logic
  - **Impact:** Hard to maintain, high cognitive load, difficult to refactor

### Large API Route Files
- **`/app/app/api/consistencia/route.ts` (401 lines)** — Monolithic consistency check endpoint with multiple validation loops and aggregations
- **`/app/app/api/seed/route.ts` (333 lines)** — Seed data creation with 100+ upsert statements in sequence
- **`/app/app/api/dashboard/route.ts` (145 lines)** — Dashboard aggregations and complex filtering logic

### Code Duplication
- **Import/validation logic** — Repeated in three separate import routes:
  - `/app/app/api/import-colaboradores/route.ts` (208 lines)
  - `/app/app/api/import-indicadores/route.ts` (114 lines)
  - `/app/app/api/import-metas/route.ts` (109 lines)
  - Each route duplicates: CSV parsing, entity lookup maps, upsert patterns, error handling
- **Calculation logic** — `calcularNota()` and `calcularPremio()` in `/app/app/lib/calc.ts` are duplicated across:
  - `/app/app/api/realizacoes/route.ts`
  - `/app/app/api/bulk-import/route.ts`
  - Dashboard calculations in `/app/app/page.tsx`

### Missing Comments & Documentation
- No JSDoc comments on complex functions (e.g., `calcularNota()`, `calcularPremio()`)
- Schema relationships unclear for foreign key constraints
- No inline documentation for business logic (e.g., MENOR_MELHOR vs MAIOR_MELHOR calculation differences)

### No TODO/FIXME Comments Found
- Clean codebase in this regard, but high-risk areas lack explicit TODO markers:
  - Line 230 in page.tsx has destructive `confirm()` dialog but no warning comment about data loss

---

## Security Concerns

### Default Credentials Hardcoded
- **`.env` file (lines 4–6):**
  ```
  AUTH_SECRET=icp_change_this_in_production_now
  AUTH_USERNAME=admin
  AUTH_PASSWORD=admin
  ```
  - `AUTH_SECRET` contains placeholder text indicating it's for development only
  - `AUTH_USERNAME` and `AUTH_PASSWORD` are weak defaults (`admin`/`admin`)
  - No `.env.example` file provided — developers may assume these defaults are secure
  - **Risk:** If `.env` is exposed in production, attackers have immediate access

### Authentication Middleware Gaps
- **Most API routes lack auth checks:**
  - `/app/app/api/metas/route.ts` (GET/POST) — No `auth()` call, publicly accessible
  - `/app/app/api/colaboradores/route.ts` — No auth middleware
  - `/app/app/api/metas/historico/route.ts` — Unprotected history access
  - `/app/app/api/seed/route.ts` (POST) — Exposes seed endpoint; can reset entire database without auth
  - `/app/app/api/reset/route.ts` (POST) — Dangerous destruction endpoint with no auth check
- **Only NextAuth route protected:** `/app/app/api/auth/[...nextauth]/route.ts`
- **Pattern:** None of the 25 API routes call `const session = await auth()` to enforce authentication

### Credential Provider Security (auth.ts, lines 12–26)
- **Hardcoded comparison:** `credentials?.username === authUsername && credentials?.password === authPassword`
  - No password hashing (plain text comparison)
  - No rate limiting on failed login attempts
  - No account lockout after N failures
  - Vulnerable to brute force attacks

### Single Hardcoded User
- Auth system authenticates one user (admin) and assigns role `GUARDIAO` (line 23, `auth.ts`)
- No real user database or user management system
- Role-based access control exists in schema (User.role field) but not enforced in routes

### Data Exposure
- **Sensitive fields returned in API responses without filtering:**
  - Salary data (`salarioBase`) exposed in `/api/colaboradores`
  - CPF (personal ID) exposed in import responses
  - No field-level authorization checks
- **MetaHistorico audit trail** (schema line 151–160) — No access control; any authenticated user can view all change history

### Input Validation Gaps
- **No parametrized queries concern (Prisma handles this)** — But input validation is minimal:
  - `/app/app/api/metas/route.ts` — Accepts `cicloId` from query string without type validation before `Number(cicloId)`
  - `/app/app/api/bulk-import/route.ts` — Trusts `mesReferencia` and `anoReferencia` from request body without range checks
- **Email validation is weak** (validators.ts, line 46):
  ```typescript
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)
  ```
  Regex doesn't validate many invalid emails; missing RFC 5322 compliance

### Workflow Approval Bypasses
- **No approval enforcement on critical operations:**
  - Metas can be created and immediately used in calculations (status: DRAFT)
  - Realizações can be submitted and approved in same request
  - `/api/workflow` endpoint exists (115 lines) but unclear if it gates operations

---

## Performance Concerns

### N+1 Query Risks
- **`/api/bulk-import/route.ts` (lines 29–80):** Loop over each row and query database per row:
  ```typescript
  for (const row of rows) {
    const colaborador = await prisma.colaborador.findUnique(...);
    const indicador = await prisma.indicador.findFirst(...);
    const meta = await prisma.meta.findFirst(...);
    // Creates O(n) database queries
  }
  ```
  - 1000 rows = 3000+ sequential queries
  - Should use bulk operations or pre-load and map in memory

- **`/api/consistencia/route.ts`:** Multiple sequential queries without parallelization:
  - Line 23: `findMany` for ciclos
  - Line 58: `findUnique` for target ciclo
  - Line 67: `aggregate` for bonus pool
  - Line 103+: Multiple `findMany` loops with nested queries
  - Should use `Promise.all()` for parallel queries

### Missing Database Indexes
- **Schema has no `@@index` directives:**
  - No index on `Meta.cicloId` (filtered in most reads)
  - No index on `Realizacao.mesReferencia` + `anoReferencia` (monthly lookups)
  - No index on `Colaborador.cargoId`, `Colaborador.centroCustoId` (frequent filters)
  - No index on `WorkflowItem.metaId`, `WorkflowItem.realizacaoId`
  - **Impact:** Full table scans on large datasets; O(n) query time

### Large Component Re-renders
- **`page.tsx` (2,198 lines):** Single `useState` for entire dashboard state
  - All tab switches trigger full component re-render
  - No memoization (React.memo) on subcomponents (CockpitColaborador, PainelGestor, MasterDashboard)
  - No lazy loading of tabs — all data fetched on mount
  - **Impact:** Slow initial load, sluggish UX on low-end devices

### No Caching Layer
- **No Redis/in-memory cache** for expensive queries:
  - `calcularNota()` called repeatedly with same inputs
  - Dashboard aggregations recalculated every page load
  - Indicador/Meta lookup maps rebuilt on every import
- **No HTTP caching headers** — API responses have no `Cache-Control`, `ETag`, or `Last-Modified`

### Inefficient Calculations
- **`calc.ts` (decimal.js usage):** Multiple decimal conversions in loops
  - Bulk-import loops convert each valor to Decimal for calculation (high GC pressure)
  - No batch processing or vectorized operations
- **Unoptimized filters:** Multiple `where` conditions in Prisma findMany could benefit from indexed composite keys

---

## Reliability Concerns

### SQLite in Production Risk
- **Schema (line 8):** `datasource db { provider = "sqlite" }`
- **Known SQLite limitations:**
  - Single-file database (database-level locking)
  - No concurrent writes — second write blocks until first completes
  - No horizontal scaling (only single server)
  - No built-in replication or failover
  - Accidental deletion of `dev.db` file = total data loss
- **Better alternatives:** PostgreSQL, MySQL for production

### No Migration Strategy
- **No `prisma/migrations` directory** (confirmed by `find` command)
- **Using `db push`** (mentioned in CLAUDE.md, line 140) — not recommended for production:
  - `db push` auto-generates migrations without saving them to version control
  - Can't track schema changes in git
  - No rollback mechanism
  - **Correct approach:** Use `prisma migrate create` and commit migrations to git

### Error Handling Gaps
- **Generic error responses:**
  ```typescript
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
  ```
  - All errors return 500 (Prisma constraint violations, timeout, auth, etc.)
  - No error logging — errors are swallowed
  - Stack traces may leak to client if `String(err)` includes details
  - Soft errors (validation) should return 400, not 500

- **Missing error types in most routes:**
  - No `Prisma.PrismaClientKnownRequestError` handling for unique constraint violations
  - No timeout handling for long-running imports
  - No retry logic for transient failures

### No Logging/Monitoring
- **Zero logging infrastructure:**
  - No `console.log()` or logger library (e.g., Pino, Winston)
  - Bulk imports with 100+ errors have no audit trail
  - Workflow approvals/rejections not logged
  - No request/response logging for debugging
- **No observability:**
  - No error tracking (Sentry, LogRocket)
  - No performance monitoring (APM)
  - No alerting on failed imports or database issues

### No Graceful Degradation
- **Dashboard fails if single API call times out:**
  - `page.tsx` calls multiple APIs in parallel but no timeout handling
  - No fallback UI if data fetch fails
  - No offline mode or stale data usage

### Unhandled Promise Rejections
- **Async functions without error boundaries:**
  - Many API routes use `try/catch` at top level only
  - Nested promise chains may silently fail
  - Example: `/api/import-colaboradores/route.ts` line 100+ doesn't validate promise resolution

---

## Missing Features / Gaps

### No CI/CD Pipeline
- **No `.github/workflows/`, `.gitlab-ci.yml`, or similar**
- **Missing automation:**
  - No automatic tests on push (Vitest only runs locally)
  - No type checking in CI (`tsc --noEmit` not run)
  - No linting checks (no ESLint config found)
  - No automated security scanning (e.g., Snyk, npm audit)
  - No staging deployment
  - Releases are manual

### No Rate Limiting
- **APIs accept unlimited requests:**
  - Bulk-import endpoint can be called with 100k rows
  - Seed endpoint can be called repeatedly
  - No request throttling or quota per user
  - Vulnerable to DoS attacks

### No API Documentation
- **No OpenAPI/Swagger schema** for 25 API routes
- **No endpoint documentation:**
  - No request/response examples
  - No authentication requirements documented
  - No rate limit information
  - Clients must reverse-engineer from frontend code

### Incomplete Test Coverage
- **Only 2 test files in `__tests__/`:**
  - `calc.test.ts` (7,364 bytes)
  - `validators.test.ts` (7,440 bytes)
- **Missing tests:**
  - No API route tests (25 routes untested)
  - No component tests (MasterDashboard, PainelGestor, CockpitColaborador)
  - No end-to-end tests
  - No auth/security tests
  - No integration tests for Prisma queries

### No Deployment Configuration
- **No `docker-compose.yml` or Dockerfile**
- **No environment configs** for dev/staging/prod
- **No health check endpoint**
- **No readiness/liveness probes** for Kubernetes

### No Audit Trail for Sensitive Operations
- **MetaHistorico exists but unused:**
  - No calls to create audit records when metas are modified
  - Workflow item changes not logged
  - Bonus calculations not auditable (no history of changes to pool or rates)

### Missing Data Validation Rules
- **No business rule validation:**
  - No check that meta weights sum to 100% per ciclo
  - No validation that realizações don't exceed 999% of target
  - No check that employee doesn't have conflicting metas (duplicate indicators)
  - No validation that janela dates make sense (start < end)

### No Soft Delete Strategy
- **Colaborador has `ativo` boolean** but most queries don't filter by `ativo = true`
- **No universal soft delete middleware** — each endpoint must remember to add `where: { ativo: true }`
- **Risk:** Deleted employees still appear in aggregations if filter missed

### No Transaction Management
- **Multi-step operations not atomic:**
  - Bulk-import creates realizações but doesn't rollback if calculation fails midway
  - No explicit transaction wrapping in Prisma operations
  - Data could be partially written if process crashes

---

## Summary Table

| Category | Severity | Count | Top Issue |
|----------|----------|-------|-----------|
| Technical Debt | Medium | 4 | 2K-line monolithic page.tsx |
| Security | High | 7 | Unprotected API routes, default creds in .env |
| Performance | Medium | 5 | N+1 queries in bulk-import, missing indexes |
| Reliability | High | 4 | SQLite in production, no migrations, no logging |
| Features | Medium | 6 | No CI/CD, rate limiting, or API docs |

---

## Recommended Priorities

1. **Immediate (Security):** Add auth middleware to all API routes; remove default credentials from .env
2. **High (Reliability):** Add logging and error handling; migrate from SQLite to PostgreSQL
3. **High (Reliability):** Set up Prisma migrations and version control
4. **Medium (Performance):** Add database indexes; refactor N+1 queries
5. **Medium (Tech Debt):** Extract dashboard subcomponents from page.tsx
6. **Medium (Features):** Add CI/CD pipeline with automated tests
