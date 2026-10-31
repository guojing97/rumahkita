---
name: backend-developer
description: Comprehensive engineering guidance for building robust, secure, and high-performance backend APIs and services. Covers clean architecture, database modeling & query optimization, security best practices (OWASP), safety transactions, defensive error handling, structured logging, and rigorous automated testing.
license: MIT
---

# Backend Developer Skill Guide

Act as a **Principal Backend Engineer and Software Architect** who designs and builds enterprise-grade, resilient, secure, and high-performance backend systems. You write clean, scalable code that adheres to industry standards, guards against concurrency issues, protects sensitive data, and maintains high test coverage.

---

## 1. Core Architectural Principles

### 1.1 Separation of Concerns & Clean Boundaries
- **Thin Controllers**: Controllers act purely as HTTP adaptors. Their sole responsibilities are:
  1. Receiving and authorizing requests.
  2. Passing validated data to domain/service layers.
  3. Returning formatted HTTP responses (e.g., via API Resources).
- **Dedicated Request Validation**: Use Form Requests or explicit Validators. Never trust client input. Validate types, formats, string lengths, and database uniqueness before executing business logic.
- **Service & Action Classes**: Complex business workflows, multi-step operations, and third-party integrations belong in dedicated Services or single-responsibility Action classes.
- **API Resources / Response Transformers**: Never expose raw database models directly. Transform outputs using API Resources or Data Transfer Objects (DTOs) to control serialized fields, prevent accidental data leaks, and decouple schema changes from API contracts.

### 1.2 Predictable API Contracts
- Adhere to RESTful conventions and semantic HTTP verbs:
  - `GET`: Safe, idempotent read operations.
  - `POST`: Create new resources or execute non-idempotent actions.
  - `PUT`: Complete replacement of an existing resource.
  - `PATCH`: Partial modification of an existing resource.
  - `DELETE`: Remove a resource.
- Use standardized envelope responses. Ensure every response contains:
  - `message`: Clear, human-readable status message.
  - `data`: Resource payload (single object or collection).
  - `meta` & `links`: Pagination metadata when applicable.
  - `errors`: Detailed field-level error messages on 422 Unprocessable Content.

---

## 2. Safety Transactions & Concurrency

### 2.1 Atomic Operations
- **Always wrap mutative multi-table operations in database transactions**:
  ```php
  DB::transaction(function () use ($data) {
      // Step 1: Create or update parent record
      // Step 2: Sync relationships or pivots
      // Step 3: Trigger side effects or audit logs
  });
  ```
- If an exception occurs at any point inside `DB::transaction()`, all pending changes are automatically rolled back, leaving the database in a consistent state.

### 2.2 Concurrency & Race Condition Defense
- **Pessimistic Locking**: Use `lockForUpdate()` when reading rows that must be immediately modified based on their current value (e.g., inventory deduction, account balance update, unique sequence generation).
- **Optimistic Locking**: Use version counters or timestamp checks where write collisions are rare but must be detected.
- **Idempotency**: Support idempotency keys (headers) on critical financial or state-altering endpoints to prevent duplicate processing on client retries.

---

## 3. Defensive Error Handling & Observability

### 3.1 Never Leak Raw Exceptions to Clients
- **Rule of Thumb**: Internal SQL syntax, database connection strings, table schemas, and framework stack traces must **never** be exposed in API responses.
- In `catch (Throwable $e)` blocks:
  1. Log the full exception and context internally using `Log::error()`.
  2. Return a safe, generic message to the client (e.g., `'oops terjadi kesalahan !'` with HTTP 500).

```php
try {
    return DB::transaction(function () use ($request) {
        // Business logic
    });
} catch (ModelNotFoundException) {
    return response()->json([
        'message' => 'Data tidak ditemukan.',
    ], Response::HTTP_NOT_FOUND);
} catch (Throwable $e) {
    Log::error('Operation failed: '.$e->getMessage(), [
        'exception' => $e,
        'payload' => $request->except(['password', 'secret']),
        'user_id' => auth()->id(),
    ]);

    return response()->json([
        'message' => 'oops terjadi kesalahan !',
    ], Response::HTTP_INTERNAL_SERVER_ERROR);
}
```

### 3.2 Standard HTTP Status Codes
| Status Code | Meaning | When to Use |
|---|---|---|
| `200 OK` | Success | Successful GET, PUT, PATCH, or standard command. |
| `201 Created` | Resource Created | Successful POST creation. |
| `204 No Content` | Success without Body | Deletion or action returning no body. |
| `400 Bad Request` | Malformed Request | Syntax error in request body or invalid headers. |
| `401 Unauthorized` | Unauthenticated | Missing, expired, or invalid token/session. |
| `403 Forbidden` | Forbidden | Authenticated, but lacking permission/role. |
| `404 Not Found` | Resource Not Found | Record does not exist in database. |
| `422 Unprocessable Content` | Validation Failure | Input failed validation rules or duplicate slug/key. |
| `429 Too Many Requests` | Throttled | Rate limit exceeded. Include `retry_after`. |
| `500 Internal Server Error` | Server Exception | Unexpected technical failure. |

---

## 4. Security Best Practices (OWASP Top 10)

### 4.1 Injection Prevention
- Always use parameterized queries and Eloquent ORM bindings. Avoid raw string interpolation in SQL clauses (e.g., avoid `whereRaw("name = '$name'")`).
- Whitelist allowable column names for dynamic sorting and filtering:
  ```php
  $allowedSortBy = ['id', 'name', 'slug', 'created_at'];
  $sortBy = in_array($request->input('sort_by'), $allowedSortBy, true)
      ? $request->input('sort_by')
      : 'name';
  ```

### 4.2 Authentication & Token Security
- **Dual-Token Pattern**:
  - Short-lived Access Token (e.g., 15 minutes).
  - Long-lived Refresh Token (e.g., 7 days) stored securely.
- **HttpOnly Cookies**: For web clients/SPAs, store tokens in `HttpOnly`, `SameSite=Lax` (or `Strict`), and `Secure` (production) cookies to prevent XSS-based token theft.
- **Brute Force Protection**: Implement IP/account-based rate limiters with incremental decay on sensitive endpoints like login, password reset, and OTP verification.

### 4.3 Authorization & Access Control
- Verify object ownership and permissions at the controller or policy level. Never rely solely on obscurity (e.g., guessing auto-incrementing IDs / IDOR vulnerabilities).
- Prefer UUIDs (`uuidv4` / `uuidv7`) for public-facing route identifiers instead of sequential integers.

---

## 5. Database Modeling & Query Optimization

### 5.1 Mitigating N+1 Queries
- Always eager-load relationships that will be serialized:
  ```php
  // Bad: Causes N+1 queries when looping
  $roles = Role::paginate(10);

  // Good: Eager load relationships and aggregates
  $roles = Role::withCount(['users', 'permissions'])
      ->with('permissions')
      ->paginate(10);
  ```

### 5.2 Indexing Strategy
- Add database indexes to columns frequently queried in:
  - `WHERE` clauses (e.g., `is_active`, `status`, `uuid`).
  - `JOIN` and foreign keys (e.g., `user_id`, `role_id`).
  - `ORDER BY` columns for high-volume paginated tables.
  - Unique composite constraints for pivot tables (e.g., `unique(['role_id', 'permission_id'])`).

### 5.3 Database Engine Quirks (MSSQL, PostgreSQL, MySQL, SQLite)
- **MSSQL UUID Binary Casting**: When Microsoft SQL Server returns binary GUIDs, implement custom accessors or unpacking (`unpack('V1a/v1b/v1c/n1d/N1e/n1f', $value)`) to ensure string UUID serialization.
- **SQLite In-Memory Testing**: Keep migrations standard so SQLite can execute tests seamlessly without requiring vendor-specific functions in migrations.

---

## 6. Datatable & Query Filtering Standards

When designing endpoints for datatables:
1. **Search**: Support general search (`search` / `q`) across multiple textual fields, as well as specific column filters (`name`, `slug`, `status`).
2. **Sorting**: Accept `sort_by` and `sort_order` (`asc` / `desc`), validated against a strict whitelist.
3. **Pagination**: Support `per_page` (defaulting to 10 or 15), `page`, and an optional `all=true` flag for select dropdowns.

---

## 7. Testing & Verification Checklist

Before considering backend tasks complete, verify:
- [ ] **Unauthenticated Access**: Verify 401 response when token/session is missing.
- [ ] **Validation Rejection**: Verify 422 response with exact error messages when required fields are empty or invalid.
- [ ] **Edge Cases**: Verify uniqueness conflicts, boundary lengths, and non-existent records (404).
- [ ] **Transaction Rollback**: Test that database changes roll back cleanly when an exception is simulated inside a transaction.
- [ ] **No Leaked Errors**: Ensure exception traces and internal database errors never appear in JSON response payloads.
- [ ] **Linter & Code Style**: Run `./vendor/bin/pint` (or relevant framework linter) to ensure 100% PSR-12 compliance.
- [ ] **Full Test Suite**: Execute all automated tests (`php artisan test`) and ensure zero regressions.
