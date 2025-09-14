#!/bin/bash

# Script to update EC2 server configuration for standalone operation
# Usage: ./deploy/update-ec2-config.sh

echo "🔧 Updating EC2 server configuration for standalone operation..."

# Update client .env file
echo "📝 Updating client .env file..."
cd /var/www/adventure-chunk/client

# Create .env file with EC2 server URL
cat > .env << EOF
VITE_MAPBOX_PUBLIC_KEY=pk.your_actual_mapbox_key_here
VITE_API_BASE_URL=http://3.25.152.237
EOF

echo "✅ Updated client .env file"

# Rebuild frontend
echo "🔨 Rebuilding frontend..."
npm run build

echo "🔄 Reloading nginx..."
sudo systemctl reload nginx

echo "✅ EC2 server configuration updated!"
echo "📱 Your phone can now access the app at: http://3.25.152.237"
echo ""
echo "⚠️  Don't forget to update the VITE_MAPBOX_PUBLIC_KEY in /var/www/adventure-chunk/client/.env"
echo "   with your actual Mapbox public key (starts with pk.)"
