# Technical Specification: Authentication & Multi-Tenancy Architecture
**Project**: RumahKita MVP  
**Milestone**: M3 — Backend API (`apps/api` NestJS REST API `/api/v1`)  
**Scope**: Authentication Subsystem (`apps/api/src/modules/auth/`), Multi-Tenancy & Guards (`apps/api/src/common/guards/`), and Household Module (`apps/api/src/modules/household/`)  
**Author**: Explorer 2 (Auth & Multi-Tenancy Spec Miner)  
**Status**: Authoritative Technical Specification  

---

## 1. Executive Summary & Specification Sources

This document provides the exhaustive specification for implementing Authentication, Session Management, Multi-Tenant Data Isolation, and Household Membership in the RumahKita NestJS backend (`/api/v1`).

### Authoritative Specification Sources:
1. **User Request & PRD**:
   - `ORIGINAL_REQUEST.md` (§R3, Acceptance Criteria)
   - `doc/prd.md` (§6.1, §9, §10, §11 Non-Functional Security & Performance Requirements)
2. **Database Schemas & Relations**:
   - `packages/db/src/schema/auth.ts` (`users`, `refresh_sessions`)
   - `packages/db/src/schema/household.ts` (`households`, `household_members`, `householdRoleEnum`)
   - `packages/db/src/schema/relations.ts`
   - `packages/db/src/seed.ts` (Deterministic test users, Argon2id hashing parameters)
3. **Shared Contracts & DTOs**:
   - `packages/contracts/src/auth/auth.schema.ts`
   - `packages/contracts/src/common/api-response.ts`
   - `packages/contracts/src/common/enums.ts`
4. **Opaque-Box E2E Test Suites**:
   - `tests/e2e/tier1-feature-coverage/auth.test.ts` (T1.1 - T1.6)
   - `tests/e2e/tier1-feature-coverage/master-data.test.ts` (T1.7)
   - `tests/e2e/tier2-boundary-corner/security-boundaries.test.ts` (T2.14 - T2.17)
   - `tests/e2e/tier3-cross-feature/cross-household-isolation.test.ts` (T3.7)
   - `tests/e2e/tier4-scenarios/multi-member-collaboration.test.ts` (T4.2)
   - `tests/e2e/client/auth-helper.ts` & `api-client.ts`
5. **Backend Developer Engineering Skill**:
   - `/Users/mac/.gemini/config/skills/backend-developer/SKILL.md` (Clean Architecture, Dual-Token Pattern, OWASP Top 10, Concurrency & Transactions, Defensive Error Handling).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth | User Registration (`POST /auth/register`) | Creates new user account, hashes password using Argon2id, atomically provisions default household, assigns user as `owner`, creates session, sets refresh cookie, returns tokens | `RegisterInput` (`email`, `password`, `fullName`, optional `phoneNumber`) | `201 Created` with `ApiResponse<LoginResponse>` + Set-Cookie `refreshToken` | `422 Unprocessable` on invalid email/password length; `409 Conflict` if email already registered | Dispatch prompt & `packages/contracts/src/auth/auth.schema.ts` |
| 2 | Auth | User Login (`POST /auth/login`) | Authenticates email and password against Argon2id hash, issues 15-minute JWT access token, creates `refresh_sessions` record, sets 7-day HttpOnly cookie `refreshToken`, returns access token and user/household info | `LoginInput` (`email`, `password`) | `200 OK` with `ApiResponse<LoginResponse>` + Set-Cookie `refreshToken` | `401 Unauthorized` on wrong credentials; `422 Unprocessable` on invalid format | PRD §10, E2E `auth.test.ts` T1.1, T1.2 |
| 3 | Auth | Token Refresh (`POST /auth/refresh`) | Validates refresh token from HttpOnly cookie against `refresh_sessions`, rotates refresh token to a new value within same token family, revokes old token, returns new 15-minute access token | Cookie `refreshToken` (fallback `refresh_token`) | `200 OK` with `ApiResponse<TokenResponse>` + Set-Cookie `refreshToken` (rotated) | `401 Unauthorized` if cookie missing, expired, or invalid | PRD §10, E2E `auth.test.ts` T1.3 |
| 4 | Auth | Token Reuse Detection & Revocation | Detects re-use of an already revoked/rotated refresh token. Triggers immediate security defense by invalidating the entire token family (`family_id`), clearing cookie | Replayed/old cookie `refreshToken` | `401 Unauthorized` | `401 Unauthorized`; revokes all sessions belonging to the compromised `family_id` | PRD §11, E2E `security-boundaries.test.ts` T2.17 |
| 5 | Auth | User Logout (`POST /auth/logout`) | Revokes the current active refresh session (`is_revoked = true`) in `refresh_sessions` and clears the `refreshToken` cookie | Cookie `refreshToken` | `200 OK` with `ApiResponse<null>` + Clear-Cookie | Subsequent refresh with same token returns `401 Unauthorized` | PRD §10, E2E `auth.test.ts` T1.4 |
| 6 | Auth | Logout All Sessions (`POST /auth/logout-all`) | Revokes all active refresh sessions for the authenticated user across all devices/browsers, clears client cookie | Authenticated User (`req.user.id`) + Cookie | `200 OK` with `ApiResponse<null>` + Clear-Cookie | `401 Unauthorized` if unauthenticated | PRD §10, E2E `auth.test.ts` T1.5 |
| 7 | Auth | Current User Profile (`GET /auth/me`) | Returns the authenticated user's profile details and list of affiliated households with their respective roles | Bearer Token in `Authorization` header | `200 OK` with `ApiResponse<{ user: UserProfile, households: HouseholdMemberSummary[] }>` | `401 Unauthorized` if token missing or invalid | Dispatch prompt & PRD §6.1 |
| 8 | Auth | Forgot Password (`POST /auth/password/forgot`) | Accepts email and triggers password recovery workflow. Must NOT leak user existence (enumeration prevention) | `ForgotPasswordInput` (`email`) | `200 OK` with generic success message `ApiResponse<null>` | `200 OK` even if email is not found in database; `422` on invalid email syntax | PRD §10, E2E `auth.test.ts` T1.6 |
| 9 | Auth | Reset Password (`POST /auth/password/reset`) | Validates reset token, hashes new password with Argon2id, updates user credentials, and revokes all active sessions | `ResetPasswordInput` (`token`, `newPassword`) | `200 OK` with `ApiResponse<null>` | `400 Bad Request` or `401 Unauthorized` if token invalid/expired; `422` if password < 8 chars | PRD §10, `packages/contracts/src/auth/auth.schema.ts` |
| 10 | Guard | JWT Authentication Guard (`JwtAuthGuard`) | Intercepts requests, validates Bearer JWT in `Authorization` header, decodes payload `{ sub, email }`, verifies user is active in DB, attaches `req.user` | `Authorization: Bearer <token>` | Passes to next handler with `req.user` decorated | `401 Unauthorized` if token missing, expired, or tampered | PRD §11, E2E `security-boundaries.test.ts` T2.14, T2.15 |
| 11 | Guard | Multi-Tenant Household Guard (`HouseholdGuard`) | Enforces tenant isolation. Resolves household ID from `X-Household-Id` header, route param (`:householdId` or `:id`), query param, or default single-tenant user household. Verifies active membership in `household_members`. Attaches `req.household` | `X-Household-Id` header / route param / default fallback | Passes to next handler with `req.household` (`{ id, role, name, currency, timezone }`) | `403 Forbidden` if user is not a member of the targeted household | PRD §4, §10, E2E `security-boundaries.test.ts` T2.16, T3.7 |
| 12 | Guard | Roles Guard (`RolesGuard` / `@Roles('owner')`) | Verifies that authenticated user has the necessary role (`owner` vs `member`) within the current household context for privileged operations | `@Roles('owner')` decorator on route + `req.household.role` | Passes to next handler if authorized | `403 Forbidden` if user role does not satisfy requirements (e.g., member attempting owner actions) | Dispatch prompt & PRD §4, §10 |
| 13 | Household | Current Household Profile (`GET /household`) | Singleton endpoint retrieving the active household profile and its list of members (email, fullName, role, joinedAt) | Bearer Token + active household context | `200 OK` with `ApiResponse<HouseholdWithMembers>` | `401 Unauthorized` if unauthenticated; `403 Forbidden` if not a member | PRD §10, E2E `master-data.test.ts` T1.7, `multi-member-collaboration.test.ts` T4.2 |
| 14 | Household | List User Households (`GET /households`) | Retrieves all households that the current authenticated user belongs to | Bearer Token | `200 OK` with `ApiResponse<HouseholdMemberSummary[]>` | `401 Unauthorized` | Dispatch prompt |
| 15 | Household | Create Household (`POST /households`) | Creates a new household entity and links the calling user as `owner` in `household_members` | `{ name: string, currency?: string, timezone?: string }` | `201 Created` with `ApiResponse<Household>` | `400 / 422` on validation error | Dispatch prompt |
| 16 | Household | Get Household Details (`GET /households/:id`) | Retrieves metadata of a specific household by UUID after validating membership | Route param `:id` | `200 OK` with `ApiResponse<Household>` | `403 Forbidden` or `404 Not Found` if user is not a member | Dispatch prompt |
| 17 | Household | Update Household Info (`PUT /households/:id` or `PUT /household`) | Updates household name, currency, or timezone. Restricted strictly to `owner` | Route param `:id` + `{ name, currency, timezone }` | `200 OK` with updated `ApiResponse<Household>` | `403 Forbidden` if calling user is `member` (not `owner`) | Dispatch prompt & PRD §4 |
| 18 | Household | List Household Members (`GET /households/:id/members`) | Retrieves all members belonging to the specified household, including user details and roles | Route param `:id` | `200 OK` with `ApiResponse<HouseholdMember[]>` | `403 Forbidden` if caller not member of household | Dispatch prompt |
| 19 | Household | Invite / Add Member (`POST /households/:id/invite` or `POST /households/:id/members`) | Adds an existing user by email to the household with specified role (`member` or `owner`). Restricted to `owner` | Route param `:id` + `{ email: string, role: 'owner' \| 'member' }` | `201 Created` with `ApiResponse<HouseholdMember>` | `403 Forbidden` if non-owner; `404 Not Found` if user doesn't exist; `409 Conflict` if already member | Dispatch prompt & `packages/contracts/src/auth/auth.schema.ts` |
| 20 | Household | Remove Member (`DELETE /households/:id/members/:memberId`) | Removes a user from the household. Restricted to `owner`. Prevents removing the sole remaining owner | Route param `:id`, `:memberId` | `200 OK` or `204 No Content` with `ApiResponse<null>` | `403 Forbidden` if caller is non-owner; `400 Bad Request` if attempting to remove sole owner | PRD §4 & OWASP Access Control |

---

## 3. Edge Cases

| # | Feature | Input / Scenario | Observed / Required Behavior |
|---|---------|------------------|------------------------------|
| 1 | `POST /auth/login` | Email provided with mixed uppercase and trailing spaces (`"  Budi@RumahKita.LOCAL  "`) | Preprocessor normalizes email via `trim().toLowerCase()`; authentication succeeds with status `200 OK`. |
| 2 | `POST /auth/login` | Account deactivated in database (`is_active = false`) | Returns `401 Unauthorized` with message `"Akun tidak aktif atau dinonaktifkan"` without leaking internal flags. |
| 3 | `POST /auth/login` | Invalid password or non-existent email | Returns identical `401 Unauthorized` (`"Email atau password salah"`) to prevent timing/enumeration attacks. |
| 4 | `POST /auth/register` | Duplicate registration attempt with existing email | Returns `409 Conflict` (or `422 Unprocessable`) with message `"Email sudah terdaftar"`. |
| 5 | `POST /auth/register` | Database error midway through creation (e.g., household insert fails) | Wrapped in PostgreSQL transaction (`db.transaction()`); cleanly rolls back user creation so no orphaned user is created. |
| 6 | `POST /auth/refresh` | Request without any cookie present | Returns `401 Unauthorized` with structured error envelope. |
| 7 | `POST /auth/refresh` | Tampered, expired, or non-existent refresh token string | Returns `401 Unauthorized`; client cookie is cleared via Set-Cookie `Max-Age=0`. |
| 8 | `POST /auth/refresh` | **Token Replay / Reuse**: Client presents `tokenV1` after it was already rotated to `tokenV2` | **Security Alert**: Detects `is_revoked = true` on existing session; revokes all sessions sharing that `family_id`; returns `401 Unauthorized`; subsequent attempts with `tokenV2` fail with `401`. |
| 9 | `POST /auth/refresh` | Parallel concurrent refresh requests with same token | Pessimistic locking / atomic update ensures first request succeeds and rotates; second concurrent request is recognized as duplicate/reused or gracefully synchronized. |
| 10 | `POST /auth/logout` | Called when cookie is missing or invalid | Still returns `200 OK` (idempotent logout) and sends Clear-Cookie header. |
| 11 | `POST /auth/logout-all`| User logs out from all devices | Sets `is_revoked = true` on all active sessions for `user_id`. All other browsers refresh attempts now return `401`. |
| 12 | `POST /auth/password/forgot` | Email does not exist in database | Returns `200 OK` with generic success message (`"Jika email terdaftar, instruksi reset password telah dikirim"`) to block account enumeration. |
| 13 | `JwtAuthGuard` | Forged or tampered signature (e.g., modified payload) | Returns `401 Unauthorized` (`"Token tidak valid"`). |
| 14 | `JwtAuthGuard` | Token expired (`exp` in the past) | Returns `401 Unauthorized` with specific error message (`"Token telah kedaluwarsa"`). |
| 15 | `HouseholdGuard` | Authenticated user attempts to access another household's data via ID (`/incomes/:id`, `/items/:id`, etc.) | Returns `403 Forbidden` (or `404 Not Found` if query filters by `household_id`) to prevent IDOR / cross-tenant leaks. |
| 16 | `HouseholdGuard` | User has exactly one household and does not send `X-Household-Id` header | Guard automatically resolves user's primary/default household from `household_members`; request proceeds smoothly. |
| 17 | `HouseholdGuard` | User has multiple households and does not send `X-Household-Id` header | If ambiguous and route requires tenant context, falls back to primary household (where role = owner or oldest membership) or returns `400 Bad Request` specifying `X-Household-Id` header is required. |
| 18 | `RolesGuard` | User with `member` role attempts to invite a new member (`POST /households/:id/invite`) | Returns `403 Forbidden` (`"Hanya owner yang berwenang melakukan tindakan ini"`). |
| 19 | `HouseholdModule` | Owner attempts to remove themselves while being the only owner of the household | Returns `400 Bad Request` (`"Tidak dapat menghapus satu-satunya pemilik rumah tangga"`). Must transfer ownership first. |
| 20 | `HouseholdModule` | Inviting an email that is already a member of the household | Returns `409 Conflict` (`"Pengguna sudah menjadi anggota rumah tangga ini"`). |

---

## 4. Cryptographic & Security Architecture

### 4.1 Argon2id Password Hashing Specification
In compliance with RFC 9106 and OWASP Password Storage Guidelines, all user passwords must be hashed using Argon2id via the native high-performance library `@node-rs/argon2`.

- **Algorithm**: Argon2id (`argon2id`)
- **Memory Cost (`memoryCost`)**: `65536` (64 MiB)
- **Time Cost / Iterations (`timeCost`)**: `3`
- **Parallelism (`parallelism`)**: `4` threads
- **Output Format**: Standard Modular Crypt Format (MCF):
  `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`
- **Verification Rule**: Verification must be constant-time via `@node-rs/argon2.verify(hash, password)`.

```typescript
// Reference implementation in apps/api
import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(plainText: string): Promise<string> {
  return hash(plainText, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hashString: string, plainText: string): Promise<boolean> {
  try {
    return await verify(hashString, plainText);
  } catch {
    return false;
  }
}
```

### 4.2 Dual-Token Architecture & Expirations
- **Access Token (JWT)**:
  - **Lifetime**: 15 minutes (`900` seconds).
  - **Algorithm**: HS256 (signed using `JWT_SECRET`).
  - **Payload Structure**:
    ```json
    {
      "sub": "00000000-0000-4000-a000-000000000011",
      "email": "budi@rumahkita.local",
      "iat": 1730000000,
      "exp": 1730000900
    }
    ```
  - **Delivery**: In JSON response body `{ accessToken, expiresIn: 900 }`. Web client places it in memory (or client HTTP state). Sent in `Authorization: Bearer <token>` on protected requests.
- **Refresh Token (Opaque String & DB Hash)**:
  - **Lifetime**: 7 days (`604800` seconds).
  - **Generation**: High-entropy 32-byte cryptographic random hex string (`crypto.randomBytes(32).toString('hex')`) or UUIDv4.
  - **Storage in PostgreSQL**: Raw refresh token is **NEVER** stored in the database. Only its deterministic SHA-256 digest is stored:
    `token_hash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')`
  - **Delivery**: Stored strictly in an `HttpOnly` cookie.

### 4.3 Cookie Configuration & Security Attributes
Cookies must adhere to OWASP Top 10 cookie security standards:
- **Cookie Name**: Primary `refreshToken` (with backward compatibility parser supporting `refresh_token` if received).
- **Attributes**:
  - `httpOnly: true` (Blocks access from JavaScript / XSS).
  - `secure: process.env.NODE_ENV === 'production'` (Transmitted only over HTTPS; false in local HTTP dev if needed).
  - `sameSite: 'lax'` (Provides defense against Cross-Site Request Forgery).
  - `path: '/'` (Available across all API calls).
  - `maxAge: 7 * 24 * 60 * 60 * 1000` (7 days in milliseconds).

```typescript
// Cookie Options Helper
export const REFRESH_COOKIE_NAME = 'refreshToken';

export function getRefreshCookieOptions(isProduction = process.env.NODE_ENV === 'production') {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  };
}
```

---

## 5. Token Family & Reuse Detection State Machine

To prevent Refresh Token Replay attacks, every user login creates a new **Token Family** identified by `family_id` (UUID). When a refresh token is used, it is rotated into a new token within the same `family_id`.

```text
Login
  │
  ├──> Creates Session S1 (family_id: F1, token_hash: H1, is_revoked: false)
  │    Returns cookie: Token T1
  │
Refresh with T1 (Legitimate User)
  │
  ├──> S1.is_revoked becomes TRUE
  ├──> Creates Session S2 (family_id: F1, token_hash: H2, is_revoked: false)
  │    Returns cookie: Token T2
  │
Replay Attack with T1 (Attacker / Compromised Client)
  │
  ├──> Finds S1 by H1 -> S1.is_revoked is ALREADY TRUE!
  ├──> REUSE ATTACK DETECTED!
  ├──> Security Action: UPDATE refresh_sessions SET is_revoked = true WHERE family_id = F1
  ├──> Clears client cookie
  └──> Returns 401 Unauthorized
  │
Subsequent Refresh with T2 (Victim)
  │
  ├──> Finds S2 -> S2.is_revoked is now TRUE (revoked during family purge)
  ├──> Returns 401 Unauthorized (Victim is forced to re-login)
```

### Rotation Algorithm Steps:
1. Extract `rawRefreshToken` from `req.cookies['refreshToken']` (or `req.cookies['refresh_token']`).
2. If missing -> throw `UnauthorizedException('Refresh token tidak ditemukan')`.
3. Compute `tokenHash = sha256(rawRefreshToken)`.
4. Query table `refresh_sessions` by `token_hash = tokenHash`.
5. If record does not exist:
   - Clear cookie and throw `UnauthorizedException('Sesi tidak valid')`.
6. If record exists and `is_revoked === true`:
   - **Reuse detected**: Execute `UPDATE refresh_sessions SET is_revoked = true WHERE family_id = session.family_id`.
   - Clear cookie and throw `UnauthorizedException('Terdeteksi penggunaan token tidak sah. Sesi dibatalkan.')`.
7. If record exists and `expires_at < new Date()`:
   - Mark `is_revoked = true`, clear cookie, and throw `UnauthorizedException('Sesi telah kedaluwarsa')`.
8. Verify user is still active in `users`:
   - If not active -> throw `UnauthorizedException('Akun tidak aktif')`.
9. In a transaction:
   - Update current session: `is_revoked = true`.
   - Generate new `newRefreshToken` string.
   - Insert new session into `refresh_sessions`:
     - `userId: session.userId`
     - `familyId: session.familyId` (Preserve lineage)
     - `tokenHash: sha256(newRefreshToken)`
     - `isRevoked: false`
     - `expiresAt: now + 7 days`
     - `userAgent: req.headers['user-agent']`
     - `ipAddress: req.ip`
10. Generate new JWT access token `{ sub: user.id, email: user.email }` with 15m expiration.
11. Set new cookie `refreshToken = newRefreshToken` with 7-day maxAge.
12. Return `{ success: true, data: { accessToken, expiresIn: 900 } }`.

---

## 6. Endpoints Specification: Authentication Subsystem (`/api/v1/auth/`)

### 6.1 `POST /api/v1/auth/register`
- **Description**: Registers a new user, hashes password with Argon2id, atomically creates user's default household (`"Keluarga " + fullName`), links user as `owner`, creates refresh session, sets cookie, returns access token.
- **Access**: Public.
- **Request Body**: `RegisterInput`
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "fullName": "Budi Santoso",
    "phoneNumber": "08123456789"
  }
  ```
- **Validation**:
  - `email`: valid email format, trimmed, lowercased.
  - `password`: min 8 characters.
  - `fullName`: min 2, max 100 characters.
  - `phoneNumber`: max 30 characters (optional).
- **Database Transaction Flow**:
  1. Check if `users` table already has user with `email`. If yes -> `409 Conflict` (`"Email sudah terdaftar"`).
  2. Hash password with Argon2id.
  3. `INSERT INTO users (email, password_hash, full_name, phone_number, is_active)` -> returns `user`.
  4. `INSERT INTO households (name, currency, timezone)` with values `('Keluarga ' + fullName, 'IDR', 'Asia/Jakarta')` -> returns `household`.
  5. `INSERT INTO household_members (household_id, user_id, role)` with values `(household.id, user.id, 'owner')`.
  6. Generate session & tokens.
- **Response**: `201 Created`
  - **Headers**: `Set-Cookie: refreshToken=<token>; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`
  - **Body**:
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "eyJhbGciOi...",
        "expiresIn": 900,
        "user": {
          "id": "c1f7a0b3-...",
          "email": "user@example.com",
          "fullName": "Budi Santoso"
        },
        "household": {
          "id": "d2e8b1c4-...",
          "name": "Keluarga Budi Santoso",
          "role": "owner"
        }
      },
      "message": "Registrasi berhasil"
    }
    ```

---

### 6.2 `POST /api/v1/auth/login`
- **Description**: Authenticates user credentials against Argon2id hash. On success, issues 15-min JWT access token, creates `refresh_sessions` record, sets 7-day `refreshToken` cookie, and returns user profile, active household, and list of households.
- **Access**: Public.
- **Request Body**: `LoginInput`
  ```json
  {
    "email": "budi@rumahkita.local",
    "password": "Password123!"
  }
  ```
- **Execution Flow**:
  1. Normalize email: `email.trim().toLowerCase()`.
  2. Find user in `users` by `email`. If not found -> `401 Unauthorized` (`"Email atau password salah"`).
  3. Check `user.isActive`. If `false` -> `401 Unauthorized` (`"Akun dinonaktifkan"`).
  4. Verify password: `await argon2.verify(user.passwordHash, password)`. If `false` -> `401 Unauthorized` (`"Email atau password salah"`).
  5. Fetch user's households by joining `household_members` with `households`.
     - Select primary household: first household found or where `role === 'owner'`.
     - If user has no household -> dynamically create default household and owner membership to maintain consistency.
  6. Generate JWT Access Token:
     - `payload: { sub: user.id, email: user.email }`
     - `expiresIn: 900`
  7. Generate 32-byte cryptographically random refresh token.
     - `familyId = randomUUID()`
     - `tokenHash = sha256(rawRefreshToken)`
     - Insert into `refresh_sessions`.
  8. Set `refreshToken` cookie on response.
- **Response**: `200 OK`
  - **Headers**: `Set-Cookie: refreshToken=<token>; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`
  - **Body**:
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "eyJhbGciOi...",
        "expiresIn": 900,
        "user": {
          "id": "00000000-0000-4000-a000-000000000011",
          "email": "budi@rumahkita.local",
          "fullName": "Budi Santoso"
        },
        "household": {
          "id": "00000000-0000-4000-a000-000000000001",
          "name": "Keluarga Cemara",
          "role": "owner"
        },
        "households": [
          {
            "id": "00000000-0000-4000-a000-000000000001",
            "name": "Keluarga Cemara",
            "role": "owner"
          }
        ]
      },
      "message": "Login berhasil"
    }
    ```

---

### 6.3 `POST /api/v1/auth/refresh`
- **Description**: Rotates refresh token and issues a new access token. Enforces token family reuse detection.
- **Access**: Public (Authenticated via Cookie).
- **Input**: Cookie `refreshToken` (or `refresh_token`).
- **Response**: `200 OK`
  - **Headers**: `Set-Cookie: refreshToken=<new_token>; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`
  - **Body**:
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "eyJhbGciOi...",
        "expiresIn": 900
      },
      "message": "Token berhasil diperbarui"
    }
    ```
- **Error Responses**:
  - `401 Unauthorized` if cookie is missing, invalid, expired, or if token reuse is detected.

---

### 6.4 `POST /api/v1/auth/logout`
- **Description**: Invalidates current refresh session (`is_revoked = true`) and clears client cookie.
- **Access**: Public / Authenticated.
- **Input**: Cookie `refreshToken`.
- **Response**: `200 OK`
  - **Headers**: `Set-Cookie: refreshToken=; Path=/; Max-Age=0; HttpOnly`
  - **Body**:
    ```json
    {
      "success": true,
      "data": null,
      "message": "Logout berhasil"
    }
    ```

---

### 6.5 `POST /api/v1/auth/logout-all`
- **Description**: Revokes all active refresh sessions for the current user across all devices.
- **Access**: Authenticated (`JwtAuthGuard`).
- **Response**: `200 OK`
  - **Headers**: `Set-Cookie: refreshToken=; Path=/; Max-Age=0; HttpOnly`
  - **Body**:
    ```json
    {
      "success": true,
      "data": null,
      "message": "Semua sesi berhasil diakhiri"
    }
    ```

---

### 6.6 `GET /api/v1/auth/me`
- **Description**: Retrieves authenticated user profile and all household memberships.
- **Access**: Authenticated (`JwtAuthGuard`).
- **Response**: `200 OK`
  - **Body**:
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "id": "00000000-0000-4000-a000-000000000011",
          "email": "budi@rumahkita.local",
          "fullName": "Budi Santoso",
          "phoneNumber": "08123456789",
          "isActive": true,
          "createdAt": "2026-10-27T00:00:00.000Z",
          "updatedAt": "2026-10-27T00:00:00.000Z"
        },
        "households": [
          {
            "id": "00000000-0000-4000-a000-000000000001",
            "name": "Keluarga Cemara",
            "currency": "IDR",
            "timezone": "Asia/Jakarta",
            "role": "owner",
            "joinedAt": "2026-10-27T00:00:00.000Z"
          }
        ]
      }
    }
    ```

---

### 6.7 `POST /api/v1/auth/password/forgot`
- **Description**: Initiates password reset flow. Does not leak account existence.
- **Access**: Public.
- **Request Body**:
  ```json
  {
    "email": "budi@rumahkita.local"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": null,
    "message": "Jika email terdaftar, tautan pemulihan kata sandi telah dikirim"
  }
  ```

---

### 6.8 `POST /api/v1/auth/password/reset`
- **Description**: Sets a new password using a verified reset token and revokes all active sessions.
- **Access**: Public.
- **Request Body**:
  ```json
  {
    "token": "reset_token_string",
    "newPassword": "NewPassword123!"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": null,
    "message": "Password berhasil diperbarui"
  }
  ```

---

## 7. Multi-Tenancy Architecture & Guard Enforcement

### 7.1 Multi-Tenancy Model
RumahKita utilizes a **Shared Database, Row-Level Tenant Isolation** architecture.
- Every business table (`incomes`, `expenses`, `items`, `stock_movements`, `purchases`, `debts_receivables`, `notification_events`, `audit_logs`) contains a mandatory foreign key:
  `household_id: uuid references households(id) on delete cascade`
- Every database query for tenant resources must include `where: eq(table.householdId, req.household.id)`.
- If an attacker attempts to fetch or manipulate a resource belonging to another household, the query will return no rows or the guard will intercept it, resulting in `403 Forbidden` or `404 Not Found`.

---

### 7.2 `JwtAuthGuard` Specification
- **Responsibilities**:
  1. Checks for `@Public()` decorator. If present, bypasses authentication.
  2. Extracts token from `Authorization: Bearer <token>`. If missing -> throws `UnauthorizedException('Token otentikasi tidak ditemukan')`.
  3. Verifies JWT signature using `JWT_SECRET`. If signature invalid -> throws `UnauthorizedException('Token tidak valid')`.
  4. Checks expiration (`exp`). If expired -> throws `UnauthorizedException('Token telah kedaluwarsa')`.
  5. Queries user from `users` where `id = payload.sub AND is_active = true`. If not found or inactive -> throws `UnauthorizedException('Pengguna tidak ditemukan atau tidak aktif')`.
  6. Attaches user to request: `req.user = { id: user.id, email: user.email, fullName: user.fullName }`.

---

### 7.3 `HouseholdGuard` Specification
The `HouseholdGuard` is a NestJS `CanActivate` guard running on all tenant-specific endpoints after `JwtAuthGuard`.

- **Resolution Precedence**:
  1. **Header**: `req.headers['x-household-id']`
  2. **Route Parameter**: `req.params.householdId` or `req.params.id` (when on household routes)
  3. **Query Parameter**: `req.query.householdId`
  4. **Single-Tenant Fallback**: If no explicit household ID was provided:
     - Query all `household_members` for `user_id = req.user.id`.
     - If user belongs to exactly one household -> automatically resolve that household!
     - If user belongs to multiple households and route requires tenant context -> throw `BadRequestException('Header X-Household-Id wajib disertakan')`.
     - If user belongs to 0 households -> throw `ForbiddenException('Pengguna tidak memiliki akses ke rumah tangga manapun')`.
- **Validation**:
  - Query `household_members` joined with `households` for `household_id = targetHouseholdId AND user_id = req.user.id`.
  - If no record is found -> throw `ForbiddenException('Akses ke data rumah tangga ini ditolak')`.
- **Decoration**:
  - Attaches tenant context to request:
    ```typescript
    req.household = {
      id: member.householdId,
      role: member.role, // 'owner' | 'member'
      name: household.name,
      currency: household.currency,
      timezone: household.timezone,
    };
    ```
- **Custom Decorator**: `@CurrentHousehold()` to inject `req.household` into controllers.

---

### 7.4 `RolesGuard` & `@Roles('owner')`
Certain household operations are privileged and restricted strictly to household owners:
- Inviting new members (`POST /households/:id/invite` or `POST /households/:id/members`)
- Removing members (`DELETE /households/:id/members/:memberId`)
- Updating household settings (`PUT /households/:id`)
- Deleting master data categories (e.g. `DELETE /expense-categories/:id`)

- **Implementation**:
  - Decorator `@Roles('owner')` sets metadata `ROLES_KEY = ['owner']`.
  - `RolesGuard` retrieves required roles via NestJS `Reflector`.
  - Compares `req.household.role` against required roles:
    ```typescript
    if (!requiredRoles.includes(req.household.role)) {
      throw new ForbiddenException('Hanya owner yang berwenang melakukan tindakan ini');
    }
    ```

---

## 8. Endpoints Specification: Household Module (`/api/v1/household/` & `/households/`)

To guarantee 100% compatibility with both PRD §10 (`GET /household`) and RESTful multi-household requirements (`/households/*`), the Household Module serves both paths.

### 8.1 `GET /api/v1/household` (Current Household Profile & Members)
- **Description**: Returns the active household profile, its currency, timezone, and complete member list. Used by E2E tests `T1.7` and `T4.2`.
- **Access**: Authenticated (`JwtAuthGuard` + `HouseholdGuard`).
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "id": "00000000-0000-4000-a000-000000000001",
      "name": "Keluarga Cemara",
      "currency": "IDR",
      "timezone": "Asia/Jakarta",
      "members": [
        {
          "id": "00000000-0000-4000-a000-000000000011",
          "email": "budi@rumahkita.local",
          "fullName": "Budi Santoso",
          "role": "owner",
          "joinedAt": "2026-10-27T00:00:00.000Z"
        },
        {
          "id": "00000000-0000-4000-a000-000000000012",
          "email": "ani@rumahkita.local",
          "fullName": "Ani Santoso",
          "role": "member",
          "joinedAt": "2026-10-27T00:00:00.000Z"
        }
      ]
    }
  }
  ```

---

### 8.2 `GET /api/v1/households`
- **Description**: Lists all households where current user is a member.
- **Access**: Authenticated (`JwtAuthGuard`).
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "00000000-0000-4000-a000-000000000001",
        "name": "Keluarga Cemara",
        "currency": "IDR",
        "timezone": "Asia/Jakarta",
        "role": "owner",
        "joinedAt": "2026-10-27T00:00:00.000Z"
      }
    ]
  }
  ```

---

### 8.3 `POST /api/v1/households`
- **Description**: Creates a new household and designates the caller as `owner`.
- **Access**: Authenticated (`JwtAuthGuard`).
- **Request Body**:
  ```json
  {
    "name": "Keluarga Santoso Baru",
    "currency": "IDR",
    "timezone": "Asia/Jakarta"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "id": "e3a1f9b2-...",
      "name": "Keluarga Santoso Baru",
      "currency": "IDR",
      "timezone": "Asia/Jakarta",
      "createdAt": "2026-10-27T14:30:00.000Z"
    },
    "message": "Rumah tangga berhasil dibuat"
  }
  ```

---

### 8.4 `GET /api/v1/households/:id`
- **Description**: Retrieves details of a specific household. Caller must be an active member.
- **Access**: Authenticated (`JwtAuthGuard` + `HouseholdGuard`).
- **Response**: `200 OK` with household data.
- **Error**: `403 Forbidden` if caller does not belong to household `:id`.

---

### 8.5 `PUT /api/v1/households/:id` or `PUT /api/v1/household`
- **Description**: Updates household name, currency, or timezone.
- **Access**: Authenticated (`JwtAuthGuard` + `HouseholdGuard` + `@Roles('owner')`).
- **Request Body**:
  ```json
  {
    "name": "Keluarga Cemara Bahagia",
    "currency": "IDR",
    "timezone": "Asia/Jakarta"
  }
  ```
- **Response**: `200 OK` with updated household object.
- **Error**: `403 Forbidden` if caller has `member` role.

---

### 8.6 `GET /api/v1/households/:id/members`
- **Description**: Lists all members of a household.
- **Access**: Authenticated (`JwtAuthGuard` + `HouseholdGuard`).
- **Response**: `200 OK` with array of member items (user profile + role + joinedAt).

---

### 8.7 `POST /api/v1/households/:id/invite` or `POST /api/v1/households/:id/members`
- **Description**: Adds or invites a user to the household by email.
- **Access**: Authenticated (`JwtAuthGuard` + `HouseholdGuard` + `@Roles('owner')`).
- **Request Body**: `InviteMemberInput`
  ```json
  {
    "email": "partner@rumahkita.local",
    "role": "member"
  }
  ```
- **Execution Flow**:
  1. Find user by `email` in `users`.
     - If not found -> `404 Not Found` (`"Pengguna dengan email ini tidak ditemukan"`).
  2. Check if user is already in `household_members` for this `householdId`.
     - If already member -> `409 Conflict` (`"Pengguna sudah menjadi anggota rumah tangga ini"`).
  3. Insert into `household_members` (`householdId, userId, role`).
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "id": "member_uuid",
      "householdId": "00000000-0000-4000-a000-000000000001",
      "userId": "user_uuid",
      "role": "member",
      "joinedAt": "2026-10-27T14:35:00.000Z",
      "user": {
        "id": "user_uuid",
        "email": "partner@rumahkita.local",
        "fullName": "Partner Santoso"
      }
    },
    "message": "Anggota berhasil ditambahkan"
  }
  ```

---

### 8.8 `DELETE /api/v1/households/:id/members/:memberId`
- **Description**: Removes a member from the household.
- **Access**: Authenticated (`JwtAuthGuard` + `HouseholdGuard` + `@Roles('owner')`).
- **Execution Flow**:
  1. Find member by `id = memberId AND household_id = householdId`.
  2. If member does not exist -> `404 Not Found`.
  3. If member is `owner`, check count of total owners in household.
     - If total owners === 1 -> `400 Bad Request` (`"Tidak dapat menghapus satu-satunya pemilik rumah tangga"`).
  4. Delete record from `household_members`.
- **Response**: `200 OK` with `message: "Anggota berhasil dihapus"`.

---

## 9. Data Transfer Objects (DTOs) & Contracts

All DTOs directly utilize and validate against schemas in `packages/contracts`:

```typescript
// packages/contracts/src/auth/auth.schema.ts
import { loginSchema, registerSchema, inviteMemberSchema, forgotPasswordSchema, resetPasswordSchema } from '@rumahkita/contracts';

// In apps/api/src/modules/auth/dto/
export class LoginDto implements z.infer<typeof loginSchema> {
  email!: string;
  password!: string;
}

export class RegisterDto implements z.infer<typeof registerSchema> {
  email!: string;
  password!: string;
  fullName!: string;
  phoneNumber?: string;
}

export class InviteMemberDto implements z.infer<typeof inviteMemberSchema> {
  email!: string;
  role!: 'owner' | 'member';
}
```

A NestJS `ZodValidationPipe` should parse incoming request payloads through these contracts, returning standard 422 Unprocessable / 400 Bad Request error envelopes if validation fails.

---

## 10. Standard Response Envelopes & Error Catalog

### 10.1 Standard Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "message": "Operasi berhasil"
}
```

### 10.2 Standard Error Envelope
```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Email atau password salah",
  "timestamp": "2026-10-27T14:30:00.000Z",
  "path": "/api/v1/auth/login"
}
```

### 10.3 Standard 422 Validation Error Envelope
```json
{
  "success": false,
  "statusCode": 422,
  "error": "Unprocessable Content",
  "message": "Validasi gagal",
  "errors": [
    {
      "field": "password",
      "message": "Password minimal 8 karakter"
    }
  ],
  "timestamp": "2026-10-27T14:30:00.000Z",
  "path": "/api/v1/auth/register"
}
```

### 10.4 HTTP Status Codes Summary
| Code | Meaning | Context in Auth / Multi-Tenancy |
|---|---|---|
| `200 OK` | Success | Successful login, refresh, profile fetch, household list. |
| `201 Created` | Created | Successful registration, household creation, member invitation. |
| `400 Bad Request` | Malformed / Business Rule | Missing required fields or deleting last household owner. |
| `401 Unauthorized` | Unauthenticated | Invalid credentials, missing/expired JWT, expired/reused refresh token. |
| `403 Forbidden` | Forbidden | Cross-household access attempt, member attempting owner operation. |
| `404 Not Found` | Resource Not Found | Target user or household does not exist. |
| `409 Conflict` | Unique Violation | Email already registered, or user is already a household member. |
| `422 Unprocessable` | Validation Error | Payload failed Zod contract constraints (e.g. malformed email). |
| `500 Internal Error` | Server Exception | Unexpected database or internal system error (no stack traces leaked). |

---

## 11. NestJS Implementation Blueprint for Backend Dev

### 11.1 Directory & Module Layout
```text
apps/api/src/
├── app.module.ts
├── main.ts
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── current-household.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── household.guard.ts
│   │   └── roles.guard.ts
│   ├── interceptors/
│   │   └── transform.interceptor.ts
│   └── pipes/
│       └── zod-validation.pipe.ts
└── modules/
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── jwt.strategy.ts
    │   └── dto/
    │       ├── login.dto.ts
    │       ├── register.dto.ts
    │       ├── forgot-password.dto.ts
    │       └── reset-password.dto.ts
    └── household/
        ├── household.module.ts
        ├── household.controller.ts
        ├── household.service.ts
        └── dto/
            ├── create-household.dto.ts
            └── invite-member.dto.ts
```

### 11.2 Required Dependencies to Install in `apps/api`
```json
{
  "dependencies": {
    "@node-rs/argon2": "^2.0.2",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "cookie-parser": "^1.4.7"
  },
  "devDependencies": {
    "@types/passport-jwt": "^4.0.1",
    "@types/cookie-parser": "^1.4.8"
  }
}
```

### 11.3 Main.ts Setup Requirements
In `apps/api/src/main.ts`, ensure `cookie-parser` is enabled so `req.cookies` is populated:
```typescript
import cookieParser from 'cookie-parser';

app.use(cookieParser());
```

---

## 12. Verification & Testing Method

The backend developer can verify compliance against this specification using the existing test runner and commands:

```bash
# 1. Typecheck the API package
pnpm --filter @rumahkita/api typecheck

# 2. Build the API package
pnpm --filter @rumahkita/api build

# 3. Start local Postgres dev database
docker compose up -d

# 4. Migrate and Seed the database
pnpm --filter @rumahkita/db db:migrate
pnpm --filter @rumahkita/db db:seed

# 5. Boot API in test mode
pnpm --filter @rumahkita/api dev &

# 6. Execute Tier 1 Auth tests
node tests/e2e/runner.ts --tier 1 --pattern auth.test.ts

# 7. Execute Tier 2 Security Boundary tests (reuse detection & token forgery)
node tests/e2e/runner.ts --tier 2 --pattern security-boundaries.test.ts

# 8. Execute Tier 3 Multi-tenant Cross-household tests
node tests/e2e/runner.ts --tier 3 --pattern cross-household-isolation.test.ts

# 9. Execute Tier 4 Multi-member collaboration scenario
node tests/e2e/runner.ts --tier 4 --pattern multi-member-collaboration.test.ts
```

All 9 test verification steps must pass with `0` failures.
