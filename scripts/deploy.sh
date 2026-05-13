#!/bin/bash
# Usage: bash scripts/deploy.sh "your commit message"
# Commits all changes and pushes to GitHub → Railway auto-deploys

MESSAGE="${1:-Deploy $(date '+%Y-%m-%d %H:%M')}"

echo "📦 Staging all changes..."
git add -A

echo "💬 Committing: $MESSAGE"
git commit -m "$MESSAGE" || echo "Nothing new to commit"

echo "🚀 Pushing to GitHub..."
if [ -n "$GITHUB_TOKEN" ]; then
  REMOTE_URL=$(git remote get-url origin | sed 's|https://|https://'"$GITHUB_TOKEN"'@|')
  git push "$REMOTE_URL" main
else
  git push origin main
fi

echo "✅ Done! Railway will auto-deploy in ~2 minutes."
echo "   Monitor at: https://railway.app"
