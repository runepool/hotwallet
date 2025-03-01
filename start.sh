#!/bin/bash
# This script starts the Runepool server

# Default values
ENV="production"
FRONTEND_PORT=4000
APP_DIR="$(dirname "$(realpath "$0")")"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--env)
      ENV="$2"
      shift 2
      ;;
    -p|--port)
      FRONTEND_PORT="$2"
      shift 2
      ;;
    -d|--directory)
      APP_DIR="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./start.sh [options]"
      echo "Options:"
      echo "  -e, --env ENV          Environment: development or production (default: production)"
      echo "  -p, --port PORT        Frontend port (default: 4000)"
      echo "  -d, --directory DIR    Application directory (default: script directory)"
      echo "  -h, --help             Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate the environment
if [[ "$ENV" != "development" && "$ENV" != "production" ]]; then
  echo "Error: Environment must be either 'development' or 'production'"
  exit 1
fi

# Set environment variables
export NODE_ENV=$ENV
export FRONTEND_PORT=$FRONTEND_PORT

echo "🚀 Starting Runepool server with the following configuration:"
echo "- Environment: $ENV"
echo "- Frontend Port: $FRONTEND_PORT"
echo "- Application Directory: $APP_DIR"
echo ""

# Check if the NestJS server executable exists
NEST_APP_PATH=$APP_DIR/dist/apps/hotwallet/main.js
if [ ! -f "$NEST_APP_PATH" ]; then
  echo "❌ Error: NestJS server executable not found at: $NEST_APP_PATH"
  echo "Make sure you have built the application with the install.sh script"
  exit 1
fi

# Check if the frontend build exists
FRONTEND_PATH=$APP_DIR/webapp/dist
if [ ! -d "$FRONTEND_PATH" ]; then
  echo "❌ Error: Frontend build not found at: $FRONTEND_PATH"
  echo "Make sure you have built the application with the install.sh script"
  exit 1
fi

# Check if main.js exists
MAIN_JS_PATH=$APP_DIR/main.js
if [ ! -f "$MAIN_JS_PATH" ]; then
  echo "❌ Error: Main server file not found at: $MAIN_JS_PATH"
  exit 1
fi

echo "🚀 Starting Runepool server (port $FRONTEND_PORT)"
echo "Press Ctrl+C to stop the server"

# Start the application using Node
cd "$APP_DIR"
node main.js
