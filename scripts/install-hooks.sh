#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# FintekPro Git Hooks Installer
# ─────────────────────────────────────────────────────────────────────────────
# Run once after cloning: bash scripts/install-hooks.sh
# Installs pre-commit and pre-push quality gates.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

echo "🔧 Installing FintekPro git hooks..."

# Ensure hooks directory exists
mkdir -p "$HOOKS_DIR"

# ── pre-commit ────────────────────────────────────────────────────────────────
cat > "$HOOKS_DIR/pre-commit" << 'HOOK'
#!/bin/bash
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
exec bash "$PROJECT_ROOT/scripts/pre-commit-check.sh"
HOOK

# ── pre-push ──────────────────────────────────────────────────────────────────
cat > "$HOOKS_DIR/pre-push" << 'HOOK'
#!/bin/bash
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
export PRECOMMIT_MODE="push"
exec bash "$PROJECT_ROOT/scripts/pre-commit-check.sh"
HOOK

# Make executable
chmod +x "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-push"
chmod +x "$SCRIPT_DIR/pre-commit-check.sh"

echo "✅ Hooks installed:"
echo "   .git/hooks/pre-commit → scripts/pre-commit-check.sh"
echo "   .git/hooks/pre-push   → scripts/pre-commit-check.sh"
echo ""
echo "💡 To bypass in an emergency: SKIP_PRECOMMIT=1 git commit -m \"...\""
echo "   (bypass events are logged to .precommit-bypass.log)"
