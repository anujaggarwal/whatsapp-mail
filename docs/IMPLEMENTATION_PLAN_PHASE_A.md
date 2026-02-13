# Implementation Plan - Phase A (Reliability Core)

## Goal
Deliver a production-ready ingestion core that:

- syncs old WhatsApp messages reliably,
- captures new messages continuously,
- reuses auth/session safely,
- shows clear sync progress and health per account.

## Scope Boundaries
In scope:

- multi-tenant/account foundations,
- sync run tracking and checkpoints,
- listener ordering and reconnect-safe ingestion,
- minimal status APIs for product UI.

Out of scope (later phases):

- rules, auto-reply, snooze,
- full AI assistant,
- deep group participant backfill.

## Milestones
1. M1: Platform scaffold and data model foundations.
2. M2: History sync correctness and resumability.
3. M3: Real-time continuity and health visibility.
4. M4: Hardening, test pass, rollout checklist.

## Dependencies
- Postgres and S3 already available.
- Existing Baileys integration code as migration source.
- New split services: `web`, `api`, `worker`.

## Work Breakdown

### M1 - Foundation (Schema + Service Skeleton)
#### Database migrations
Create migrations for:

1. `tenants`
- `id`, `name`, `slug`, `status`, `created_at`, `updated_at`

2. `users`
- `id`, `tenant_id`, `email`, `name`, `role`, `created_at`, `updated_at`

3. `accounts`
- `id`, `tenant_id`, `owner_user_id`, `provider` (`whatsapp`), `external_account_id`,
  `session_dir`, `status`, `last_connected_at`, `created_at`, `updated_at`

4. `sync_runs`
- `id`, `tenant_id`, `account_id`, `mode` (`fresh_history`/`incremental`),
  `status` (`running`/`completed`/`failed`/`cancelled`),
  `started_at`, `ended_at`,
  counters: `batches`, `messages_seen`, `messages_inserted`, `messages_duplicate`,
  `chats_seen`, `contacts_seen`, `errors_count`,
  `latest_event_ts`, `notes`

5. `sync_checkpoints`
- `id`, `sync_run_id`, `batch_no`, `is_latest_flag`,
  `messages_in_batch`, `chats_in_batch`, `contacts_in_batch`,
  `event_received_at`, `checkpoint_payload`

6. Add tenant/account ownership to existing domain tables
- `chats`, `messages`, `contacts`, `group_metadata`, `message_media`
- add composite uniqueness where needed (for example `account_id + message_id`).

#### Service scaffold
- Create folders:
- `apps/api`
- `apps/worker`
- `apps/web` (later UI migration path)
- `packages/shared` for shared types/config.

### M2 - History Sync Correctness
#### Worker ingestion refactor
1. Register all event handlers before socket connect.
2. Add explicit run modes:
- `fresh_history`: requires explicit confirmation before clearing session.
- `incremental`: no auth reset.
3. Start `sync_run` before connecting; update metrics throughout.
4. Persist `sync_checkpoints` for each history batch.
5. Completion criteria:
- `isLatest=true`, or
- idle timeout after at least one batch + grace window.
6. On restart/crash:
- mark prior running job failed with reason,
- resume in incremental mode using existing session.

#### Data write strategy
- Keep idempotent inserts/upserts.
- Separate counters for seen/inserted/duplicate/error.
- Batch writes where possible to reduce ORM per-row overhead.

### M3 - Real-Time Continuity + Health APIs
#### Worker
1. Capture `messages.upsert` continuously.
2. Add `messages.update` handling for edits/deletes/reactions/status mutations.
3. Reconnect policy with bounded exponential backoff.
4. Maintain heartbeat (`last_event_at`, `connection_state`).

#### API
Create minimal endpoints:

1. `GET /v1/accounts/:id/sync-status`
- latest run summary + current state

2. `GET /v1/accounts/:id/sync-runs`
- paginated historical runs

3. `POST /v1/accounts/:id/sync/fresh`
- requires explicit confirmation token in request body

4. `POST /v1/accounts/:id/sync/incremental`
- starts incremental run

### M4 - Hardening and Readiness
#### Acceptance criteria
1. Fresh history run records checkpoints and final counts.
2. New incoming messages continue while history is syncing.
3. Restart during sync does not break future ingestion.
4. Auth is reused across restarts for incremental mode.
5. No duplicate logical records under replay.
6. Status endpoint reflects real counters/timestamps.

#### Test checklist
1. Unit tests:
- message type mapping,
- idempotency helpers,
- completion criteria logic.

2. Integration tests:
- simulated `messaging-history.set` multi-batch replay,
- simulated disconnect/reconnect,
- `messages.upsert` + `messages.update` persistence.

3. Manual E2E:
- fresh connect with explicit confirmation,
- run history sync,
- verify DB counters and status API,
- send real-time test message and verify insertion.

## File-Level Action Map (Current Codebase Reference)
1. Split and migrate logic from:
- `src/services/whatsapp.service.ts`
- `src/scripts/sync-history.ts`
- `src/handlers/history.handler.ts`
- `src/handlers/message.handler.ts`

2. Introduce new modules:
- `apps/worker/src/sync/run-manager.ts`
- `apps/worker/src/sync/checkpoint-store.ts`
- `apps/worker/src/ingest/history-consumer.ts`
- `apps/worker/src/ingest/realtime-consumer.ts`
- `apps/api/src/routes/sync-status.ts`
- `apps/api/src/routes/sync-runs.ts`

3. Shared contracts:
- `packages/shared/src/types/sync.ts`
- `packages/shared/src/types/account.ts`

## Risks and Mitigations
1. Race condition on initial history events.
- Mitigation: strict handler-before-connect lifecycle.

2. Large sync memory/DB pressure.
- Mitigation: bounded batch processing + periodic checkpoints.

3. Platform disconnects.
- Mitigation: reconnect strategy + run-state persistence.

4. Ambiguous sync completeness.
- Mitigation: `isLatest` + idle timeout + explicit run summary.

## Delivery Estimate (Phase A)
- M1: 3-4 days
- M2: 4-5 days
- M3: 3-4 days
- M4: 2-3 days

Total: 12-16 working days for a stable Phase A baseline.

## Definition of Done
Phase A is complete when a user can:

1. connect once,
2. run background historical sync with visible progress,
3. continue receiving new messages without data loss,
4. restart services without repeated auth prompts,
5. inspect exact sync counts and health from API.
