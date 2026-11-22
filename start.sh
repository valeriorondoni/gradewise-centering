#!/usr/bin/env bash
set -euo pipefail

# GradeWise Mac launcher: starts the Python analysis backend and React frontend.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

BACKEND_PID=""

cleanup() {
  echo ""
  echo "Stopping GradeWise..."
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# 1. Check Python & Node availability
if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 was not found. Install Python 3 (e.g. via Homebrew: brew install python) and try again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm was not found. Install Node.js (e.g. via Homebrew: brew install node) and try again."
  exit 1
fi

# 2. Setup Python virtual environment in gradewise-centering/.venv
if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  echo "First start: creating Python virtual environment in gradewise-centering/.venv..."
  python3 -m venv "$VENV_DIR"
fi

echo "Checking Python dependencies..."
"$VENV_DIR/bin/python" -m pip install -q --disable-pip-version-check -r "$BACKEND_DIR/requirements.txt"

# 3. Setup Frontend dependencies if missing
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
fi

# 4. Start Python backend
echo "Starting GradeWise Python engine on http://127.0.0.1:5000 ..."
(
  cd "$BACKEND_DIR"
  exec "$VENV_DIR/bin/python" webapp.py
) &
BACKEND_PID=$!

# Wait briefly for backend to start
sleep 1
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "Error: Python backend failed to start."
  exit 1
fi

# 5. Open browser once Vite is ready and start Vite dev server
(
  sleep 2
  open "http://localhost:5173" >/dev/null 2>&1 || true
) &

echo "Starting GradeWise frontend on http://localhost:5173 ..."
echo "Press Ctrl+C to stop both servers."
cd "$FRONTEND_DIR"
npm run dev
