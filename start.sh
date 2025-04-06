#!/bin/bash
# Start Runepool Server

set -euo pipefail

# Defaults
ENV="production"
FRONTEND_PORT=4000
USE_SYSTEM_NODE=false
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--env)
      ENV="${2:-}"
      shift 2
      ;;
    -p|--port)
      FRONTEND_PORT="${2:-}"
      shift 2
      ;;
    -d|--directory)
      APP_DIR="${2:-}"
      shift 2
      ;;
    --use-system-node)
      USE_SYSTEM_NODE=true
      shift
      ;;
    -h|--help)
      echo "Usage: ./start.sh [options]"
      echo "  -e, --env ENV              Environment (default: production)"
      echo "  -p, --port PORT            Frontend port (default: 4000)"
      echo "  -d, --directory DIR        App root (default: script dir)"
      echo "  --use-system-node          Use system Node.js instead of bundled"
      echo "  -h, --help                 Show this help"
      exit 0
      ;;
    *)
      echo "❌ Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate env
if [[ "$ENV" != "production" && "$ENV" != "development" ]]; then
  echo "❌ Invalid environment: $ENV"
  exit 1
fi

# Export environment vars
export NODE_ENV="$ENV"
export FRONTEND_PORT="$FRONTEND_PORT"

echo ""
echo "🚀 Starting Runepool server"
echo "📦  Environment    : $NODE_ENV"
echo "🌐  Frontend Port  : $FRONTEND_PORT"
echo "📁  App Directory  : $APP_DIR"
echo "🧩  Node.js        : $([[ "$USE_SYSTEM_NODE" == true ]] && echo 'system' || echo 'bundled')"
echo ""

# Paths
MAIN_JS="$APP_DIR/main.js"
FRONTEND_BUILD="$APP_DIR/webapp/dist"
NODE_BIN="$APP_DIR/node"
NODE_CMD="$([[ "$USE_SYSTEM_NODE" == true ]] && command -v node || echo "$NODE_BIN")"

# Checks
[[ -f "$MAIN_JS" ]] || {
  echo "❌ Missing: $MAIN_JS"
  exit 1
}

[[ -d "$FRONTEND_BUILD" ]] || {
  echo "❌ Missing: $FRONTEND_BUILD"
  exit 1
}

[[ -x "$NODE_CMD" ]] || {
  echo "❌ Node binary not executable: $NODE_CMD"
  exit 1
}

# Start app
cd "$APP_DIR"
echo "🕒 Started at: $(date)"
exec "$NODE_CMD" "$MAIN_JS"
