#!/bin/bash

# Adventure Chunk Update Script
# Use this to deploy updates to your EC2 instance

set -e

echo "🔄 Updating Adventure Chunk..."

cd /var/www/adventure-chunk

# Pull latest changes
git pull origin main

# Update frontend
echo "⚛️ Building frontend..."
cd client
npm install
npm run build

# Update backend dependencies
echo "🐍 Updating backend..."
cd ../server
source venv/bin/activate
pip install -r requirements.txt

# Restart services
echo "🔄 Restarting services..."
cd ..
pm2 restart adventure-chunk-api

echo "✅ Update complete!"
echo "🌐 Check your app at your EC2 public IP"
