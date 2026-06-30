#!/bin/bash
cd ~/StudyBridge
git add -A
git commit -m "${1:-update: $(date '+%Y-%m-%d %H:%M')}"
git push origin main
echo "✅ Pushed to GitHub!"
