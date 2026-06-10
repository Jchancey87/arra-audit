# 🚀 Arra Audit App - Proxmox LXC Manual Deployment Guide

## Overview

This guide walks you through deploying the Arra Audit App on a **Proxmox LXC container** with manual setup (no Docker). By the end, you'll have a production-ready app running on your home lab.

**Target Architecture:**
- LXC Container (Ubuntu 22.04 LTS recommended)
- Node.js 24+ (backend)
- React (frontend, built)
- MongoDB (local or remote)
- Nginx (reverse proxy)
- Systemd (process management)

**Estimated Time:** 60 minutes

---

## Prerequisites

### What You Need
- ✅ Proxmox VE host with LXC support
- ✅ Basic Linux command line knowledge
- ✅ Your API keys ready:
  - OpenAI API key
  - Tavily API key
- ✅ The Arra Audit App code (from `c:\Users\jchancey\Documents\Homma Research`)

### Not Needed
- ❌ Docker (we're doing manual installation)
- ❌ Kubernetes
- ❌ Any special tools

---

## Phase 1: Create & Configure LXC Container

### Step 1: Create Ubuntu LXC Container

In Proxmox:

1. **Proxmox Web UI** → `Create CT`
2. **General Tab:**
   - VMID: `101` (or next available)
   - Hostname: `arra-app`
   - Unprivileged container: ☑ (checked)
   - Password: (choose secure password)

3. **Template Tab:**
   - Storage: local
   - Template: `ubuntu-22.04-standard` (or latest Ubuntu LTS)

4. **Resources Tab:**
   - Cores: `2` (minimum)
   - Memory: `2048` MB (2GB minimum)
   - Root disk: `20` GB (or more if you plan large database)

5. **Network Tab:**
   - Name: `eth0`
   - IPv4: `DHCP` or `Static` (choose your preference)
   - Gateway: your Proxmox gateway IP

6. **DNS Tab:**
   - DNS servers: `8.8.8.8`, `8.8.4.4` (or your preferred DNS)

7. **Click Create** - Wait 2-3 minutes for initialization

### Step 2: Start Container & Get Shell Access

```bash
# In Proxmox command line or Web UI
pct start 101

# Open shell (Web UI: right-click container → Console)
# OR from Proxmox host:
pct enter 101
```

### Step 3: Update System

```bash
apt update
apt upgrade -y
apt install -y curl wget git build-essential
```

---

## Phase 2: Install Node.js & npm

### Step 4: Install Node.js 24 LTS

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -

# Install Node.js
apt install -y nodejs

# Verify installation
node --version    # Should be v24.x.x
npm --version     # Should be 11.x.x
```

### Step 5: Create App User (Optional but Recommended)

```bash
# Create non-root user for running the app
useradd -m -s /bin/bash appuser

# Give sudo access if needed
usermod -aG sudo appuser
```

---

## Phase 3: Prepare Application Directory

### Step 6: Create App Directory Structure

```bash
# Create directory
mkdir -p /opt/arra
cd /opt/arra

# Set ownership (if using appuser)
chown -R appuser:appuser /opt/arra

# Change to app user
su - appuser
```

### Step 7: Transfer App Code to Container

You have two options:

**Option A: Copy from Host (Easier)**

On your Proxmox host (with your app code):

```bash
# From Proxmox host, copy app to container
pct push 101 "c:\Users\jchancey\Documents\Homma Research" /opt/arra

# Then verify
pct enter 101
ls -la /opt/arra
```

**Option B: Clone from Git (If You Have a Repo)**

In the container:

```bash
cd /opt/arra
git clone https://github.com/yourusername/arra-audit.git .
```

**Option C: Manually Copy Key Files**

```bash
# Create minimal structure
mkdir -p /opt/arra/{server,client}
# Copy files using SFTP or similar
```

---

## Phase 4: Install MongoDB (Local Option)

### Step 8a: Install MongoDB in Container (Recommended for Small Setup)

```bash
# Add MongoDB repository
apt-get install -y gnupg
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Install MongoDB
apt update
apt install -y mongodb-org

# Start MongoDB
systemctl start mongod
systemctl enable mongod

# Verify it's running
systemctl status mongod

# Test MongoDB connection
mongosh --eval "db.adminCommand('ping')"
```

### Step 8b: Alternative - Use Remote MongoDB

If you want to use MongoDB Atlas instead:
- Create free cluster at https://www.mongodb.com/cloud/atlas
- Skip Steps 8a and use remote connection string in `.env`

---

## Phase 5: Install Application Dependencies

### Step 9: Install Server & Client Dependencies

```bash
cd /opt/arra

# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..

# Build frontend (creates optimized bundle)
cd client
npm install
npm run build
cd ..

# You should now have:
# - server/node_modules/
# - client/build/ (production React bundle)
```

---

## Phase 6: Configure Environment

### Step 10: Create Production .env File

```bash
cd /opt/arra

# Create .env file
cat > .env << 'EOF'
# Server Configuration
PORT=5050
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/arra

# JWT Secret (CHANGE THIS TO SOMETHING RANDOM)
JWT_SECRET=$(openssl rand -base64 32)

# APIs
OPENAI_API_KEY=sk-your-actual-key-here
TAVILY_API_KEY=tvly-your-actual-key-here

# Frontend doesn't need REACT_APP_API_URL in production (uses same domain)
EOF

# Edit the file with your actual API keys
nano .env
```

### Step 11: Update API Keys

Edit `.env` and replace:
- `sk-your-actual-key-here` with your OpenAI key
- `tvly-your-actual-key-here` with your Tavily key

```bash
# Edit file
nano .env
```

---

## Phase 7: Set Up Reverse Proxy (Nginx)

### Step 12: Install & Configure Nginx

```bash
# Install Nginx
apt install -y nginx

# Enable and start Nginx
systemctl enable nginx
systemctl start nginx

# Create config for Arra
cat > /etc/nginx/sites-available/arra << 'EOF'
server {
    listen 80;
    server_name _;  # Accept any hostname; change to your domain if you have one

    # Increase upload size limit
    client_max_body_size 50M;

    # Serve React build (static files)
    location / {
        root /opt/arra/client/build;
        try_files $uri $uri/ /index.html;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API calls to Node.js backend
    location /api/ {
        proxy_pass http://127.0.0.1:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 30s;
    }

    # Proxy /health check
    location /health {
        proxy_pass http://127.0.0.1:5050;
        access_log off;
    }
}
EOF

# Enable the site
ln -s /etc/nginx/sites-available/arra /etc/nginx/sites-enabled/

# Remove default site (optional)
rm /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t

# Restart Nginx
systemctl restart nginx
```

### Step 13: Test Nginx

```bash
# Should return HTML
curl http://localhost/

# Should return a 401 (you're not authenticated yet, which is correct)
curl http://localhost/api/auth/login
```

---

## Phase 8: Set Up Process Management (Systemd)

### Step 14: Create Systemd Service for Node.js App

```bash
# Create service file
cat > /etc/systemd/system/arra.service << 'EOF'
[Unit]
Description=Arra Audit App
After=network.target mongodb.service
Wants=mongodb.service

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/arra/server
ExecStart=/usr/bin/node /opt/arra/server/server.js

# Automatically restart if it crashes
Restart=always
RestartSec=5

# Environment variables
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="NODE_ENV=production"

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=arra

# Security
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable service (start on boot)
systemctl enable arra

# Start the service
systemctl start arra

# Check status
systemctl status arra

# View logs
journalctl -u arra -f
```

### Step 15: Verify App is Running

```bash
# Should show running
systemctl status arra

# Should show the backend responding
curl http://localhost:5050/health

# Should return:
# {"status":"ok","timestamp":"..."}

# Frontend should load
curl http://localhost/
```

---

## Phase 9: SSL/TLS (Optional but Recommended)

### Step 16a: Self-Signed Certificate (Quick Test)

```bash
# Generate self-signed certificate (valid for 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/arra.key \
  -out /etc/ssl/certs/arra.crt

# When prompted, you can press Enter through most fields
# For "Common Name", enter your container's IP or hostname
```

### Step 16b: Enable HTTPS in Nginx

```bash
# Update Nginx config to use HTTPS
cat > /etc/nginx/sites-available/arra << 'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/ssl/certs/arra.crt;
    ssl_certificate_key /etc/ssl/private/arra.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    client_max_body_size 50M;

    # Serve React build (static files)
    location / {
        root /opt/arra/client/build;
        try_files $uri $uri/ /index.html;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API calls to Node.js backend
    location /api/ {
        proxy_pass http://127.0.0.1:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 30s;
    }

    # Proxy /health check
    location /health {
        proxy_pass http://127.0.0.1:5050;
        access_log off;
    }
}
EOF

# Test and reload
nginx -t
systemctl restart nginx
```

### Step 16c: Test HTTPS

```bash
# Should redirect HTTP to HTTPS
curl -I http://localhost/

# Should work with HTTPS (ignore cert warning in test)
curl -k https://localhost/
```

---

## Phase 10: Database Initialization

### Step 17: Initialize MongoDB Database

```bash
# Connect to MongoDB shell
mongosh

# Create database and indexes
# (This happens automatically on first write, but we can verify)
use arra
db.users.createIndex({ "email": 1 }, { unique: true })
db.songs.createIndex({ "userId": 1, "youtubeId": 1 }, { unique: true })
db.audits.createIndex({ "userId": 1, "songId": 1 })
db.audits.createIndex({ "userId": 1, "createdAt": -1 })
db.techniqueentries.createIndex({ "userId": 1, "category": 1 })
db.techniqueentries.createIndex({ "userId": 1, "createdAt": -1 })

# Verify (should show collections)
show collections

# Exit
exit
```

---

## Phase 11: Verification & Testing

### Step 18: Test the Full Application

```bash
# Check all services running
systemctl status arra
systemctl status nginx
systemctl status mongod

# Check logs for any errors
journalctl -u arra -n 50
journalctl -u nginx -n 50

# Test API health
curl http://localhost:5050/health

# Test frontend loads
curl http://localhost/ | head -20

# Check ports are listening
netstat -tuln | grep -E '80|443|5050|27017'|grep -E '80|443|5050|27017'|grep -E '80|443|5050|27017'|grep -E '80|443|5050|27017'
```

### Step 19: Access the App

1. **Get Container IP:**
   ```bash
   hostname -I
   # Should show something like: 192.168.1.100
   ```

2. **Open Browser:**
   - HTTP: `http://192.168.1.100`
   - HTTPS: `https://192.168.1.100` (if configured)

3. **Create Account & Test:**
   - Register new user
   - Import a YouTube song
   - Create an audit
   - Verify all features work

---

## Phase 12: Monitoring & Maintenance

### Step 20: Set Up Log Rotation

```bash
# Node.js logs are handled by systemd journal (automatic rotation)

# Check journal size
journalctl --disk-usage

# Limit journal size (optional)
mkdir -p /etc/systemd/journald.conf.d/
cat > /etc/systemd/journald.conf.d/99-arra.conf << 'EOF'
[Journal]
MaxRetentionSec=30day
SystemMaxUse=500M
EOF

# Reload
systemctl restart systemd-journald
```

### Step 21: Create Health Check Script

```bash
# Create monitoring script
cat > /opt/arra/check-health.sh << 'EOF'
#!/bin/bash
# Check if Arra app is healthy

echo "=== Arra Health Check ==="
echo "Time: $(date)"
echo ""

# Check services
echo "Service Status:"
systemctl is-active arra && echo "✓ Node.js app: RUNNING" || echo "✗ Node.js app: STOPPED"
systemctl is-active mongodb && echo "✓ MongoDB: RUNNING" || echo "✗ MongoDB: STOPPED"
systemctl is-active nginx && echo "✓ Nginx: RUNNING" || echo "✗ Nginx: STOPPED"
echo ""

# Check API
echo "API Health:"
if curl -s http://localhost:5050/health | grep -q "ok"; then
  echo "✓ API: RESPONDING"
else
  echo "✗ API: NOT RESPONDING"
fi
echo ""

# Check MongoDB
echo "Database:"
if mongosh --eval "db.adminCommand('ping')" 2>/dev/null | grep -q "ok"; then
  echo "✓ MongoDB: CONNECTED"
else
  echo "✗ MongoDB: NOT CONNECTED"
fi
echo ""

# Check disk space
echo "Disk Usage:"
df -h / | tail -1
EOF

chmod +x /opt/arra/check-health.sh

# Run it
/opt/arra/check-health.sh
```

### Step 22: Backup Strategy

```bash
# Create backup script
cat > /opt/arra/backup.sh << 'EOF'
#!/bin/bash
# Backup Arra app and database

BACKUP_DIR="/opt/arra/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "Starting backup at $(date)"

# Backup MongoDB
echo "Backing up MongoDB..."
mongodump --out $BACKUP_DIR/mongodb_$DATE

# Backup app files
echo "Backing up application..."
tar -czf $BACKUP_DIR/app_$DATE.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  /opt/arra/{server,client/build,.env}

echo "Backup complete: $BACKUP_DIR"
ls -lh $BACKUP_DIR
EOF

chmod +x /opt/arra/backup.sh

# Run backup
/opt/arra/backup.sh
```

---

## Phase 13: Update & Maintenance

### Step 23: Update Application Code

When you have new code:

```bash
cd /opt/arra

# Stop the app
systemctl stop arra

# Update code (pull from git or copy new files)
# git pull origin main
# OR copy new files

# Update dependencies if needed
npm install
cd server && npm install && cd ..
cd client && npm install && npm run build && cd ..

# Restart
systemctl start arra

# Verify
systemctl status arra
```

### Step 24: Restart Services

```bash
# Just the app
systemctl restart arra

# Full restart
systemctl restart arra nginx mongod

# Check all running
systemctl status arra nginx mongod
```

---

## Troubleshooting

### App Won't Start

```bash
# Check the logs
journalctl -u arra -n 100

# Common issues:
# - Port grep -E '80|443|5050|27017' already in use: ps aux | grep node|ps aux | grep node
# - MongoDB not running: systemctl start mongod
# - Missing .env file: check /opt/arra/.env exists

# Restart manually
systemctl restart arra
journalctl -u arra -f  # Follow logs
```

### MongoDB Connection Error

```bash
# Check MongoDB status
systemctl status mongod

# Check it's listening
netstat -tuln | grep 27017

# Try connecting
mongosh

# Restart if needed
systemctl restart mongod
```

### API Not Responding

```bash
# Check if Node.js process is running
ps aux | grep node|ps aux | grep node

# Check port grep -E '80|443|5050|27017'
netstat -tuln | grep grep -E '80|443|5050|27017'

# Restart
systemctl restart arra

# Check logs
journalctl -u arra -f
```

### Nginx Issues

```bash
# Check config syntax
nginx -t

# Check if listening
netstat -tuln | grep -E '80|443|5050|27017'|grep -E '80|443|5050|27017''

# View error logs
tail -f /var/log/nginx/error.log

# Restart
systemctl restart nginx
```

### Container Running Out of Disk Space

```bash
# Check disk usage
df -h /

# Clear Node.js cache
rm -rf /opt/arra/node_modules/.cache

# Clear npm cache
npm cache clean --force

# Remove old backups
rm -rf /opt/arra/backups/old_*

# If needed, resize container in Proxmox
```

---

## Quick Reference Commands

```bash
# Status checks
systemctl status arra
systemctl status nginx
systemctl status mongod
curl http://localhost:5050/health

# Log viewing
journalctl -u arra -f        # Follow logs
journalctl -u arra -n 100    # Last 100 lines
journalctl -u arra -S -1h    # Last hour

# Service control
systemctl start arra
systemctl stop arra
systemctl restart arra
systemctl enable arra        # Enable on boot

# Database
mongosh                           # Connect to MongoDB
mongodump --out ./backup         # Backup database

# App
cd /opt/arra
npm run build                     # Rebuild frontend

# Nginx
nginx -t                         # Test config
systemctl reload nginx           # Graceful reload
systemctl restart nginx          # Full restart
```

---

## Performance Tuning (Optional)

### Increase Container Resources (if needed)

In Proxmox:
```bash
# On Proxmox host (not in container)
pct set 101 -cores 4        # Increase to 4 cores
pct set 101 -memory 4096    # Increase to 4GB RAM
```

### MongoDB Optimization

```bash
# In mongosh
use arra
db.users.getIndexes()
db.audits.getIndexes()

# Check query performance
db.audits.find({userId: ObjectId("...")}).explain("executionStats")
```

### Node.js Process Management

For production with multiple instances, consider PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem.config.js
cat > /opt/arra/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'arra',
    script: './server/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u appuser --hp /home/appuser
```

---

## Firewall Configuration (Optional)

```bash
# If container has UFW firewall enabled
ufw allow 80/tcp    # HTTP
ufw allow grep -E '80|443|5050|27017'/tcp   # HTTPS
ufw allow 22/tcp    # SSH (for management)

# Check rules
ufw status numbered

# MongoDB (only if accessing from outside container)
# ufw allow from 192.168.1.0/24 to any port 27017
```

---

## Summary: What You've Built

✅ Proxmox LXC container (Ubuntu 22.04)  
✅ Node.js 24 installed  
✅ MongoDB running locally  
✅ Arra Audit App deployed  
✅ Nginx reverse proxy  
✅ HTTPS enabled  
✅ Systemd service auto-start  
✅ Health monitoring  
✅ Backup strategy  

Your app is now accessible at:
- `http://<container-ip>` (or your domain)
- `https://<container-ip>` (with self-signed cert)

---

## Next Steps

1. **Test thoroughly** - Create a few audits, verify bookmarks and techniques work
2. **Set up backups** - Run backup script regularly (cron job)
3. **Monitor performance** - Watch resource usage in Proxmox
4. **Get SSL certificate** - Replace self-signed with Let's Encrypt (if domain available)
5. **Enable firewall** - Restrict access if needed
6. **Document settings** - Keep notes of your configuration

---

## Getting Help

Common issues and fixes:

| Issue | Solution |
|-------|----------|
| App won't start | Check logs: `journalctl -u arra -f` |
| Port already in use | Kill process: `lsof -ti:grep -E '80|443|5050|27017' \| xargs kill -9` |
| No database connection | Restart MongoDB: `systemctl restart mongod` |
| Nginx not working | Test config: `nginx -t` then restart |
| Container full | Check disk: `df -h /` and clean up |
| Forgot API keys | Edit `/opt/arra/.env` and restart service |

---

**Deployment complete! Your Arra Audit App is now running on Proxmox. 🎵**

For daily operations, use the commands in the "Quick Reference" section above.
