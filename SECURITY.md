# Security Guide

## API Key Security

### What's Safe to Share
- **Public Mapbox tokens (pk.*)** - These are designed to be public and can be visible in frontend code
- **Repository code** - All your application code is safe to share publicly

### What to NEVER Share
- **Secret Mapbox tokens (sk.*)** - These can charge your account and access private data
- **AWS credentials** - Can be used to access/modify your AWS resources
- **SSH private keys (.pem files)** - Can be used to access your servers

### Current Protection
- ✅ `.env` files are in `.gitignore` - your API keys won't be committed
- ✅ Example files provided with safe placeholders
- ✅ AWS keys and .pem files excluded from git

## EC2 Security Best Practices

### Server Security
1. **Keep software updated**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Use SSH keys only** (no password authentication)
   - AWS EC2 disables password auth by default

3. **Restrict SSH access**
   - Only allow SSH from your IP in Security Group
   - Consider changing SSH port from 22

4. **Firewall rules**
   - Only open ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
   - Block all other inbound traffic

### Application Security
1. **Environment variables**
   - Never hardcode API keys in source code
   - Use `.env` files that are gitignored

2. **Nginx security headers**
   ```nginx
   add_header X-Frame-Options DENY;
   add_header X-Content-Type-Options nosniff;
   add_header X-XSS-Protection "1; mode=block";
   ```

3. **Regular updates**
   - Update dependencies regularly
   - Monitor for security vulnerabilities

## Mapbox Token Security

### Public Token (pk.*) - Safe for Frontend
- Designed to be visible in client-side code
- Set URL restrictions in Mapbox dashboard to your domain
- Limit scopes to only what's needed (styles:read, fonts:read)

### Secret Token (sk.*) - Server Only
- Never expose in frontend code
- Store only in server environment variables
- Use for server-side API calls only

## Monitoring

### Check for exposed credentials
1. **Search your repo for keys**
   ```bash
   git log --all --full-history -- **/.env
   git log -p | grep -i "api.key\|secret\|token"
   ```

2. **GitHub secret scanning**
   - GitHub automatically scans for exposed credentials
   - Check your repository's Security tab

### AWS Cost Monitoring
- Set up billing alerts in AWS console
- Monitor API usage in Mapbox dashboard

## Emergency Response

If you accidentally commit API keys:
1. **Immediately revoke the compromised keys**
2. **Generate new keys**
3. **Update your application with new keys**
4. **Use `git filter-branch` or `BFG Repo-Cleaner` to remove from git history**

## Regular Security Tasks
- [ ] Review API key usage monthly
- [ ] Update server packages monthly
- [ ] Check AWS billing for unexpected charges
- [ ] Review SSH access logs
- [ ] Update application dependencies
