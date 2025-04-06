#!/usr/bin/env bash
set -euo pipefail

APP_NAME="runepool-hotwallet"
INSTALL_DIR="/opt/$APP_NAME"
BIN_LINK="/usr/local/bin/$APP_NAME"
VERSION="latest"

# Parse CLI args
for ((i=1; i<=$#; i++)); do
  arg="${!i}"
  case "$arg" in
    --version)
      next=$((i+1))
      VERSION="${!next:-latest}"
      ;;
  esac
done

# Detect OS/ARCH
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')
TARBALL="$APP_NAME-${OS}.tar.gz"

# GitHub release URL
if [[ "$VERSION" == "latest" ]]; then
  BASE_URL="https://github.com/runepool/hotwallet-install/releases/latest/download"
else
  BASE_URL="https://github.com/runepool/hotwallet-install/releases/download/$VERSION"
fi

DOWNLOAD_URL="$BASE_URL/$TARBALL"

echo "⬇️  Downloading $TARBALL from $DOWNLOAD_URL..."
curl -fL "$DOWNLOAD_URL" -o "$TARBALL"

# 🔓 Unprotect old version if exists
if [[ -d "$INSTALL_DIR" ]]; then
  echo "🔓 Removing immutable flags..."
  if [[ "$OS" == "linux" && -x "$(command -v chattr)" ]]; then
    sudo chattr -i "$INSTALL_DIR"/* || true
  elif [[ "$OS" == "darwin" ]]; then
    sudo chflags nouchg "$INSTALL_DIR"/* || true
  fi
fi

echo "📦 Extracting to $INSTALL_DIR..."
sudo mkdir -p "$INSTALL_DIR"
sudo tar -xzf "$TARBALL" -C "$INSTALL_DIR"
rm "$TARBALL"

# macOS: remove quarantine flag
if [[ "$OS" == "darwin" ]]; then
  echo "🛡️  Removing macOS quarantine flags..."
  sudo xattr -dr com.apple.quarantine "$INSTALL_DIR" || true
fi

# Set permissions
sudo chmod 500 "$INSTALL_DIR/index.js" "$INSTALL_DIR/start.sh"
sudo chmod +x "$INSTALL_DIR/start.sh"
[[ -f "$INSTALL_DIR/node" ]] && sudo chmod 500 "$INSTALL_DIR/node"

# 🔐 Reapply immutability
echo "🔐 Locking binaries..."
if [[ "$OS" == "linux" && -x "$(command -v chattr)" ]]; then
  sudo chattr +i "$INSTALL_DIR/index.js" "$INSTALL_DIR/start.sh"
  [[ -f "$INSTALL_DIR/node" ]] && sudo chattr +i "$INSTALL_DIR/node"
elif [[ "$OS" == "darwin" ]]; then
  sudo chflags uchg "$INSTALL_DIR/index.js" "$INSTALL_DIR/start.sh"
  [[ -f "$INSTALL_DIR/node" ]] && sudo chflags uchg "$INSTALL_DIR/node"
fi

# Create launcher
echo "🔗 Creating launcher at $BIN_LINK..."
echo "#!/bin/bash
exec \"$INSTALL_DIR/start.sh\" \"\$@\"" | sudo tee "$BIN_LINK" > /dev/null
sudo chmod +x "$BIN_LINK"

echo "✅ Installed $APP_NAME (version: $VERSION)"
echo "➡️  Run with: $APP_NAME"
