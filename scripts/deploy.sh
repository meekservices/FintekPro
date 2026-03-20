#!/bin/bash
# Usage: bash scripts/deploy.sh "your commit message"
# Commits all changes and pushes to GitHub → Railway auto-deploys

MESSAGE="${1:-Deploy $(date '+%Y-%m-%d %H:%M')}"

echo "📦 Staging all changes..."
git add -A

echo "💬 Committing: $MESSAGE"
git commit -m "$MESSAGE"

echo "🚀 Pushing to GitHub..."
git push origin main

echo "✅ Done! Railway will auto-deploy in ~2 minutes."
echo "   Monitor at: https://railway.app"
