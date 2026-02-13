# WhatsApp Mail Product Blueprint

## 1) Product Vision
Build a standalone product that feels like Gmail for WhatsApp, with one core promise:

- Never lose chat history.
- Give users inbox controls WhatsApp does not provide.
- Add AI-assisted retrieval over personal conversation history.

This is not a WhatsApp clone. This is a reliability and workflow layer built on top of WhatsApp data.

## 2) Why Users Will Pay
Users pay for outcomes, not UI polish.

- Data Safety: historical sync, ongoing capture, export and restore confidence.
- Control: automation (archive/snooze/rules/auto-reply) unavailable in native apps.
- Productivity: search, filters, inbox workflows, and later AI Q&A.
- Business Continuity: for teams, lost messages can mean lost revenue.

Primary paid value proposition:

- "Reliable WhatsApp archive + workflow automation + AI retrieval with verifiable sync health."

## 3) Target Users
- Power users with large personal chat history.
- Founders, operators, and support/sales users handling high message volume.
- Users burned by lost backups or broken device migrations.

## 4) Product Principles
- Reliability first, features second.
- Transparent sync status (what is synced, what failed, what is pending).
- Safe automation (preview/dry-run before automatic actions).
- Multi-tenant by design from day one.

## 5) Scope and Priorities
Confirmed priorities:

1. Ingest old messages and capture new messages reliably.
2. Reuse auth/session without prompting each run.
3. Explicit confirmation before any fresh-auth destructive operation.
4. Sync all supported media types.
5. Group-participant deep backfill deferred to later phase.

## 6) MVP (Launch 1)
### Must Have
- Account connect and session persistence.
- Background historical sync (fresh mode with explicit confirmation).
- Continuous real-time ingestion for new messages.
- Sync dashboard: total synced count, batches, last event timestamp, failures.
- Searchable inbox and thread view.
- Media ingestion to S3 with retry.
- Export and restore path.

### Not in Launch 1
- Auto-reply, rules engine, snooze orchestration.
- Full AI assistant.
- Advanced group participant analytics.

## 7) Phase Plan
### Phase A: Reliability Core
- Fix listener ordering and ingestion race conditions.
- Add `sync_runs` and `sync_checkpoints` tables.
- Add deterministic sync completion logic.
- Add reconnect-safe event handling.

### Phase B: Data Integrity and Real-Time Parity
- Handle `messages.upsert` and `messages.update` consistently.
- Ensure idempotent writes and replay-safe processing.
- Add observability endpoints and ingest lag metrics.

### Phase C: Media and UX Foundation
- Wire media download/upload in ingestion workers.
- Persist metadata to `message_media`.
- Add retry queue/dead-letter path.
- Ship Gmail-like inbox UX based on the chosen template style.

### Phase D: Automation and AI
- Archive/snooze/filter workflows.
- Rules engine and guarded auto-reply.
- AI retrieval with source references/citations.

## 8) Product Architecture (Launchable)
Deployment model selected: split services.

- Web App (Next.js): onboarding, inbox UI, settings, sync dashboard.
- API Service (Node/TS): account APIs, query APIs, settings/rules APIs.
- Ingestion Worker(s): WhatsApp sync/live capture/media processing.
- Queue: decouple ingest from processing and retries.
- PostgreSQL: system of record (multi-tenant schema).
- S3: media storage with signed URL access.
- Observability: logs, metrics, run-level status, failure analytics.

## 9) Multi-Tenant Data Model Direction
All core entities should include tenant/account ownership boundaries.

- `tenants`
- `users`
- `accounts` (WhatsApp linked account)
- `sync_runs`
- `sync_checkpoints`
- `chats`, `messages`, `contacts`, `group_metadata`, `message_media`

Key design rule:

- Every read/write path must be tenant-scoped.

## 10) Reliability and Safety Requirements
- Idempotency on message writes (`message_id` + account scope).
- Retry with backoff for transient DB/S3/network failures.
- Dead-letter handling for repeated failures.
- Replay tooling for failed ingestion windows.
- Explicit operator confirmation for fresh history mode that resets auth state.

## 11) Security Baseline
Current decisions:

- No special compliance framework required at this stage.
- Still enforce baseline production hygiene:
- encrypted transit,
- secure secret management,
- least-privilege DB/S3 access,
- strict tenant isolation,
- audit logs for sensitive actions.

## 12) Key Metrics
- Historical sync completeness (% and absolute count).
- Real-time ingest lag (P50/P95).
- Duplicate/write-conflict rate.
- Media success/failure/retry rate.
- Restore success rate.

## 13) GTM and Packaging
Suggested packaging:

- Personal: backup + sync + search.
- Pro: advanced filters and automation.
- Team: multi-user controls, reliability dashboards, SLA-style visibility.

Messaging should lead with trust:

- "Never lose your WhatsApp history again."

## 14) Known Risks
- Upstream protocol/platform behavior changes.
- Account/session disconnect edge cases.
- Throughput bottlenecks during large history sync.
- Automation errors if guardrails are weak.

Mitigation strategy:

- transparent health signals,
- robust retries,
- replay support,
- phased feature rollout.

## 15) Immediate Engineering Next Steps
1. Scaffold new product workspace with separate `api`, `worker`, and `web` apps.
2. Add core product schema (`tenants`, `accounts`, `sync_runs`, `sync_checkpoints`).
3. Refactor sync flow to register handlers before socket connect.
4. Implement run-level observability endpoints for sync status.
5. Port inbox UX using chosen email-client style as frontend baseline.

## 16) Open Technical Clarifications (for implementation kickoff)
- Postgres queue vs dedicated broker (`pg-boss`/Redis/RabbitMQ) for worker jobs.
- Single-region vs multi-region storage strategy.
- Per-account media retention policy defaults.

These do not block Phase A but should be finalized before Phase C hardening.
