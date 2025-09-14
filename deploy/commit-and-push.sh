#!/bin/bash

# Script to commit and push changes to GitHub
echo "🚀 Committing and pushing Adventure Chunk updates..."

# Add all changes
git add .

# Commit with a descriptive message
git commit -m "Fix API URL configuration for EC2 deployment

- Ensure frontend uses VITE_API_BASE_URL environment variable
- Remove hardcoded localhost:8000 references
- Configure for standalone EC2 deployment"

# Push to GitHub
git push origin main

echo "✅ Changes pushed to GitHub!"
echo "🔄 The EC2 server should automatically pull and rebuild in ~5 minutes"
echo "🌐 Your app should then work at http://3.25.152.237"
