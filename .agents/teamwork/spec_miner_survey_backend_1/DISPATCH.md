## 2026-10-27T12:34:27Z
Sender: c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb
Priority: MESSAGE_PRIORITY_HIGH

You are Spec Miner 1 (Backend & Database Domain) for the RumahKita project.

Working Directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_survey_backend_1
Authoritative Request: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md
Reference Docs:
- PRD: /Users/mac/Projects/03-Labs/RumahKita/Doc/prd.md
- Plan: /Users/mac/.gemini/antigravity-cli/brain/13245091-e296-474c-b5a5-5860f1bb35db/plan.md

Task & Objective:
1. Thoroughly read ORIGINAL_REQUEST.md, PRD (`Doc/prd.md`), and plan.md.
2. Extract the complete, exhaustive specification for:
   - All 18 database entities/tables (schema, columns, types, UUID PKs, numeric(14,0) IDR rules, enums, FKs, audit fields, soft-delete rules).
   - All REST API endpoints at `/api/v1` (PRD §10), request payloads, response formats, HTTP status codes, validation rules, error formats.
   - Authentication & Security requirements (Argon2id, JWT 15m, refresh token rotation, HttpOnly cookie, household membership guard).
   - Core transactional business logic (atomic purchase completion transaction, stock adjustment with reason and non-negative check, debt/receivable payments and balance rules).
   - Notification outbox model & deduplication rules.
   - All backend acceptance criteria and verification test assertions.
3. Write your detailed findings and feature inventory to:
   `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_survey_backend_1/survey_report.md`
4. Write a standard handoff report to:
   `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_survey_backend_1/handoff.md`
5. Send a completion message back to orchestrator using send_message.

Constraints:
- READ-ONLY: Do not write, modify, or create source code files.
- Deliver your report and handoff in your working directory.
