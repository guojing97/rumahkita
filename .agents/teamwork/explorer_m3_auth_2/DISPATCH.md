## 2026-10-27T14:30:40Z
[Message] timestamp=2026-10-27T14:30:40Z sender=c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb priority=MESSAGE_PRIORITY_HIGH content=You are Explorer 2 (Auth & Multi-tenancy Spec Miner) for Milestone 3: Backend API (NestJS REST API /api/v1).
Your working directory is `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_auth_2`.

MANDATORY FIRST STEP:
Read `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md` and `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md`.
Read the backend developer skill at `/Users/mac/.gemini/config/skills/backend-developer/SKILL.md`.
Inspect `packages/db/src/schema/auth.ts`, `packages/db/src/schema/household.ts`, and `packages/contracts/src/schemas/auth.ts`.
Inspect `tests/e2e/cases/` (especially tier 1 & 2 auth and tenant tests).

TASK:
Produce an exhaustive specification for Authentication and Multi-Tenancy in `apps/api/src/modules/auth/` and `household/`:
1. Authentication (`/api/v1/auth/`):
   - `POST /register`: creates user, hashes password with Argon2id (`@node-rs/argon2`), creates default household, links user as `owner`, returns tokens.
   - `POST /login`: authenticates email/password against Argon2id hash, issues JWT access token (15m expiration, payload `{ sub: userId, email }`), creates `refresh_sessions` record with token hash and family ID, sets HttpOnly secure cookie `refresh_token` (7d expiration), returns `{ user, accessToken, households }`.
   - `POST /refresh`: reads `refresh_token` cookie, verifies against `refresh_sessions`, rotates refresh token with family tracking (revoking whole family on token reuse detection), issues new access token and new cookie.
   - `POST /logout`: marks session `is_revoked = true` in `refresh_sessions`, clears cookie.
   - `GET /me`: returns current user profile and list of member households.
2. Multi-Tenancy & Guards:
   - `JwtAuthGuard`: validates JWT Bearer token on protected endpoints, attaches `user` to request.
   - `HouseholdGuard`: checks `X-Household-Id` header (or route param `:householdId`). Validates user is an active member in `household_members` for that household. Attaches `household: { id, role }` to `req.household`. If invalid or not a member, returns 403 Forbidden.
   - `RolesGuard` (`@Roles('owner')`): protects sensitive household operations (e.g., inviting members, deleting categories, updating household info).
3. Household Module (`/api/v1/households/`):
   - `GET /`: lists households for current user.
   - `POST /`: creates new household, sets user as owner.
   - `GET /:id`: retrieves household details.
   - `GET /:id/members`: lists members in household.
   - `POST /:id/invite` / `POST /:id/members`: adds member by email, sets role.

Write your specification to `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_auth_2/auth_spec.md`.
Communicate your completion back to the parent orchestrator via send_message. Do NOT implement application source code.
