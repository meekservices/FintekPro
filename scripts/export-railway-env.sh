#!/bin/bash
# Run this in the Replit Shell:  bash scripts/export-railway-env.sh
# Copy the output, then paste into:
#   Railway → your FintekPro service → Variables → RAW EDITOR
#
# The script only prints app secrets — it skips Replit-internal vars,
# Nix/Poetry build vars, and system vars that don't belong on Railway.

# Vars to skip (Replit-internal / system / build-time only)
SKIP=(
  REPL_HOME REPL_ID REPL_IDENTITY REPL_IDENTITY_KEY REPL_LANGUAGE
  REPL_OWNER REPL_OWNER_ID REPL_PUBKEYS REPL_SLUG
  REPLIT_BASHRC REPLIT_CLI REPLIT_CLUSTER REPLIT_CONNECTORS_HOSTNAME
  REPLIT_CONTAINER REPLIT_DB_URL REPLIT_DEV_DOMAIN REPLIT_DOMAINS
  REPLIT_ENVIRONMENT REPLIT_EXPO_DEV_DOMAIN REPLIT_GITSAFE_ENABLED
  REPLIT_GITSAFE_EXISTING_REPLS_ENABLED REPLIT_GITSAFE_NEW_REPLS_ENABLED
  REPLIT_HEIMDALL_ADDR REPLIT_HELIUM_ENABLED REPLIT_LD_AUDIT
  REPLIT_LD_LIBRARY_PATH REPLIT_MODE REPLIT_NIX_CHANNEL REPLIT_PID1_VERSION
  REPLIT_PID2 REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE REPLIT_PYTHON_LD_LIBRARY_PATH
  REPLIT_PYTHONPATH REPLIT_RIPPKGS_INDICES REPLIT_RTLD_LOADER REPLIT_RUN_PATH
  REPLIT_SESSION REPLIT_SUBCLUSTER REPLIT_USER REPLIT_USERID REPLIT_USER_RUN
  CONNECTORS_HOSTNAME REPLIT_CONNECTORS_HOSTNAME
  # Replit Object Storage — different on Railway
  DEFAULT_OBJECT_STORAGE_BUCKET_ID PRIVATE_OBJECT_DIR PUBLIC_OBJECT_SEARCH_PATHS
  # Replit local Postgres (Helium) — Railway uses Neon
  PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD
  # Railway sets PORT automatically
  PORT
  # GitHub token is Replit-scoped
  GITHUB_TOKEN GITHUB_ACTIONS
  # System / shell / terminal
  PATH HOME USER SHELL TERM DISPLAY COLORTERM TERM_PROGRAM TERM_PROGRAM_VERSION
  PWD OLDPWD SHLVL HISTFILE HISTSIZE HISTFILESIZE HISTCONTROL PROMPT_DIRTRIM
  PAGER GIT_PAGER GIT_EDITOR GIT_ASKPASS GIT_CONFIG_GLOBAL GIT_TERMINAL_PROMPT
  LANG LC_ALL LC_CTYPE LOCALE_ARCHIVE TZDIR
  # Nix build vars
  NIX_PATH NIX_PROFILES NIX_CFLAGS_COMPILE NIX_LDFLAGS NIXPKGS_ALLOW_UNFREE
  NIX_CC NIXPKGS_PATH CFLAGS LDFLAGS PKG_CONFIG_PATH PKG_CONFIG_PATH_FOR_TARGET
  GI_TYPELIB_PATH LIBGL_DRIVERS_PATH LD_AUDIT GLIBC_TUNABLES
  __EGL_VENDOR_LIBRARY_FILENAMES
  # Poetry / pip / Python build
  POETRY_CACHE_DIR POETRY_CONFIG_DIR POETRY_DOWNLOAD_WITH_CURL
  POETRY_INSTALLER_MODERN_INSTALLATION POETRY_PIP_FROM_PATH POETRY_PIP_NO_ISOLATE
  POETRY_PIP_NO_PREFIX POETRY_PIP_USE_PIP_CACHE POETRY_USE_USER_SITE
  POETRY_VIRTUALENVS_CREATE PIP_CONFIG_FILE
  PYTHONUSERBASE PYTHONPATH REPLIT_PYTHONPATH REPLIT_PYTHON_LD_LIBRARY_PATH
  UV_PROJECT_ENVIRONMENT UV_PYTHON_DOWNLOADS UV_PYTHON_PREFERENCE
  # XDG / misc system
  XDG_CACHE_HOME XDG_CONFIG_HOME XDG_DATA_DIRS XDG_DATA_HOME
  DOCKER_CONFIG INSTAGRAM_OAUTH
  # Node build
  NODE_PATH NODE_VERSION npm_node_execpath npm_execpath
)

skip_set=" ${SKIP[*]} "

echo "# ============================================================"
echo "# FintekPro → Railway environment variables"
echo "# Generated: $(date -u)"
echo "#"
echo "# PASTE THIS ENTIRE OUTPUT into:"
echo "#   Railway → FintekPro service → Variables → RAW EDITOR"
echo "#"
echo "# IMPORTANT: Edit these three lines before pasting:"
echo "#   NODE_ENV=production"
echo "#   APP_URL=https://YOUR-RAILWAY-DOMAIN.railway.app"
echo "#   PYTHON_SERVICE_URL=https://YOUR-FINTEK-ANALYTICS.railway.app"
echo "# ============================================================"
echo ""

# Always add Railway-specific overrides first
echo "NODE_ENV=production"
echo "APP_URL=https://fintekpro.com"
echo "APP_DOMAIN=fintekpro.com"
echo "PYTHON_SERVICE_URL=REPLACE_WITH_FINTEK_ANALYTICS_RAILWAY_URL"
echo ""

# Export all other vars, skipping the blocklist
while IFS='=' read -r key value; do
  [[ -z "$key" ]] && continue
  [[ "$key" == _* ]] && continue
  [[ "$key" =~ ^npm_ ]] && continue
  if [[ "$skip_set" == *" $key "* ]]; then
    continue
  fi
  # Escape newlines in values (Railway Raw Editor needs single-line values)
  value_escaped="${value//$'\n'/\\n}"
  echo "${key}=${value_escaped}"
done < <(env | sort)
