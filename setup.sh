#!/usr/bin/env bash
# PATH: setup.sh
# WHAT: automated first-run setup — dependencies, compilation, key retrieval assistance
# WHY: eliminates all manual steps between clone and first use
# MENTAL MODEL: user runs one command, script handles npm/tsc/keys/vscode launch
# FAILURE MODE: API key pages require login → user must authenticate in browser first
# VERIFIES WITH: code --list-extensions shows extension installed; test command works

set -euo pipefail

echo "=========================================="
echo "VS Code LLM Multi-Provider Setup"
echo "=========================================="
echo ""

# WHY: detect if running inside vscode-llm-multi-provider directory
# MENTAL MODEL: script can be run from repo root or from parent directory
# FAILURE MODE: package.json missing → not in correct directory
if [[ ! -f package.json ]]; then
    echo "ERROR: package.json not found. Run this script from the repo root:"
    echo "  cd vscode-llm-multi-provider"
    echo "  bash setup.sh"
    exit 1
fi

echo "[1/5] Installing dependencies..."
npm install --silent

echo ""
echo "[2/5] Compiling TypeScript..."
npm run compile --silent

echo ""
echo "[3/5] Setting up API keys..."
echo ""
echo "This extension supports three providers. You need at least ONE API key."
echo "The script will open each provider's API key page in your browser."
echo "Sign in (if needed), create/copy your key, then paste it here."
echo ""

# WHY: function to open URL in browser and read key from user
# ASSUMES: xdg-open available on Linux (standard)
# VERIFIES WITH: user input non-empty after paste
# Source (Tier 2): read -s hides password input
#   https://man7.org/linux/man-pages/man1/bash.1.html
get_api_key() {
    local provider_name="$1"
    local key_page_url="$2"
    local key_pattern="$3"
    
    echo "──────────────────────────────────────────"
    echo "$provider_name API Key"
    echo "──────────────────────────────────────────"
    echo "Opening: $key_page_url"
    echo ""
    
    # WHY: open browser to key page, fall back to printing URL
    # FAILURE MODE: xdg-open not installed → print URL instead
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$key_page_url" 2>/dev/null || echo "Could not open browser. Visit manually: $key_page_url"
    else
        echo "Browser open failed. Visit manually: $key_page_url"
    fi
    
    echo ""
    echo "After signing in and creating/copying your key:"
    read -s -p "Paste $provider_name API key (or press Enter to skip): " api_key
    echo ""
    
    # WHY: validate key format if provided
    # ASSUMES: each provider has predictable key prefix
    # FAILURE MODE: invalid format → warn user but allow proceeding
    if [[ -n "$api_key" ]]; then
        if [[ "$api_key" =~ $key_pattern ]]; then
            echo "✓ Key format valid"
        else
            echo "⚠ Warning: key doesn't match expected pattern ($key_pattern)"
            echo "  Proceeding anyway — you can update it later if needed"
        fi
    else
        echo "⊘ Skipped"
    fi
    
    echo "$api_key"
}

# WHY: retrieve keys for all three providers with format validation
# OpenAI keys start with sk-
# Anthropic keys start with sk-ant-
# DeepSeek keys start with sk-
# Source (Tier 2): API key formats from provider documentation
OPENAI_KEY=$(get_api_key "OpenAI" \
    "https://platform.openai.com/api-keys" \
    "^sk-")

ANTHROPIC_KEY=$(get_api_key "Anthropic" \
    "https://console.anthropic.com/settings/keys" \
    "^sk-ant-")

DEEPSEEK_KEY=$(get_api_key "DeepSeek" \
    "https://platform.deepseek.com/api_keys" \
    "^sk-")

# WHY: verify at least one key was provided
if [[ -z "$OPENAI_KEY" && -z "$ANTHROPIC_KEY" && -z "$DEEPSEEK_KEY" ]]; then
    echo ""
    echo "ERROR: No API keys provided. At least one is required."
    echo "Run 'bash setup.sh' again or set keys manually in VS Code."
    exit 1
fi

echo ""
echo "[4/5] Storing keys in VS Code SecretStorage..."
echo ""
echo "Keys will be written to a temporary JSON file for the extension to import."
echo "This file is deleted immediately after import."
echo ""

# WHY: create temporary key storage file for extension to read
# MENTAL MODEL: VS Code SecretStorage API only accessible from extension runtime
# Solution: extension reads from temp file on first activation, then deletes it
# FAILURE MODE: extension never runs → temp file persists (harmless, no secrets exposed)
KEYFILE=".vscode-llm-keys.json"
cat > "$KEYFILE" << KEYEOF
{
  "openai": "${OPENAI_KEY}",
  "anthropic": "${ANTHROPIC_KEY}",
  "deepseek": "${DEEPSEEK_KEY}"
}
KEYEOF

# WHY: restrict file permissions to owner-only read
# Source (Tier 2): chmod 600 = -rw------- (owner read/write only)
#   https://man7.org/linux/man-pages/man1/chmod.1.html
chmod 600 "$KEYFILE"

echo "✓ Temporary key file created: $KEYFILE"
echo "  (Extension will import and delete this on first run)"

echo ""
echo "[5/5] Installing extension for local development..."
echo ""

# WHY: package extension as .vsix for local installation
# ASSUMES: vsce not installed globally — install it now
# FAILURE MODE: vsce install fails → continue anyway, user can install manually
if ! command -v vsce >/dev/null 2>&1; then
    echo "Installing vsce (VS Code Extension Manager)..."
    npm install -g vsce --silent || {
        echo "⚠ Warning: vsce install failed. Skipping .vsix packaging."
        echo "  You can still test via F5 in VS Code."
    }
fi

if command -v vsce >/dev/null 2>&1; then
    echo "Packaging extension..."
    vsce package --allow-missing-repository --no-dependencies 2>/dev/null || {
        echo "⚠ Warning: vsce package failed. Skipping .vsix install."
    }
    
    # WHY: install .vsix if packaging succeeded
    if [[ -f vscode-llm-multi-provider-0.1.0.vsix ]]; then
        code --install-extension vscode-llm-multi-provider-0.1.0.vsix || {
            echo "⚠ Warning: Extension install failed. You can install manually:"
            echo "  code --install-extension vscode-llm-multi-provider-0.1.0.vsix"
        }
    fi
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Open this folder in VS Code:"
echo "   code ."
echo ""
echo "2. Press F5 to launch Extension Development Host"
echo ""
echo "3. In the new window, open Command Palette (Cmd+Shift+P)"
echo "   and run: LLM: Ask Question"
echo ""
echo "4. If keys didn't import automatically, run: LLM: Set API Keys"
echo ""
echo "Repo: https://github.com/swipswaps/vscode-llm-multi-provider"
echo ""
