#!/bin/bash

# Adventure Chunk EC2 Setup Script
# Run this on a fresh Ubuntu 22.04 LTS EC2 instance

set -e

echo "🚀 Setting up Adventure Chunk on EC2..."

# Update system
sudo apt update
sudo apt upgrade -y

# Install Node.js 18 LTS
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.11
echo "🐍 Installing Python 3.11..."
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip

# Install nginx
echo "🌐 Installing Nginx..."
sudo apt install -y nginx

# Install PM2 for process management
echo "⚡ Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "📁 Setting up application directory..."
sudo mkdir -p /var/www/adventure-chunk
sudo chown ubuntu:ubuntu /var/www/adventure-chunk
cd /var/www/adventure-chunk

# Clone the repository (you'll need to replace this with your actual repo URL)
echo "📥 Cloning repository..."
git clone https://github.com/your-username/adventure-chunk.git .

# Set up Python backend
echo "🔧 Setting up Python backend..."
cd server
python3.11 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn aiohttp shapely pyproj python-dotenv

# Set up Node.js frontend
echo "⚛️ Setting up React frontend..."
cd ../client
npm install
npm run build

echo "✅ Basic setup complete!"
echo "Next steps:"
echo "1. Add your API keys to /var/www/adventure-chunk/server/.env"
echo "2. Run the configuration script: ./configure-ec2.sh"
