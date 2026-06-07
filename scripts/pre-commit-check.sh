#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# FintekPro Pre-Commit / Pre-Deploy Quality Gate
# ─────────────────────────────────────────────────────────────────────────────
# Enforces zero problems before a commit, push, or deploy:
#   1. Biome format + lint --apply  (auto-fix staged client/shared files)
#   2. ESLint                       (server TS — errors only, warnings allowed)
#   3. TypeScript tsc --noEmit      (full type-check across whole project)
#
# Usage:
#   From git pre-commit hook  → called automatically by git commit
#   From CI / deploy script   → bash scripts/pre-commit-check.sh
#
# Set SKIP_PRECOMMIT=1 to bypass (emergency only — leaves an audit trail).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Emergency bypass (must be explicit, leaves log entry) ────────────────────
if [[ "${SKIP_PRECOMMIT:-0}" == "1" ]]; then
  echo "⚠️  [pre-commit] SKIP_PRECOMMIT=1 — gate bypassed. Audit entry logged."
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") BYPASS user=$(git config user.email) commit=$(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')" \
    >> "$PROJECT_ROOT/.precommit-bypass.log"
  exit 0
fi

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS="${GREEN}✅${NC}"; FAIL="${RED}❌${NC}"; INFO="${BLUE}ℹ️ ${NC}"; WARN="${YELLOW}⚠️ ${NC}"

ERRORS=0

# ── Helper: section header ────────────────────────────────────────────────────
section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Biome: format + lint --apply on staged files
# ─────────────────────────────────────────────────────────────────────────────
section "Step 1/3 — Biome format + lint (auto-fix staged files)"

# Collect staged .ts/.tsx/.js/.jsx files (client + shared)
STAGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null \
  | grep -E '\.(ts|tsx|js|jsx)$' \
  | grep -v '^server/' \
  | tr '\n' ' ' || true)

if [[ -n "$STAGED" ]]; then
  echo -e "${INFO}Biome auto-fixing: $STAGED"

  # Auto-fix: format + safe lint fixes (use scoped package to avoid old global stub)
  BIOME_BIN="$(npm bin 2>/dev/null)/biome"
  if [[ ! -f "$BIOME_BIN" ]]; then
    BIOME_BIN="npx --yes @biomejs/biome"
  fi

  # Auto-fix: format + safe lint fixes
  # NOTE: biome check --apply exits 0 (no changes) or 1 (fixes applied) — both are OK.
  # Exit 2+ means a real Biome error. We must NOT let exit 1 kill the script via pipefail.
  BIOME_APPLY_EXIT=0
  $BIOME_BIN check --apply --no-errors-on-unmatched $STAGED 2>&1 || BIOME_APPLY_EXIT=$?
  if [[ "$BIOME_APPLY_EXIT" -ge 2 ]]; then
    echo -e "${FAIL} Biome --apply failed with exit code $BIOME_APPLY_EXIT"
    ERRORS=$((ERRORS + 1))
  elif [[ "$BIOME_APPLY_EXIT" -eq 1 ]]; then
    echo -e "${WARN} Biome applied fixes — re-staging changed files"
  else
    echo -e "${PASS} Biome auto-fix complete (no changes needed)"
  fi

  # Re-stage any files Biome modified
  git add $STAGED 2>/dev/null || true

  # Final check — hard error on remaining issues
  echo -e "${INFO}Running Biome final check (errors block commit)..."
  if $BIOME_BIN check --no-errors-on-unmatched $STAGED 2>&1; then
    echo -e "${PASS} Biome: zero errors on staged client/shared files"
  else
    echo -e "${FAIL} Biome: unresolved errors in staged files — fix before committing"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "${INFO}No staged client/shared TS/JS files — skipping Biome"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — ESLint: server TS changed files (errors = block, warnings = allow)
# ─────────────────────────────────────────────────────────────────────────────
section "Step 2/3 — ESLint (server — errors only)"

SERVER_STAGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null \
  | grep -E '^server/.*\.ts$' \
  | tr '\n' ' ' || true)

if [[ -n "$SERVER_STAGED" ]]; then
  echo -e "${INFO}ESLint checking: $SERVER_STAGED"
  # --max-warnings=-1 means warnings do NOT cause a non-zero exit; only errors do
  if NODE_ENV=production npx eslint --max-warnings=-1 $SERVER_STAGED 2>&1; then
    echo -e "${PASS} ESLint: zero errors in staged server files"
  else
    echo -e "${FAIL} ESLint: errors found — fix before committing"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "${INFO}No staged server TS files — skipping ESLint"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — TypeScript tsc --noEmit (full project type check)
# ─────────────────────────────────────────────────────────────────────────────
section "Step 3/3 — TypeScript compile check (tsc --noEmit)"

echo -e "${INFO}Running tsc --noEmit --skipLibCheck ..."
TSC_OUT=$(NODE_OPTIONS="--max-old-space-size=6144" npx tsc --noEmit --skipLibCheck 2>&1 || true)
TSC_ERRORS=$(echo "$TSC_OUT" | grep -c "error TS" || true)

if [[ "$TSC_ERRORS" -eq 0 ]]; then
  echo -e "${PASS} TypeScript: zero type errors"
else
  echo -e "${FAIL} TypeScript: $TSC_ERRORS error(s) found:"
  echo "$TSC_OUT" | grep "error TS" | head -20
  ERRORS=$((ERRORS + 1))
fi

# ─────────────────────────────────────────────────────────────────────────────
# Result
# ─────────────────────────────────────────────────────────────────────────────
echo ""
if [[ "$ERRORS" -eq 0 ]]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${PASS}  ${GREEN}All quality gates passed — safe to commit / deploy${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 0
else
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${FAIL}  ${RED}$ERRORS gate(s) failed — commit/deploy BLOCKED${NC}"
  echo -e "${RED}    Fix all errors above, then re-commit.${NC}"
  echo -e "${RED}    Emergency bypass: SKIP_PRECOMMIT=1 git commit ...${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 1
fi
