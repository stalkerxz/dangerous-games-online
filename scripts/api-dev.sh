#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
VENV_DIR="$API_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
pip install --quiet --disable-pip-version-check -r "$API_DIR/requirements.txt"

exec uvicorn main:app --reload --host 0.0.0.0 --port 8000 --app-dir "$API_DIR"
