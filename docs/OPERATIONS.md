# Operations Runbook

## Restart Everything
Use:

```bash
./scripts/restart-services.sh
```

or

```bash
pnpm restart:all
```

## What the Script Does
1. Stops previously tracked service PIDs.
2. Stops fallback matching processes by pattern.
3. Builds all targets via `pnpm build:all`.
4. Starts services and writes:
- PID files in `.run/pids/`
- logs in `.run/logs/`

## Validate Service Health
```bash
cat .run/pids/api.pid .run/pids/worker.pid .run/pids/web.pid
ps -p $(cat .run/pids/api.pid),$(cat .run/pids/worker.pid),$(cat .run/pids/web.pid) -o pid=,cmd=
tail -n 60 .run/logs/api.log
tail -n 60 .run/logs/worker.log
tail -n 60 .run/logs/web.log
```

## Known Current Behavior
1. `worker` is scaffold-only right now and stays alive via a temporary heartbeat loop.
2. Frontend build may show a lockfile root warning in Next.js; this is non-fatal.
3. On constrained environments, Turbopack build may fail due sandbox limits; local machine builds should be used for final verification.

## Troubleshooting
1. If a service fails startup, inspect corresponding `.run/logs/*.log`.
2. If PID exists but process is dead, rerun restart and verify with `ps` command above.
3. If frontend build fails but backend build passes, run backend service start manually while frontend issue is diagnosed.
