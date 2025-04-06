#!/bin/bash
# Start Runepool Server (Backend + Frontend via ServeStaticModule)

set -euo pipefail

# Defaults
ENV="production"
FRONTEND_PORT=4123
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$APP_DIR/runepool.log"

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
    -h|--help)
      echo "Usage: ./start.sh [options]"
      echo "  -e, --env ENV              Environment (default: production)"
      echo "  -p, --port PORT            Frontend port (default: 4000)"
      echo "  -d, --directory DIR        App root (default: script dir)"
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

# Export env vars
export NODE_ENV="$ENV"
export FRONTEND_PORT="$FRONTEND_PORT"

echo ""
echo "🚀 Starting Runepool server"
echo "📦  Environment    : $NODE_ENV"
echo "🌐  Frontend Port  : $FRONTEND_PORT"
echo "📁  App Directory  : $APP_DIR"
echo ""

# Paths
MAIN_JS="$APP_DIR/index.js"
NODE_BIN="$APP_DIR/node"
NODE_CMD="${NODE_BIN:-$(command -v node)}"

[[ -f "$MAIN_JS" ]] || { echo "❌ Missing: $MAIN_JS"; exit 1; }
[[ -x "$NODE_CMD" ]] || { echo "❌ Node not executable: $NODE_CMD"; exit 1; }

# Check frontend build exists
FRONTEND_BUILD="$APP_DIR/webapp/dist"
[[ -d "$FRONTEND_BUILD" ]] || {
  echo "❌ Frontend build not found at: $FRONTEND_BUILD"
  echo "⚠️  Make sure the webapp was built before running this script"
  exit 1
}

# Rotate logs
MAX_LOG_SIZE=5242880
MAX_LOG_FILES=5
if [[ -f "$LOG_FILE" && $(stat -c%s "$LOG_FILE") -ge $MAX_LOG_SIZE ]]; then
  for i in $(seq $((MAX_LOG_FILES - 1)) -1 1); do
    [[ -f "$LOG_FILE.$i" ]] && mv "$LOG_FILE.$i" "$LOG_FILE.$((i + 1))"
  done
  mv "$LOG_FILE" "$LOG_FILE.1"
  touch "$LOG_FILE"
fi

# Start unified app and log output
echo "📄 Logging to: $LOG_FILE"
echo "🕒 Started at: $(date)"

{
  "$NODE_CMD" "$MAIN_JS" 2>&1 | tee -a "$LOG_FILE"
} &

# Give server a second to boot
sleep 1

URL="http://localhost:$FRONTEND_PORT"
echo "🌍 Opening browser at $URL"

if command -v xdg-open > /dev/null; then
  xdg-open "$URL"  # Linux
elif command -v open > /dev/null; then
  open "$URL"      # macOS
else
  echo "🧭 Please open your browser and visit: $URL"
fi

wait
