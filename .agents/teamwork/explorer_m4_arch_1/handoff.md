# Milestone 4 Architectural Specification Handoff Report

**Agent**: `explorer_m4_arch_1`  
**Working Directory**: `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1`  
**Date**: 2026-10-27  
**Status**: ARCHITECTURAL SPECIFICATION COMPLETED  

---

## 1. Observation

1. **Current Web Workspace Baseline**:
   - `apps/web/package.json` contains Next.js `14.2.14`, React `18.3.1`, `@rumahkita/contracts` (`workspace:*`), `@rumahkita/ui` (`workspace:*`), `clsx`, `lucide-react`, and `tailwind-merge`.
   - Running `pnpm --filter @rumahkita/web typecheck` succeeds with code 0:
     ```
     $ tsc --noEmit
     ```
   - Running `pnpm --filter @rumahkita/web build` compiles `apps/web` with 0 errors:
     ```
     $ next build
       ▲ Next.js 14.2.35
      ✓ Compiled successfully
      ✓ Linting and checking validity of types
      ✓ Collecting page data
      ✓ Generating static pages (4/4)
      ✓ Collecting build traces
      ✓ Finalizing page optimization
     ```

2. **Backend Authentication & Cookie Behavior (`apps/api`)**:
   - In `apps/api/src/common/constants/tokens.ts`:
     ```typescript
     export const REFRESH_COOKIE_NAME = 'refreshToken';
     ```
   - In `apps/api/src/modules/auth/auth.service.ts` lines 39–56:
     ```typescript
     public setRefreshCookie(res: Response, token: string): void {
       res.cookie(REFRESH_COOKIE_NAME, token, {
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'lax',
         path: '/',
         maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
       });
     }
     ```
   - In `apps/api/src/modules/auth/auth.service.ts` line 273:
     `req.cookies?.[REFRESH_COOKIE_NAME] || req.cookies?.['refresh_token']` is accepted.
   - In `apps/api/src/modules/auth/auth.controller.ts` line 51:
     `POST /auth/login` returns `{ success: true, data: { accessToken, expiresIn: 900, user, household, households }, message: 'Login berhasil' }`.
   - In `apps/api/src/common/guards/household.guard.ts` line 40:
     `request.headers['x-household-id']` is resolved and verified against user membership, returning HTTP 403 if unauthorized.

3. **Backend Error Envelope**:
   - In `apps/api/src/common/filters/http-exception.filter.ts` lines 101–117:
     ```typescript
     const payload: Record<string, any> = {
       success: false,
       statusCode,
       error,
       message,
       path: request.url,
       timestamp: new Date().toISOString(),
     };
     if (details.length > 0) payload.details = details;
     if (errors.length > 0) payload.errors = errors;
     ```

4. **Neo-Brutalism Design Tokens & Layout Rules**:
   - In `packages/ui/src/tokens/neo-brutalism.css` lines 1–29:
     Colors `--bg: #FFFDF7`, `--surface: #FFFFFF`, `--ink: #171717`, `--primary: #C8F169`, `--secondary: #B9D9FF`, `--accent: #FF8A65`, `--lavender: #D9C8FF`.
     Hard shadows `--shadow-sm: 2px 2px 0 var(--ink)`, `--shadow-base: 4px 4px 0 var(--ink)`, `--shadow-lg: 6px 6px 0 var(--ink)`.
   - In `doc/design.md` lines 80–107:
     Desktop layout requires a fixed 240–260px sidebar with logo, navigation, household switcher, and user profile badge.
     Mobile layout requires a compact header + 5-item bottom navigation (Dashboard, Transaksi, Belanja, Inventori, Lainnya).

---

## 2. Logic Chain

1. **Proxying via Next.js Route Handlers**:
   - From Observation 2, NestJS API runs on port 4000 (`http://127.0.0.1:4000/api/v1`) while the browser client runs on port 3000.
   - Standard browser cookies configured with `HttpOnly; SameSite=Lax` cannot be directly shared across different local ports unless proxied.
   - Implementing a wildcard catch-all route handler `apps/web/src/app/api/[...path]/route.ts` bridges client requests at `/api/*` to NestJS.
   - By extracting `upstreamRes.headers.getSetCookie()` and setting `set-cookie` on `NextResponse`, the `refreshToken` cookie is kept on the same-origin `localhost:3000` with `HttpOnly` and `SameSite=Lax`, completely shielded from client-side script inspection.

2. **In-Memory JWT Access Token Storage**:
   - To guard against Cross-Site Scripting (XSS), access tokens should not be stored in `localStorage` or `sessionStorage`.
   - `AuthContext` holds the access token in React state (`currentAccessToken`) and provides it to `apiFetch`.
   - On page refresh, `AuthProvider` calls `/api/auth/refresh` on mount. The browser automatically sends the HttpOnly `refreshToken` cookie to the BFF proxy, which forwards it to NestJS, regenerating a fresh access token without user friction.

3. **Multi-Tenant Household Header Dispatching**:
   - From Observation 2, `HouseholdGuard` enforces `X-Household-Id` on all business operations.
   - `HouseholdProvider` stores the user's selected household and persists the selection in `localStorage` (`rumahkita_active_household_id`).
   - The client API fetcher attaches `X-Household-Id` to all outgoing requests. Switching households updates the header immediately and triggers data refetching.

4. **Responsive Reflow Architecture (390px to 1280px)**:
   - In accordance with `antislop-layoutmobile` and `doc/design.md`, mobile layout must reflow rather than merely shrink.
   - Desktop (`>= 1024px`) uses a 240px fixed left sidebar with active links highlighted in neon lime (`bg-primary`, 2px ink border, 4px unblurred shadow).
   - Mobile (`< 1024px`, 390px base) uses a 56px sticky top bar with household selector and a 64px fixed 5-item bottom nav bar.
   - The main mobile content container explicitly reserves `pb-24` (96px) to ensure no content, form submit button, or card is ever hidden behind the bottom navigation bar.

5. **Edge Session Guarding**:
   - Next.js Edge Middleware (`apps/web/src/middleware.ts`) checks the presence of `refreshToken` cookie.
   - Unauthenticated attempts to access dashboard/transaction/inventory pages are redirected immediately to `/login?redirect=...`.
   - Authenticated visits to `/login` are automatically redirected to `/dashboard`.

---

## 3. Caveats

- **No Premature Implementation**: Per explorer mandate, no application source files in `apps/web/src` were modified during this turn. All technical architectural designs, interfaces, component contracts, and implementation snippets are documented in `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1/arch_spec.md`.
- **Form UI Packages**: While `react-hook-form` and `@hookform/resolvers` are specified for form validation with Zod, they should be added to `apps/web/package.json` by the implementation worker if not already present.
- **Charts Component**: Recharts is specified for monthly dashboard aggregation charts and is already noted in `PROJECT.md`.

---

## 4. Conclusion

The technical architecture specification for Milestone 4 (Frontend Web with Next.js App Router) is completed and documented in:
`/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1/arch_spec.md`

The specification comprehensively defines:
1. BFF Proxy route handler (`/api/[...path]/route.ts`) with HttpOnly cookie forwarding and RFC 4180 CSV stream support.
2. Client API fetcher with typed `ApiClientError` and transparent 401 token refresh queueing.
3. Responsive layouts for Desktop (240px fixed sidebar with active neon lime indicator) and Mobile (56px sticky top bar + 64px fixed 5-item bottom nav bar with `pb-24` content reservation).
4. Auth & Household Context (`AuthProvider`, `HouseholdProvider`, `useAuth`, `useHousehold`, login page, and Next.js Edge middleware redirect guard).

---

## 5. Verification Method

1. **Inspect Architecture Specification**:
   View `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1/arch_spec.md`.
   Verify all 6 core sections:
   - BFF Proxy Route Handler
   - Error envelope & client API fetcher
   - Neo-brutalist theme tokens & fonts
   - Desktop 240px sidebar & Mobile 5-item bottom nav
   - Auth & Household context state
   - Directory structure & implementation roadmap

2. **Verify Baseline Web Application**:
   ```bash
   pnpm --filter @rumahkita/web typecheck
   pnpm --filter @rumahkita/web build
   ```
   **Expected Result**: Both commands exit with code 0.

3. **Invalidation Conditions**:
   The architectural design is invalidated if:
   - Upstream NestJS cookie name changes from `refreshToken` without updating the BFF proxy.
   - The BFF proxy fails to propagate `Set-Cookie` headers or `X-Household-Id` headers.
   - Mobile bottom nav covers page content due to missing `pb-24` padding reservation.
