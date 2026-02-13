# Task Board - Product Build Execution

This board is the execution source of truth for multi-session work.

## Rules
- Each session must close at least one task to `Done`.
- Every task defines explicit input and output.
- No coding starts on later phases before earlier phase acceptance checks pass.

## Status Legend
- `Todo`
- `In Progress`
- `Blocked`
- `Done`

## Phase 0 - Repository Baseline
| ID | Task | Input | Output | Definition of Done | Status |
|---|---|---|---|---|---|
| P0-1 | Create product docs baseline | Current repo and goals | `PRODUCT_BLUEPRINT.md`, `PRD_SHORT.md`, `IMPLEMENTATION_PLAN_PHASE_A.md` | Docs exist and linked from docs index | Done |
| P0-2 | Clean legacy clutter | Prototype docs/scripts | Archived legacy files under `docs/archive/` and `legacy/scripts/` | Active root/docs no longer mixed with prototype-only files | Done |
| P0-3 | Define execution board | Product plan | This `TASK_BOARD.md` | Board includes phases, I/O, and DoD | Done |
| P0-4 | Lock stack and standards | Product and engineering constraints | `TECH_STACK_DECISIONS.md` | DB/ORM/logging/config standards are fixed | Done |

## Phase A - Reliability Core (Current Priority)
| ID | Task | Input | Output | Definition of Done | Status |
|---|---|---|---|---|---|
| A-0 | Bootstrap shared config/constants/logging packages | Locked stack decisions | `packages/shared` config schema, constants, pino logger factories | No service hardcodes env-sensitive values | Todo |
| A-1 | Monorepo app split scaffold | Existing single app | `apps/api`, `apps/worker`, `apps/web`, `packages/shared` | Each app has bootstrapped `package.json`, TS config, startup entry | Todo |
| A-2 | Multi-tenant schema migration v1 | Existing schema | Migrations for `tenants`, `users`, `accounts` | Migrations apply cleanly and rollback works | Todo |
| A-3 | Sync observability schema | A-2 complete | Migrations for `sync_runs`, `sync_checkpoints` | Tables and indexes created + validated by query | Todo |
| A-4 | Domain ownership columns | A-2 complete | `tenant_id`/`account_id` on core tables | Composite unique constraints enforce account-scoped idempotency | Todo |
| A-5 | Worker run manager | A-1/A-3 complete | `run-manager` to start/finish/fail sync runs | Run lifecycle persisted in DB | Todo |
| A-6 | Handler-before-connect lifecycle | Current WhatsApp service | Refactored connect flow with pre-registered handlers | No missed first history batches in replay test | Todo |
| A-7 | Fresh vs incremental mode | A-6 complete | Explicit mode flow + confirmation requirement for fresh | Fresh mode blocked without confirmation token | Todo |
| A-8 | History checkpoint writer | A-5/A-6 complete | Batch checkpoint persistence | Every history batch writes checkpoint row | Todo |
| A-9 | Real-time continuity | A-6 complete | `messages.upsert` + `messages.update` ingestion in worker | Updates persist and are idempotent | Todo |
| A-10 | Sync status APIs | A-3/A-5 complete | API routes for status/runs/start | Endpoints return tenant/account-scoped data | Todo |
| A-11 | Acceptance test pack | A-6 to A-10 | Unit + integration + manual checklist execution report | All Phase A DoD checks pass | Todo |

## Phase B - Media Reliability
| ID | Task | Input | Output | Definition of Done | Status |
|---|---|---|---|---|---|
| B-1 | Media ingestion wiring | Existing `StorageService` | Worker media processing pipeline | All allowed media types are attempted | Todo |
| B-2 | Retry and dead-letter flow | B-1 complete | Media retry queue and failure table | Failures retry with backoff and terminal failures are visible | Todo |
| B-3 | Signed media retrieval API | B-1 complete | API endpoint for secure media URLs | Frontend loads media from signed links | Todo |

## Phase C - Inbox Product UX
| ID | Task | Input | Output | Definition of Done | Status |
|---|---|---|---|---|---|
| C-1 | Inbox scaffold from chosen reference | `next-email-client` patterns | New `apps/web` inbox shell | Sidebar/thread layout functional with mock data | Todo |
| C-2 | Backend adapter integration | API routes + web shell | Real chat/thread/search wired to API | User can browse and search real data | Todo |
| C-3 | Sync health UI | Sync status APIs | Dashboard widget for counts/health | User sees synced count, lag, failures | Todo |
| C-4 | Large list performance | C-2 complete | Virtualized chat/message lists | Smooth scroll on large datasets | Todo |

## Phase D - Automation (Later)
| ID | Task | Input | Output | Definition of Done | Status |
|---|---|---|---|---|---|
| D-1 | Archive/filter model and APIs | Stable core ingestion | Data model + APIs | Archive/filter can be configured and applied | Todo |
| D-2 | Snooze workflows | D-1 complete | Snooze schedules and execution worker | Snoozed chats reappear correctly | Todo |
| D-3 | Rules engine | D-1 complete | Rule evaluation pipeline | Rule actions execute deterministically | Todo |
| D-4 | Auto-reply guardrails | D-3 complete | Safe auto-reply with preview controls | No silent auto-send without configured policy | Todo |

## Current Session Outcome Targets
1. All Phase 0 tasks done.
2. Start Phase A with `A-1` scaffolding.
