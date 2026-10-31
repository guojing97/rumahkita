## 2026-10-27T19:09:06Z
You are Spec Miner M5 Spec 2.
Your working directory is:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_m5_spec_2

You MUST read the authoritative user request first:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md

Also read:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/TEST_INFRA.md
Any PRD / Design docs in the repo (such as `Doc/prd.md`, `Doc/design.md` or similar).

Your Objective:
Mine and extract all precise technical specifications and business rules for Milestone 5 (Notification Worker & Outbox Processing):
1. Exactly what triggers notification event creation? (PRD §6.10, §10, stock transition rules: Safe -> Menipis, Safe -> Habis, Menipis -> Habis, deduplication window or rules).
2. What are the payload schemas and recipient formatting rules for Email and WhatsApp?
3. What are the notification preference rules (user-level vs household-level, enabled channels, quiet hours if any)?
4. What are the retry policies (max retries, backoff curve, failure logging, dead-letter status)?
5. What are the shutdown and lifecycle requirements for the worker process (graceful SIGTERM/SIGINT, lock release)?

Output Requirements:
Write your extracted specifications to:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_m5_spec_2/analysis.md
and a standard handoff report to:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_m5_spec_2/handoff.md

Completion Criteria:
Document all exact formulas, schemas, constants, and edge cases. Do NOT implement code. When done, notify me via send_message with a brief summary and artifact paths.
