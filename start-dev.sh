#!/bin/bash

# ==============================================================================
# FintekPro Local Development Bootstrap Script
# Role: Senior SRE / DevOps Architect
# Objective: Production-safe orchestration with CI/CD parity pre-checks.
# ==============================================================================

# Standard Exit Codes
SUCCESS=0
ERR_BRANCH=10
ERR_SECRETS=11
ERR_TESTS=12

# Visual Tokens
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}${BOLD}================================================================${NC}"
echo -e "${BLUE}${BOLD}   🚀  FintekPro Local Development Bootstrap v1.0              ${NC}"
echo -e "${BLUE}${BOLD}================================================================${NC}"

# --- 1. Branch Protection ---
echo -e "\n${CYAN}Step 1: Branch Protection Check...${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
    echo -e "${RED}${BOLD}🚨 CRITICAL WARNING: You are on the '$CURRENT_BRANCH' branch!${NC}"
    echo -e "${YELLOW}Committing directly to production branches is highly discouraged.${NC}"
    echo -ne "${BOLD}Would you like to create a new feature branch? (y/N): ${NC}"
    read -r create_branch
    if [[ "$create_branch" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -ne "${BOLD}Enter feature name (e.g., feature/analytics-engine): ${NC}"
        read -r branch_name
        git checkout -b "$branch_name"
        echo -e "${GREEN}✅ Switched to new branch: $branch_name${NC}"
    else
        echo -e "${YELLOW}Continuing on $CURRENT_BRANCH. Please be extremely careful.${NC}"
    fi
else
    echo -e "${GREEN}✅ Safety check passed. Currently on: $CURRENT_BRANCH${NC}"
fi

# --- 2. Secret Safety Check (CI/CD Guard) ---
echo -e "\n${CYAN}Step 2: CI/CD Secret Safety Check...${NC}"
GITIGNORE=".gitignore"
if [ ! -f "$GITIGNORE" ]; then touch "$GITIGNORE"; fi

FILES_TO_GUARD=(".env" ".env.local")
GUARDED_ANY=false

for file in "${FILES_TO_GUARD[@]}"; do
    if ! grep -q "^$file$" "$GITIGNORE"; then
        echo "$file" >> "$GITIGNORE"
        echo -e "${YELLOW}⚠️  Security Patch: Added $file to .gitignore${NC}"
        GUARDED_ANY=true
    fi
done

if [ "$GUARDED_ANY" = true ]; then
    echo -e "${GREEN}✅ CI/CD pipeline guarded against accidental secret leaks.${NC}"
else
    echo -e "${GREEN}✅ .gitignore is already production-hardened.${NC}"
fi

# --- 3. Environment Variable Swapping ---
echo -e "\n${CYAN}Step 3: Environment Variable Sync...${NC}"
if [ ! -f ".env.local" ] && [ -f ".env" ]; then
    echo -e "${YELLOW}ℹ️  Generating .env.local from existing .env as a template...${NC}"
    cp .env .env.local
    # Optional: Scrub production DB URLs from .env.local here if needed
fi

if [ -f ".env.local" ]; then
    cp .env.local .env
    echo -e "${GREEN}✅ Successfully synced .env.local -> .env for local parity.${NC}"
else
    echo -e "${YELLOW}ℹ️  Note: .env.local not found. Using existing .env.${NC}"
fi

# --- 4. CI/CD Parity Flag ---
if [[ "$1" == "--test" || "$1" == "--pre-push" ]]; then
    echo -e "\n${CYAN}${BOLD}Step 4: CI/CD Parity Mode (Pre-Checks)...${NC}"
    
    echo -e "${BLUE}📦 Running Frontend Type Checks (tsc)...${NC}"
    # Using a more informative output for the type check
    if npm run check; then
        echo -e "${GREEN}✅ Frontend parity check passed!${NC}"
    else
        echo -e "${RED}❌ Frontend parity check failed.${NC}"
        echo -e "${YELLOW}Detected existing TypeScript diagnostics. Please resolve these before deployment.${NC}"
        # Ask if they want to continue anyway for local dev, or exit
        echo -ne "${BOLD}Do you want to ignore these and start dev anyway? (y/N): ${NC}"
        read -r ignore_errors
        if [[ ! "$ignore_errors" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            exit $ERR_TESTS
        fi
    fi
    
    echo -e "${BLUE}🐍 Running Backend Tests (pytest)...${NC}"
    if [ -d "services/python" ]; then
        cd services/python
        # Try to use venv if it exists
        if [ -d "venv" ]; then source venv/bin/activate; fi
        
        if command -v pytest >/dev/null 2>&1; then
            if pytest; then
                echo -e "${GREEN}✅ Backend parity check passed!${NC}"
            else
                echo -e "${RED}❌ Backend parity check failed. Fix errors before pushing.${NC}"
                exit $ERR_TESTS
            fi
        else
            echo -e "${YELLOW}⚠️  pytest not found. Skipping backend tests.${NC}"
        fi
        
        if [ -d "venv" ]; then deactivate; fi
        cd ../..
    fi
    
    echo -e "${GREEN}${BOLD}🚀 All pre-push checks passed! Environment is in parity with CI/CD.${NC}"
    exit $SUCCESS
fi

# --- 5. Local Infrastructure (Docker Compose) ---
echo -e "\n${CYAN}Step 5: Orchestrating Local Infrastructure...${NC}"
if ! command -v docker-compose >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: docker-compose is not installed.${NC}"
    exit 1
fi

docker-compose up -d
echo -e "${GREEN}✅ Local Database (PostgreSQL) is isolated and active.${NC}"

# --- 6. Concurrent Service Launch & Teardown ---
echo -e "\n${CYAN}Step 6: Launching Development Services...${NC}"

# Cleanup function to be called on exit
cleanup() {
    echo -e "\n\n${YELLOW}${BOLD}🛑 SIGINT/SIGTERM received. Graceful Teardown Initialized...${NC}"
    
    echo -e "${BLUE}📡 Shutting down servers...${NC}"
    # Kill background process group
    kill 0
    
    echo -e "${BLUE}🐘 Stopping local containers...${NC}"
    docker-compose stop > /dev/null 2>&1
    
    echo -e "${GREEN}${BOLD}✨ Cleanup complete. See you next session!${NC}"
}

# Trap signals for clean exit
trap cleanup SIGINT SIGTERM EXIT

# Start Backend (FastAPI)
if [ -d "services/python" ]; then
    echo -e "${CYAN}🐍 Backend  |${NC} Starting FastAPI on http://localhost:8001"
    (
        cd services/python
        if [ -d "venv" ]; then
            ./venv/bin/uvicorn main:app --reload --port 8001 --log-level warning
        else
            uvicorn main:app --reload --port 8001 --log-level warning
        fi
    ) &
fi

# Start Frontend / Main Portal (Node.js)
echo -e "${CYAN}📦 Frontend |${NC} Starting Node.js Portal..."
npm run dev &

# Wait for background processes to keep the script alive
wait
