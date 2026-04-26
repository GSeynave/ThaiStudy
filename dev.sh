#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$RUN_DIR/logs"

BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
BACKEND_LOG_FILE="$LOG_DIR/backend.log"
FRONTEND_LOG_FILE="$LOG_DIR/frontend.log"

BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PYTHON="$BACKEND_DIR/.venv/bin/python"
BACKEND_ENV_FILE="$BACKEND_DIR/.env.local"
BACKEND_HOST="127.0.0.1"
BACKEND_PORT="8000"
FRONTEND_HOST="127.0.0.1"
FRONTEND_PORT="3000"

mkdir -p "$LOG_DIR"

ensure_backend_prereqs() {
  if [[ ! -x "$BACKEND_PYTHON" ]]; then
    echo "Backend virtualenv not found at $BACKEND_PYTHON" >&2
    exit 1
  fi
}

ensure_frontend_prereqs() {
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "Frontend dependencies are missing. Run 'cd frontend && npm install' first." >&2
    exit 1
  fi
}

load_backend_env() {
  if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
    return
  fi

  set -a
  # shellcheck disable=SC1090
  source "$BACKEND_ENV_FILE"
  set +a
}

is_running_from_pid_file() {
  local pid_file="$1"

  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file")"
  if [[ -z "$pid" ]]; then
    return 1
  fi

  kill -0 "$pid" 2>/dev/null
}

wait_for_pid_startup() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"

  for _ in {1..25}; do
    if is_running_from_pid_file "$pid_file"; then
      sleep 0.2
      continue
    fi

    rm -f "$pid_file"
    echo "$name failed to stay up. Check $log_file for details." >&2
    return 1
  done

  if ! is_running_from_pid_file "$pid_file"; then
    rm -f "$pid_file"
    echo "$name failed to stay up. Check $log_file for details." >&2
    return 1
  fi
}

start_backend() {
  ensure_backend_prereqs

  if is_running_from_pid_file "$BACKEND_PID_FILE"; then
    echo "Backend already running (pid $(cat "$BACKEND_PID_FILE"))."
    return
  fi

  : >"$BACKEND_LOG_FILE"
  local previous_dir="$PWD"
  cd "$BACKEND_DIR"
  load_backend_env
  nohup "$BACKEND_PYTHON" -m uvicorn app.main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT" \
    >>"$BACKEND_LOG_FILE" 2>&1 < /dev/null &
  local pid=$!
  cd "$previous_dir"
  echo "$pid" >"$BACKEND_PID_FILE"

  wait_for_pid_startup "Backend" "$BACKEND_PID_FILE" "$BACKEND_LOG_FILE"

  echo "Started backend on http://$BACKEND_HOST:$BACKEND_PORT (pid $(cat "$BACKEND_PID_FILE"))."
}

start_frontend() {
  ensure_frontend_prereqs

  if is_running_from_pid_file "$FRONTEND_PID_FILE"; then
    echo "Frontend already running (pid $(cat "$FRONTEND_PID_FILE"))."
    return
  fi

  : >"$FRONTEND_LOG_FILE"
  local previous_dir="$PWD"
  cd "$FRONTEND_DIR"
  nohup npm run dev -- --hostname "$FRONTEND_HOST" --port "$FRONTEND_PORT" \
    >>"$FRONTEND_LOG_FILE" 2>&1 < /dev/null &
  local pid=$!
  cd "$previous_dir"
  echo "$pid" >"$FRONTEND_PID_FILE"

  wait_for_pid_startup "Frontend" "$FRONTEND_PID_FILE" "$FRONTEND_LOG_FILE"

  echo "Started frontend on http://$FRONTEND_HOST:$FRONTEND_PORT (pid $(cat "$FRONTEND_PID_FILE"))."
}

stop_process() {
  local name="$1"
  local pid_file="$2"

  if ! is_running_from_pid_file "$pid_file"; then
    rm -f "$pid_file"
    echo "$name is not running."
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  kill "$pid" 2>/dev/null || true

  for _ in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$pid_file"
      echo "Stopped $name."
      return
    fi
    sleep 0.2
  done

  kill -9 "$pid" 2>/dev/null || true
  rm -f "$pid_file"
  echo "Force-stopped $name."
}

status_process() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"

  if is_running_from_pid_file "$pid_file"; then
    echo "$name: running (pid $(cat "$pid_file"))"
  else
    echo "$name: stopped"
  fi

  if [[ -f "$log_file" ]]; then
    echo "  log: $log_file"
  fi
}

show_logs() {
  local service="${1:-all}"

  case "$service" in
    backend)
      tail -n 60 -f "$BACKEND_LOG_FILE"
      ;;
    frontend)
      tail -n 60 -f "$FRONTEND_LOG_FILE"
      ;;
    all)
      echo "Backend log: $BACKEND_LOG_FILE"
      tail -n 30 "$BACKEND_LOG_FILE" 2>/dev/null || true
      echo
      echo "Frontend log: $FRONTEND_LOG_FILE"
      tail -n 30 "$FRONTEND_LOG_FILE" 2>/dev/null || true
      ;;
    *)
      echo "Unknown logs target: $service" >&2
      exit 1
      ;;
  esac
}

case "${1:-}" in
  start)
    start_backend
    start_frontend
    ;;
  stop)
    stop_process "frontend" "$FRONTEND_PID_FILE"
    stop_process "backend" "$BACKEND_PID_FILE"
    ;;
  restart)
    stop_process "frontend" "$FRONTEND_PID_FILE"
    stop_process "backend" "$BACKEND_PID_FILE"
    start_backend
    start_frontend
    ;;
  status)
    status_process "backend" "$BACKEND_PID_FILE" "$BACKEND_LOG_FILE"
    status_process "frontend" "$FRONTEND_PID_FILE" "$FRONTEND_LOG_FILE"
    ;;
  logs)
    show_logs "${2:-all}"
    ;;
  *)
    cat <<'EOF'
Usage:
  ./dev.sh start
  ./dev.sh stop
  ./dev.sh restart
  ./dev.sh status
  ./dev.sh logs [backend|frontend|all]
EOF
    exit 1
    ;;
esac
