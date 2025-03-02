#!/bin/bash

# Install script for Runepool DEX
# This script pulls the latest code and builds the application

# Default values
BRANCH="main"
REPO_URL="https://github.com/pxr64/rune-pool-maker-app.git"
WEBAPP_REPO_URL="https://github.com/pxr64/runpool-maker-webapp.git"
INSTALL_DIR="$HOME/runepool-dex"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -b|--branch)
      BRANCH="$2"
      shift 2
      ;;
    -d|--directory)
      INSTALL_DIR="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./install.sh [options]"
      echo "Options:"
      echo "  -b, --branch BRANCH    Git branch to use (default: main)"
      echo "  -d, --directory DIR    Installation directory (default: ~/runepool-dex)"
      echo "  -h, --help             Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "🚀 Starting installation with the following configuration:"
echo "- Git Branch: $BRANCH"
echo "- Installation Directory: $INSTALL_DIR"
echo ""

# Create installation directory if it doesn't exist
if [ ! -d "$INSTALL_DIR" ]; then
  echo "📁 Creating installation directory: $INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  
  # Clone the repository
  echo "📥 Cloning backend repository from $REPO_URL"
  git clone "$REPO_URL" "$INSTALL_DIR"
  if [ $? -ne 0 ]; then
    echo "❌ Failed to clone backend repository"
    exit 1
  fi
  
  cd "$INSTALL_DIR"
else
  # Update existing repository
  echo "📂 Using existing installation directory: $INSTALL_DIR"
  cd "$INSTALL_DIR"
  
  echo "📥 Pulling latest backend changes"
  git fetch
  git checkout "$BRANCH"
  git pull
  if [ $? -ne 0 ]; then
    echo "❌ Failed to pull latest backend changes"
    exit 1
  fi
fi

# Check if webapp directory exists and if it's a git repository
if [ -d "$INSTALL_DIR/webapp" ]; then
  if [ -d "$INSTALL_DIR/webapp/.git" ]; then
    # It's a git repository, update it
    echo "📥 Pulling latest webapp changes"
    cd "$INSTALL_DIR/webapp"
    git fetch
    git checkout "$BRANCH" || git checkout main
    git pull
    if [ $? -ne 0 ]; then
      echo "❌ Failed to pull latest webapp changes"
      exit 1
    fi
  else
    # It exists but is not a git repository, remove and clone
    echo "🔄 Webapp directory exists but is not a git repository. Recreating..."
    rm -rf "$INSTALL_DIR/webapp"
    echo "📥 Cloning webapp repository from $WEBAPP_REPO_URL"
    git clone "$WEBAPP_REPO_URL" "$INSTALL_DIR/webapp"
    if [ $? -ne 0 ]; then
      echo "❌ Failed to clone webapp repository"
      exit 1
    fi
  fi
else
  # Webapp directory doesn't exist, clone it
  echo "📥 Cloning webapp repository from $WEBAPP_REPO_URL"
  git clone "$WEBAPP_REPO_URL" "$INSTALL_DIR/webapp"
  if [ $? -ne 0 ]; then
    echo "❌ Failed to clone webapp repository"
    exit 1
  fi
fi

# Install backend dependencies
echo "📦 Installing backend dependencies"
cd "$INSTALL_DIR"
yarn install
if [ $? -ne 0 ]; then
  echo "❌ Failed to install backend dependencies"
  exit 1
fi

# Install webapp dependencies
echo "📦 Installing webapp dependencies"
cd "$INSTALL_DIR/webapp"
yarn install --prod
if [ $? -ne 0 ]; then
  echo "❌ Failed to install webapp dependencies"
  exit 1
fi

cd "$INSTALL_DIR"

# Build the application
echo "🔨 Building the backend"
yarn build:hotwallet
if [ $? -ne 0 ]; then
  echo "❌ Failed to build the backend"
  exit 1
fi

echo "🔨 Building the webapp"
cd "$INSTALL_DIR/webapp" && yarn build
if [ $? -ne 0 ]; then
  echo "❌ Failed to build the webapp"
  exit 1
fi
cd "$INSTALL_DIR"

echo "✅ Installation completed successfully!"

echo ""
echo "📝 Next Steps:"
echo "1. Your application is available in: $INSTALL_DIR"
echo "2. To start the server, run: $INSTALL_DIR/start.sh"
echo ""