# Handoff Report: Authentication & Multi-Tenancy Specification Mining

**Date**: 2026-10-27T14:38:00Z  
**Agent**: Explorer 2 (`explorer_m3_auth_2`)  
**Mission**: Mine authoritative specifications for Authentication and Multi-Tenancy in `apps/api/src/modules/auth/` and `household/` for Milestone 3 (NestJS REST API `/api/v1`).  
**Handoff Type**: Hard (Task Complete)  

---

## 1. Observation

1. **Database Schema**:
   - `packages/db/src/schema/auth.ts:3-22`: `users` table defines `id` (uuid defaultRandom), `email` (varchar 255 unique), `passwordHash` (varchar 255 mapped to `password_hash`), `fullName` (varchar 100), `phoneNumber` (varchar 30 nullable), `isActive` (boolean default true).
   - `packages/db/src/schema/auth.ts:24-44`: `refreshSessions` table defines `id` (uuid), `userId` (uuid fk users.id cascade), `tokenHash` (varchar 255 unique index `refresh_sessions_token_hash_idx`), `familyId` (uuid index `refresh_sessions_family_id_idx`), `isRevoked` (boolean default false), `expiresAt` (timestamp with tz), `userAgent` (varchar 500), `ipAddress` (varchar 45).
   - `packages/db/src/schema/household.ts:4-36`: `householdRoleEnum` is `pgEnum('household_role', ['owner', 'member'])`. `households` table has `id`, `name`, `currency` (default 'IDR'), `timezone` (default 'Asia/Jakarta'). `householdMembers` table links `householdId` and `userId` with `role` and unique index `household_members_household_user_idx`.
   - `packages/db/src/seed.ts:88-103`: Seed file uses `@node-rs/argon2` with configuration: `memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`.

2. **Contracts & Validation Schemas**:
   - `packages/contracts/src/auth/auth.schema.ts:4-23`: `loginSchema` requires `{ email: emailSchema (trimmed/lowercased), password: min(8) }`. `registerSchema` requires `{ email, password: min(8), fullName: min(2).max(100), phoneNumber?: max(30) }`.
   - `packages/contracts/src/auth/auth.schema.ts:66-79`: `loginResponseSchema` specifies `{ accessToken: string, expiresIn: number, user: { id, email, fullName }, household: { id, name, role } }`.
   - `packages/contracts/src/common/api-response.ts:3-22`: Standard envelopes `ApiResponse<T>` (`{ success: boolean, data: T, message?: string }`) and `ApiErrorResponse` (`{ success: false, statusCode, error, message, errors?, timestamp?, path? }`).

3. **Opaque-Box E2E Tests**:
   - `tests/e2e/tier1-feature-coverage/auth.test.ts:12-28`: `T1.1` verifies `POST /auth/login` returns status 200, `res.body.data.accessToken`, user email, household id, and sets cookie named `refreshToken`.
   - `tests/e2e/tier1-feature-coverage/auth.test.ts:42-59`: `T1.3` verifies `POST /auth/refresh` reads `refreshToken` cookie, rotates it to a new value, and issues a new access token.
   - `tests/e2e/tier1-feature-coverage/auth.test.ts:61-76`: `T1.4` verifies `POST /auth/logout` revokes session so subsequent refresh fails with 401.
   - `tests/e2e/tier1-feature-coverage/auth.test.ts:78-85`: `T1.5` calls `POST /auth/logout-all`.
   - `tests/e2e/tier1-feature-coverage/auth.test.ts:87-95`: `T1.6` calls `POST /auth/password/forgot`.
   - `tests/e2e/tier1-feature-coverage/master-data.test.ts:11-20`: `T1.7` tests `GET /household` which returns `{ success: true, data: { id, members: [...] } }`.
   - `tests/e2e/tier2-boundary-corner/security-boundaries.test.ts:13-31`: `T2.14` and `T2.15` verify that unauthenticated or forged JWT requests to `/household` return 401 Unauthorized.
   - `tests/e2e/tier2-boundary-corner/security-boundaries.test.ts:62-95`: `T2.17` tests refresh token reuse detection: replaying an already rotated token `tokenV1` returns 401 and revokes the entire token family, causing subsequent refresh with `tokenV2` to also return 401.
   - `tests/e2e/tier3-cross-feature/cross-household-isolation.test.ts:17-61`: `T3.7` verifies cross-household requests to entities return 403 Forbidden or 404 Not Found.
   - `tests/e2e/tier4-scenarios/multi-member-collaboration.test.ts:14-34`: `T4.2` verifies two seeded users (Owner & Member) belong to the identical household and `GET /household` lists both users in `members`.

4. **Existing API App State**:
   - `apps/api/package.json:14-22`: currently has `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`, `@rumahkita/contracts`, `@rumahkita/db`. Dependencies `@node-rs/argon2`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `cookie-parser` need to be installed for implementation.
   - `apps/api/src/main.ts`: global prefix set to `api/v1`, CORS enabled, Swagger setup at `api/docs`. Does not yet initialize `cookie-parser`.

---

## 2. Logic Chain

1. From Observation 1 and 3, user passwords must be hashed using Argon2id with parameters `memoryCost: 65536, timeCost: 3, parallelism: 4` (`@node-rs/argon2`), matching the verified hash stored in seeds and validated by the backend-developer skill.
2. From Observation 1, `refresh_sessions` stores `token_hash` as a `varchar(255)` with a unique index. Because hashing high-entropy cryptographic strings is deterministic with SHA-256, storing the SHA-256 digest of the raw refresh token allows $O(1)$ unique lookups while preventing token theft from raw DB dumps.
3. From Observation 3 (`T2.17`), token rotation must track lineage via `family_id`. When a refresh token whose session has `is_revoked === true` is presented, all sessions with the same `family_id` must immediately be marked `is_revoked = true` and the request rejected with HTTP 401.
4. From Observation 3 (`T1.1`, `T1.3`, `T2.17`), the E2E tests specifically look for a cookie named `refreshToken` (`client.cookieJar.getCookie('refreshToken')`). The cookie attributes must be `HttpOnly; Path=/; SameSite=Lax; Max-Age=604800` (7 days), and the API should also accept `refresh_token` as fallback.
5. From Observation 1, 2, and 3 (`T1.7`, `T4.2`), the active household endpoint is queried at `GET /household`, and the multi-tenancy requirements also specify `/households` collection routes. Implementing the Household Module to serve both `/household` and `/households` provides complete alignment across PRD §10, user requirements, and E2E test suites.
6. From Observation 3 (`T2.16`, `T3.7`), multi-tenancy requires strict verification of membership in `household_members`. A `HouseholdGuard` must inspect the header `X-Household-Id`, route parameters, or single-household user fallback, and reject any cross-tenant request with HTTP 403 Forbidden. Privileged routes must be protected by `RolesGuard` checking for `role === 'owner'`.

---

## 3. Caveats

- In local development over plain HTTP (`http://localhost`), the cookie `Secure` flag should default to `false` or depend on `NODE_ENV === 'production'` to ensure cookies can be set during local testing and E2E runs without SSL.
- When a user belongs to multiple households and neither `X-Household-Id` nor a route param is provided, the API must either fall back to the user's primary/first household or return HTTP 400 Bad Request requesting disambiguation. For single-household users (the standard case), automatic resolution ensures seamless user experience.
- Password reset token delivery (email/SMS) is stubbed/mocked for MVP; the backend must handle token creation, validation, and session revocation.

---

## 4. Conclusion

An exhaustive specification for Authentication and Multi-Tenancy has been produced and saved to `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_auth_2/auth_spec.md`. It covers:
- Complete contracts, DTOs, and error envelopes for all auth endpoints (`register`, `login`, `refresh`, `logout`, `logout-all`, `me`, `forgot-password`, `reset-password`).
- Exact Argon2id parameters and SHA-256 token hashing strategy.
- Complete token reuse detection state machine and family revocation algorithm.
- Complete multi-tenant isolation guard pipeline (`JwtAuthGuard`, `HouseholdGuard`, `RolesGuard`).
- Complete household management API (`/household` and `/households/*`).
- Edge case catalog and HTTP status code mappings.

The specification provides everything needed for the backend developer agent to implement Milestone 3 auth cleanly and pass all E2E tests.

---

## 5. Verification Method

To independently verify the specification against the codebase:
1. Inspect the specification document:
   `cat /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_auth_2/auth_spec.md`
2. Confirm schema alignments:
   `view_file packages/db/src/schema/auth.ts`
   `view_file packages/db/src/schema/household.ts`
   `view_file packages/contracts/src/auth/auth.schema.ts`
3. Confirm test expectations:
   `view_file tests/e2e/tier1-feature-coverage/auth.test.ts`
   `view_file tests/e2e/tier2-boundary-corner/security-boundaries.test.ts`
4. Post-implementation verification commands (to be run after developer implements code):
   `node tests/e2e/runner.ts --tier 1 --pattern auth.test.ts`
   `node tests/e2e/runner.ts --tier 2 --pattern security-boundaries.test.ts`
   `node tests/e2e/runner.ts --tier 3 --pattern cross-household-isolation.test.ts`
   `node tests/e2e/runner.ts --tier 4 --pattern multi-member-collaboration.test.ts`
