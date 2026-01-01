#!/bin/bash
# Build Android app locally using EAS in WSL2
# Usage: ./scripts/build-android-local.sh [profile]
# Profiles: development, preview, production (default: production)

set -e

PROFILE="${1:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MOBILE_DIR="$PROJECT_ROOT/apps/mobile"

echo "=========================================="
echo "  Sauci Android Local Build (WSL2)"
echo "  Profile: $PROFILE"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_dependency() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}✗ $1 is not installed${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $1 found${NC}"
        return 0
    fi
}

# Check dependencies
echo ""
echo "Checking dependencies..."
DEPS_OK=true

check_dependency "node" || DEPS_OK=false
check_dependency "npm" || DEPS_OK=false
check_dependency "java" || DEPS_OK=false

# Check Java version (need JDK 17)
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d'.' -f1)
    if [ "$JAVA_VERSION" -lt 17 ] 2>/dev/null; then
        echo -e "${YELLOW}⚠ Java $JAVA_VERSION found, but JDK 17+ recommended${NC}"
    fi
fi

# Check/set ANDROID_HOME
if [ -z "$ANDROID_HOME" ]; then
    # Try common WSL2 paths to Windows Android SDK
    POSSIBLE_PATHS=(
        "/mnt/c/Users/$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')/AppData/Local/Android/Sdk"
        "$HOME/Android/Sdk"
        "/usr/lib/android-sdk"
    )

    for SDK_PATH in "${POSSIBLE_PATHS[@]}"; do
        if [ -d "$SDK_PATH" ]; then
            export ANDROID_HOME="$SDK_PATH"
            echo -e "${GREEN}✓ Found Android SDK at $ANDROID_HOME${NC}"
            break
        fi
    done

    if [ -z "$ANDROID_HOME" ]; then
        echo -e "${RED}✗ ANDROID_HOME not set and SDK not found${NC}"
        echo "  Install Android SDK or set ANDROID_HOME manually"
        DEPS_OK=false
    fi
else
    echo -e "${GREEN}✓ ANDROID_HOME=$ANDROID_HOME${NC}"
fi

# Set ANDROID_SDK_ROOT (some tools use this)
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# Add platform-tools to PATH
if [ -n "$ANDROID_HOME" ]; then
    export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$PATH"
fi

if [ "$DEPS_OK" = false ]; then
    echo ""
    echo -e "${RED}Missing dependencies. Please install them first:${NC}"
    echo ""
    echo "  # Install Node.js (via nvm)"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "  nvm install 20"
    echo ""
    echo "  # Install JDK 17"
    echo "  sudo apt update && sudo apt install openjdk-17-jdk"
    echo ""
    echo "  # Install Android SDK (or use Windows SDK via /mnt/c/...)"
    echo "  sudo apt install android-sdk"
    echo ""
    exit 1
fi

# Navigate to mobile app
cd "$MOBILE_DIR"
echo ""
echo "Working directory: $(pwd)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "Installing dependencies..."
    npm ci
fi

# Check if eas-cli is available
if ! command -v eas &> /dev/null; then
    echo ""
    echo "Installing EAS CLI..."
    npm install -g eas-cli
fi

# Create output directory
OUTPUT_DIR="$MOBILE_DIR/build-output"
mkdir -p "$OUTPUT_DIR"

# Run the build
echo ""
echo "Starting EAS local build..."
echo "This may take 10-20 minutes..."
echo ""

eas build \
    --local \
    --platform android \
    --profile "$PROFILE" \
    --output "$OUTPUT_DIR/sauci-$PROFILE.aab"

echo ""
echo "=========================================="
echo -e "${GREEN}Build complete!${NC}"
echo "Output: $OUTPUT_DIR/sauci-$PROFILE.aab"
echo "=========================================="
