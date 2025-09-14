#!/bin/bash

# Adventure Chunk EC2 Configuration Script
# Run this after setup-ec2.sh and adding your API keys

set -e

echo "🔧 Configuring Adventure Chunk services..."

# Create environment files if they don't exist
if [ ! -f /var/www/adventure-chunk/server/.env ]; then
    echo "❌ Please create /var/www/adventure-chunk/server/.env with your API keys first!"
    echo "Example:"
    echo "MAPBOX_API_KEY=your_secret_key_here"
    exit 1
fi

# Create PM2 ecosystem file for backend
cat > /var/www/adventure-chunk/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'adventure-chunk-api',
    cwd: '/var/www/adventure-chunk/server',
    script: 'venv/bin/uvicorn',
    args: 'app.main:app --host 0.0.0.0 --port 8000',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Create nginx configuration
sudo tee /etc/nginx/sites-available/adventure-chunk << 'EOF'
server {
    listen 80;
    server_name _;

    # Serve frontend static files
    location / {
        root /var/www/adventure-chunk/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Handle long requests (for large chunk searches)
        proxy_read_timeout 300s;
        proxy_connect_timeout 30s;
    }

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF

# Enable nginx site
sudo ln -sf /etc/nginx/sites-available/adventure-chunk /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Start backend with PM2
cd /var/www/adventure-chunk
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "✅ Configuration complete!"
echo "🌐 Your Adventure Chunk app should now be available at your EC2 public IP address"
echo "📊 Monitor with: pm2 monit"
echo "📝 View logs with: pm2 logs adventure-chunk-api"
