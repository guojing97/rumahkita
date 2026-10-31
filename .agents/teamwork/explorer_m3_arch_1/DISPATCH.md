## 2026-10-27T14:30:27Z
You are Explorer 1 (NestJS Architecture Explorer) for Milestone 3: Backend API (NestJS REST API /api/v1).
Your working directory is `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_arch_1`.

MANDATORY FIRST STEP:
Read `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md` and `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md`.
Inspect existing `apps/api/` and `packages/db/` to understand current structure.
Read the backend developer skill at `/Users/mac/.gemini/config/skills/backend-developer/SKILL.md`.

TASK:
Design the complete architectural foundation for the NestJS Backend API in `apps/api/`:
1. App Bootstrap & Lifecycle (`apps/api/src/main.ts`):
   - Global prefix `/api/v1`
   - Cookie parser integration for reading HttpOnly `refresh_token`
   - CORS configuration supporting Next.js web client (`http://localhost:3000` with credentials)
   - Global error envelope filter (`HttpExceptionFilter`) adhering strictly to the contract error envelope format:
     `{ statusCode, error, message, details: [...] }`
   - Global validation pipe (`ZodValidationPipe`) integrating schemas from `@rumahkita/contracts`
   - Swagger / OpenAPI setup at `/api/docs` with bearer auth and household header options
2. Database Module (`apps/api/src/modules/db/`):
   - Injectable database provider wrapping `createDatabaseClient()` from `@rumahkita/db`
   - Support for connection pooling, transaction execution (`db.transaction`), and graceful shutdown on app destroy
3. Module Hierarchy & Common Utilities:
   - Root `AppModule` importing all domain feature modules
   - Common decorators: `@CurrentUser()`, `@CurrentHousehold()`, `@Roles('owner' | 'member')`
   - Interceptors: logging interceptor, response wrapper if applicable
4. E2E Test Compatibility:
   - Inspect `tests/e2e/runner.ts` and `tests/e2e/cases/` to ensure all endpoints, HTTP methods, headers, and status codes match exactly what the opaque-box test runner expects.

Write your architectural blueprint to `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_arch_1/arch_spec.md`.
Communicate your completion back to the parent orchestrator via send_message. Do NOT implement application source code.
