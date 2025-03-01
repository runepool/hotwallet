#!/bin/bash

# Install script for Runepool DEX
# This script pulls the latest code and builds the application

# Default values
BRANCH="main"
REPO_URL="https://github.com/pxr64/rune-pool-maker-app.git"
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
  echo "📥 Cloning repository from $REPO_URL"
  git clone "$REPO_URL" "$INSTALL_DIR"
  if [ $? -ne 0 ]; then
    echo "❌ Failed to clone repository"
    exit 1
  fi
  
  cd "$INSTALL_DIR"
else
  # Update existing repository
  echo "📂 Using existing installation directory: $INSTALL_DIR"
  cd "$INSTALL_DIR"
  
  echo "📥 Pulling latest changes"
  git fetch
  git checkout "$BRANCH"
  git pull
  if [ $? -ne 0 ]; then
    echo "❌ Failed to pull latest changes"
    exit 1
  fi
fi

# Install dependencies
echo "📦 Installing dependencies"
yarn install
if [ $? -ne 0 ]; then
  echo "❌ Failed to install dependencies"
  exit 1
fi

# Build the application
echo "🔨 Building the application"
nest build hotwallet
cd webapp && yarn build && cd ..

if [ $? -ne 0 ]; then
  echo "❌ Failed to build the application"
  exit 1
fi

echo "✅ Installation completed successfully!"

echo ""
echo "📝 Next Steps:"
echo "1. Your application is available in: $INSTALL_DIR"
echo "2. To start the server, run: $INSTALL_DIR/start-server.sh"
echo ""