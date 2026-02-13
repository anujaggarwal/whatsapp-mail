# Tech Stack Decisions (Locked)

## Effective Date
- February 14, 2026

## Core Decisions
1. Database: PostgreSQL (primary and only transactional database for v1).
2. ORM: Prisma (chosen now to avoid future ORM migration).
3. Runtime: Node.js + TypeScript (strict mode) across API and worker.
4. Frontend: Next.js + React + TypeScript.
5. Logging: Pino from day 1 in all services.
6. Storage: AWS S3 for media assets.
7. Package manager: pnpm workspaces.

## Why Prisma over Sequelize
1. Better type-safe schema/client workflow for long-term maintainability.
2. Strong migration workflow and developer ergonomics for multi-service repos.
3. Cleaner query typing across API/worker boundaries.
4. Reduces future rewrite risk by locking modern typed ORM now.

## Engineering Standards (Mandatory)
1. No hardcoded values in business logic.
2. Centralize constants in dedicated `constants` modules.
3. Environment variables loaded via shared config layer with validation.
4. Pino structured logs for all critical paths:
- account connect/disconnect,
- sync run start/end/failure,
- batch checkpoint writes,
- real-time message ingestion,
- media upload/retry/failure,
- API request lifecycle and errors.
5. All logs must include account/tenant context where available.

## Service-Level Tooling
1. `apps/api`
- Express/Fastify (current plan: Express for continuity)
- Prisma Client
- Pino HTTP logging

2. `apps/worker`
- Baileys integration
- Prisma Client
- Pino logging
- Queue consumer and retry handlers

3. `apps/web`
- Next.js app router
- Shared typed API contracts

## Pending Tooling Choice (One Remaining)
- Queue backend: decide between Postgres-backed queue (`pg-boss`) vs Redis-backed queue.
- This is the only major infra tool still open.
