# Repository Guidelines

## Project Structure & Module Organization
- `src/`: backend TypeScript application.
- `src/api/`: Express server and route handlers.
- `src/services/`, `src/handlers/`, `src/models/`: WhatsApp integration, event processing, and Sequelize models.
- `migrations/`: SQL schema migrations (currently `001_initial_schema.sql`).
- `scripts/`: local utility scripts (DB setup and data checks).
- `frontend/`: Next.js UI (`frontend/src/components`, `frontend/src/app`).
- `dist/`: compiled backend output (generated; do not hand-edit).
- `baileys/`: vendored upstream library code; avoid changing unless intentionally updating forked behavior.

## Build, Test, and Development Commands
Use `pnpm` (repo is pinned to `pnpm@10`).
- `pnpm dev`: run backend with watch mode (`src/index.ts`).
- `pnpm build`: compile backend TypeScript to `dist/`.
- `pnpm start`: run compiled backend from `dist/index.js`.
- `pnpm typecheck`: run strict TypeScript checks without emitting files.
- `pnpm sync-history`: run history sync script.
- `bash scripts/setup-database.sh`: create DB and apply migration.
- `pnpm --dir frontend dev`: run Next.js frontend locally.
- `pnpm --dir frontend build` / `pnpm --dir frontend lint`: frontend production build and lint.

## Coding Style & Naming Conventions
- Language: TypeScript (strict mode).
- Backend style follows existing files: 2-space indentation, semicolons, single quotes, ESM imports with `.js` suffix.
- Frontend follows Next.js + ESLint defaults (currently double quotes in app files).
- Naming conventions: `*.service.ts` for integrations/business logic, `*.handler.ts` for WhatsApp event processing, and route modules under `src/api/routes/*.ts`.

## Testing Guidelines
- No unified backend test framework is configured yet.
- Minimum pre-PR checks: `pnpm typecheck`, `pnpm build`, `pnpm --dir frontend lint`, and relevant manual API/UI validation.
- Optional script-based validation: `tsx scripts/test-db-insert.ts` and `tsx test-fetch.ts` (requires valid auth/session setup).

## Commit & Pull Request Guidelines
- Follow current history style: concise, imperative commit subjects (for example, `Add full backend, database schema, and Next.js frontend scaffold`).
- Keep commits focused by concern (backend, frontend, schema, docs).
- PRs should contain a clear summary and rationale, linked issue/task when available, screenshots/recordings for `frontend/` changes, and notes for env/config/migration impacts (`.env`, `migrations/`, auth/session behavior).
