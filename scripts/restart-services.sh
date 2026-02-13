#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT_DIR}/.run"
LOG_DIR="${RUN_DIR}/logs"
PID_DIR="${RUN_DIR}/pids"

mkdir -p "${LOG_DIR}" "${PID_DIR}"

API_PID_FILE="${PID_DIR}/api.pid"
WORKER_PID_FILE="${PID_DIR}/worker.pid"
WEB_PID_FILE="${PID_DIR}/web.pid"

stop_by_pid_file() {
  local name="$1"
  local pid_file="$2"

  if [[ -f "${pid_file}" ]]; then
    local pid
    pid="$(cat "${pid_file}")"

    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      echo "Stopping ${name} (pid=${pid})"
      kill "${pid}" || true
      sleep 1
      if kill -0 "${pid}" 2>/dev/null; then
        echo "Force killing ${name} (pid=${pid})"
        kill -9 "${pid}" || true
      fi
    fi

    rm -f "${pid_file}"
  fi
}

stop_by_pattern() {
  local name="$1"
  local pattern="$2"
  local pids

  pids="$(pgrep -f "${pattern}" || true)"
  if [[ -n "${pids}" ]]; then
    echo "Stopping ${name} by pattern: ${pattern}"
    while IFS= read -r pid; do
      [[ -z "${pid}" ]] && continue
      kill "${pid}" 2>/dev/null || true
    done <<< "${pids}"
    sleep 1
    pids="$(pgrep -f "${pattern}" || true)"
    if [[ -n "${pids}" ]]; then
      while IFS= read -r pid; do
        [[ -z "${pid}" ]] && continue
        kill -9 "${pid}" 2>/dev/null || true
      done <<< "${pids}"
    fi
  fi
}

start_service() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"
  local verify_pattern="$4"
  shift 4

  echo "Starting ${name}..."
  : > "${log_file}"
  (
    cd "${ROOT_DIR}"
    nohup "$@" >> "${log_file}" 2>&1 &
    echo $! > "${pid_file}"
  )

  local pid
  pid="$(cat "${pid_file}")"
  sleep 1
  if kill -0 "${pid}" 2>/dev/null; then
    echo "Started ${name} (pid=${pid}, log=${log_file})"
    return 0
  fi

  # Fallback: sometimes launcher pid exits while child keeps running.
  local resolved_pid
  resolved_pid="$(pgrep -f "${verify_pattern}" | head -n 1 || true)"
  if [[ -n "${resolved_pid}" ]]; then
    echo "${resolved_pid}" > "${pid_file}"
    echo "Started ${name} (resolved pid=${resolved_pid}, log=${log_file})"
    return 0
  fi

  echo "Failed to keep ${name} running. Check log: ${log_file}" >&2
  return 1
}

echo "==> Stopping running services"
stop_by_pid_file "api" "${API_PID_FILE}"
stop_by_pid_file "worker" "${WORKER_PID_FILE}"
stop_by_pid_file "web" "${WEB_PID_FILE}"

# Fallback in case services were started outside this script.
stop_by_pattern "api" "${ROOT_DIR}/apps/api/dist/index.js"
stop_by_pattern "worker" "${ROOT_DIR}/apps/worker/dist/index.js"
stop_by_pattern "api" "pnpm --filter @wm/api serve"
stop_by_pattern "worker" "pnpm --filter @wm/worker serve"
stop_by_pattern "web" "next start"

echo "==> Building all services"
cd "${ROOT_DIR}"
pnpm build:all

echo "==> Restarting services"
start_service "api" "${API_PID_FILE}" "${LOG_DIR}/api.log" "apps/api/src/index.ts|dist/apps/api/src/index.js|@wm/api start" pnpm --filter @wm/api start
start_service "worker" "${WORKER_PID_FILE}" "${LOG_DIR}/worker.log" "apps/worker/src/index.ts|dist/apps/worker/src/index.js|@wm/worker start" pnpm --filter @wm/worker start
start_service "web" "${WEB_PID_FILE}" "${LOG_DIR}/web.log" "next start|pnpm --dir frontend start" pnpm --dir frontend start

echo "==> Done"
echo "PIDs:"
echo "  api:    $(cat "${API_PID_FILE}")"
echo "  worker: $(cat "${WORKER_PID_FILE}")"
echo "  web:    $(cat "${WEB_PID_FILE}")"
echo "Logs: ${LOG_DIR}"
