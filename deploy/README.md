# AWS EC2 Deployment Guide

## Step 1: Create EC2 Instance

1. **Go to AWS EC2 Console**
   - Launch new instance
   - Choose: **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type**
   - Instance type: **t3.small** (or t3.micro for free tier)

2. **Configure Security Group**
   - Allow SSH (port 22) from your IP
   - Allow HTTP (port 80) from anywhere (0.0.0.0/0)
   - Allow HTTPS (port 443) from anywhere if you plan to add SSL later

3. **Create/Select Key Pair**
   - Download the .pem file and keep it safe

4. **Launch Instance**
   - Note the public IP address

## Step 2: Connect and Setup

1. **SSH into your instance**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-public-ip
   ```

2. **Upload your code**
   ```bash
   # If you have git repo already:
   git clone https://github.com/your-username/adventure-chunk.git
   cd adventure-chunk
   
   # Or upload files manually with scp:
   scp -i your-key.pem -r . ubuntu@your-ec2-ip:/home/ubuntu/adventure-chunk
   ```

3. **Run setup script**
   ```bash
   chmod +x deploy/setup-ec2.sh
   ./deploy/setup-ec2.sh
   ```

4. **Add your API keys**
   ```bash
   nano /var/www/adventure-chunk/server/.env
   ```
   Add:
   ```
   MAPBOX_API_KEY=your_secret_key_here
   ```

5. **Complete configuration**
   ```bash
   chmod +x deploy/configure-ec2.sh
   ./deploy/configure-ec2.sh
   ```

## Step 3: Test Your App

Visit `http://your-ec2-public-ip` in your browser. You should see Adventure Chunk running!

## Step 4: Optional - Add Domain Name

1. **Buy a domain** (from Route 53, Namecheap, etc.)

2. **Point domain to EC2**
   - Add A record pointing to your EC2 public IP

3. **Add SSL with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

## Managing Your App

**View logs:**
```bash
pm2 logs adventure-chunk-api
```

**Restart app:**
```bash
pm2 restart adventure-chunk-api
```

**Deploy updates:**
```bash
./deploy/update-app.sh
```

**Monitor resources:**
```bash
pm2 monit
htop
```

## Costs

- **t3.micro**: Free tier eligible (750 hours/month free for first year)
- **t3.small**: ~$15/month
- **Data transfer**: Usually under $1/month for light usage
- **Domain**: ~$12/year (optional)

## Security Notes

- Keep your .pem key file secure
- Consider setting up automatic security updates
- Monitor your AWS billing
- Use IAM roles instead of root credentials when possible
