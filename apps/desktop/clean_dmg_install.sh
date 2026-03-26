#!/bin/bash
# Clean all files related to DMG/production installations of DomeWork
# This removes app data, preferences, caches, and optionally the app itself
# Useful for testing fresh installs or complete uninstallation

set -e

echo "=== ACCOMPLISH DMG INSTALLATION CLEANUP ==="
echo ""

# Parse arguments
REMOVE_APP=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --remove-app)
      REMOVE_APP=true
      shift
      ;;
    --force|-f)
      FORCE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --remove-app    Also remove the application from /Applications"
      echo "  --force, -f     Skip confirmation prompts"
      echo "  --help, -h      Show this help message"
      echo ""
      echo "This script cleans up all user data, caches, and preferences"
      echo "for DomeWork production (DMG) installations."
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Confirm unless --force is used
if [ "$FORCE" != true ]; then
  echo "This will remove all DomeWork user data including:"
  echo "  - App settings and task history"
  echo "  - Cached data and logs"
  echo "  - Keychain credentials"
  if [ "$REMOVE_APP" = true ]; then
    echo "  - The DomeWork application itself"
  fi
  echo ""
  read -p "Are you sure you want to continue? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

echo ""

# Kill any running instances
echo "Stopping any running DomeWork processes..."
pkill -f "DomeWork" 2>/dev/null || true
pkill -f "DomeWork Lite" 2>/dev/null || true
sleep 1

# Application Support directories (electron-store data)
echo "Clearing Application Support data..."
APP_SUPPORT_DIRS=(
  "$HOME/Library/Application Support/DomeWork"
  "$HOME/Library/Application Support/DomeWork Lite"
  "$HOME/Library/Application Support/com.accomplish.desktop"
  "$HOME/Library/Application Support/com.accomplish.lite"
  "$HOME/Library/Application Support/ai.accomplish.desktop"
  "$HOME/Library/Application Support/ai.accomplish.lite"
  "$HOME/Library/Application Support/@accomplish/desktop"
)

for dir in "${APP_SUPPORT_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    echo "  - Removed: $dir"
  fi
done

# Preferences (plist files)
echo "Clearing preferences..."
PLIST_FILES=(
  "$HOME/Library/Preferences/com.accomplish.desktop.plist"
  "$HOME/Library/Preferences/com.accomplish.lite.plist"
  "$HOME/Library/Preferences/com.accomplish.app.plist"
  "$HOME/Library/Preferences/ai.accomplish.desktop.plist"
  "$HOME/Library/Preferences/ai.accomplish.lite.plist"
)

for plist in "${PLIST_FILES[@]}"; do
  if [ -f "$plist" ]; then
    rm -f "$plist"
    echo "  - Removed: $plist"
  fi
done

# Caches
echo "Clearing caches..."
CACHE_DIRS=(
  "$HOME/Library/Caches/DomeWork"
  "$HOME/Library/Caches/DomeWork Lite"
  "$HOME/Library/Caches/com.accomplish.desktop"
  "$HOME/Library/Caches/com.accomplish.lite"
  "$HOME/Library/Caches/ai.accomplish.desktop"
  "$HOME/Library/Caches/ai.accomplish.lite"
  "$HOME/Library/Caches/@accomplish/desktop"
)

for dir in "${CACHE_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    echo "  - Removed: $dir"
  fi
done

# Logs
echo "Clearing logs..."
LOG_DIRS=(
  "$HOME/Library/Logs/DomeWork"
  "$HOME/Library/Logs/DomeWork Lite"
  "$HOME/Library/Logs/ai.accomplish.desktop"
  "$HOME/Library/Logs/ai.accomplish.lite"
  "$HOME/Library/Logs/@accomplish/desktop"
)

for dir in "${LOG_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    echo "  - Removed: $dir"
  fi
done

# Saved Application State
echo "Clearing saved application state..."
SAVED_STATE_DIRS=(
  "$HOME/Library/Saved Application State/com.accomplish.desktop.savedState"
  "$HOME/Library/Saved Application State/com.accomplish.lite.savedState"
  "$HOME/Library/Saved Application State/ai.accomplish.desktop.savedState"
  "$HOME/Library/Saved Application State/ai.accomplish.lite.savedState"
)

for dir in "${SAVED_STATE_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    echo "  - Removed: $dir"
  fi
done

# Keychain entries
echo "Clearing keychain entries..."
KEYCHAIN_SERVICES=(
  "DomeWork"
  "DomeWork Lite"
  "com.accomplish.desktop"
  "com.accomplish.lite"
  "ai.accomplish.desktop"
  "ai.accomplish.lite"
  "@accomplish/desktop"
)
KEYCHAIN_KEYS=("accessToken" "refreshToken" "userId" "tokenExpiresAt" "tokenIntegrity" "deviceSecret")

for service in "${KEYCHAIN_SERVICES[@]}"; do
  for key in "${KEYCHAIN_KEYS[@]}"; do
    if security delete-generic-password -s "$service" -a "$key" 2>/dev/null; then
      echo "  - Removed keychain: $service/$key"
    fi
  done
done

# Also try to delete any remaining keychain items by service name
for service in "${KEYCHAIN_SERVICES[@]}"; do
  # Try to delete all items for this service (may need multiple attempts)
  for _ in {1..10}; do
    if ! security delete-generic-password -s "$service" 2>/dev/null; then
      break
    fi
    echo "  - Removed additional keychain item for: $service"
  done
done

# Remove application if requested
if [ "$REMOVE_APP" = true ]; then
  echo "Removing application..."
  APP_PATHS=(
    "/Applications/DomeWork.app"
    "/Applications/DomeWork Lite.app"
    "$HOME/Applications/DomeWork.app"
    "$HOME/Applications/DomeWork Lite.app"
  )

  for app in "${APP_PATHS[@]}"; do
    if [ -d "$app" ]; then
      rm -rf "$app"
      echo "  - Removed: $app"
    fi
  done
fi

# Clear quarantine attributes if we're keeping the app
if [ "$REMOVE_APP" != true ]; then
  echo "Clearing quarantine attributes (if app exists)..."
  for app in "/Applications/DomeWork.app" "/Applications/DomeWork Lite.app"; do
    if [ -d "$app" ]; then
      xattr -rd com.apple.quarantine "$app" 2>/dev/null && echo "  - Cleared quarantine: $app" || true
    fi
  done
fi

echo ""
echo "=== CLEANUP COMPLETE ==="
echo ""

if [ "$REMOVE_APP" = true ]; then
  echo "All DomeWork data and applications have been removed."
  echo "You can reinstall from the DMG file."
else
  echo "All DomeWork user data has been cleared."
  echo "The app will behave like a fresh installation on next launch."
fi
