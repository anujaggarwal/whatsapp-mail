# PRD Short Version

## Problem
WhatsApp users need a safer and more controllable inbox:

- chat history can be lost,
- automation is limited,
- search is basic.

## Product
WhatsApp Mail: Gmail-like interface on top of WhatsApp data.

Core promise:

- reliable backup/sync,
- inbox control (later: rules/snooze/auto-reply),
- AI retrieval over chat history (later phase).

## Launch Goal
Ship a reliable ingestion product first.

### Launch 1 Scope
- One-time account link + persistent auth reuse.
- Background historical sync.
- Real-time capture of new messages.
- Sync health dashboard (`synced count`, `last event`, `failures`).
- Search + conversation view.
- Media upload to S3 with retry handling.

### Later Scope
- Rules/snooze/auto-reply.
- Full AI assistant workflows.

## Architecture
Split services:

- `web`: Next.js app.
- `api`: account/data APIs.
- `worker`: WhatsApp ingestion + media processing.
- Postgres + S3 + queue.

## Why Users Pay
- Prevent data loss.
- Save time with stronger workflow controls.
- Get trustworthy retrieval over years of chat history.

## Success Metrics
- 99.9% ingestion reliability target.
- P95 real-time ingestion lag < 5s.
- >99% media processing success with retries.
- Clear per-account sync progress and recoverability.
