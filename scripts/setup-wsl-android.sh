#!/bin/bash
# Setup WSL2 environment for Android builds
# Run this once to install all dependencies

set -e

echo "=========================================="
echo "  WSL2 Android Build Environment Setup"
echo "=========================================="

# Update system
echo ""
echo "Updating system packages..."
sudo apt-get update

# Install JDK 17 (try multiple approaches)
echo ""
echo "Installing OpenJDK 17..."
if ! sudo apt-get install -y openjdk-17-jdk 2>/dev/null; then
    echo "Adding Ubuntu toolchain PPA for JDK 17..."
    sudo apt-get install -y software-properties-common
    sudo add-apt-repository -y ppa:openjdk-r/ppa
    sudo apt-get update
    sudo apt-get install -y openjdk-17-jdk
fi

# Set JAVA_HOME
echo ""
echo "Configuring JAVA_HOME..."
JAVA_PATH=$(dirname $(dirname $(readlink -f $(which java))))
if ! grep -q "JAVA_HOME" ~/.bashrc; then
    echo "export JAVA_HOME=$JAVA_PATH" >> ~/.bashrc
fi
export JAVA_HOME=$JAVA_PATH
echo "JAVA_HOME=$JAVA_HOME"

# Install build essentials
echo ""
echo "Installing build tools..."
sudo apt-get install -y build-essential curl git unzip

# Install Node.js via nvm
echo ""
if command -v node &> /dev/null; then
    echo "Node.js already installed: $(node -v)"
else
    echo "Installing Node.js via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

    # Load nvm for this session
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

    nvm install 20
    nvm use 20
fi

# Install EAS CLI
echo ""
echo "Installing EAS CLI..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
npm install -g eas-cli

# Configure Android SDK path (use Windows SDK)
echo ""
echo "Configuring Android SDK..."
WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r\n')
WIN_SDK_PATH="/mnt/c/Users/$WIN_USER/AppData/Local/Android/Sdk"

if [ -d "$WIN_SDK_PATH" ]; then
    echo "Found Windows Android SDK at: $WIN_SDK_PATH"
    if ! grep -q "ANDROID_HOME" ~/.bashrc; then
        echo "export ANDROID_HOME=\"$WIN_SDK_PATH\"" >> ~/.bashrc
        echo "export ANDROID_SDK_ROOT=\"$WIN_SDK_PATH\"" >> ~/.bashrc
        echo 'export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"' >> ~/.bashrc
    fi
else
    echo "Windows Android SDK not found at: $WIN_SDK_PATH"
    echo "You may need to set ANDROID_HOME manually in ~/.bashrc"
fi

echo ""
echo "=========================================="
echo "  Setup complete!"
echo "=========================================="
echo ""
echo "Run this to reload your shell:"
echo "  source ~/.bashrc"
echo ""
echo "Then build with:"
echo "  cd /mnt/i/Projects/Sauci"
echo "  ./scripts/build-android-local.sh"
echo ""
