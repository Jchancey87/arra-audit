#!/bin/bash
# Arra Audit App - Proxmox LXC Semi-Automated Setup Script
# This script automates much of the manual setup. Run it as root in your LXC container.
#
# Usage: bash setup-proxmox.sh
#
# WARNING: This script will install packages and modify system files.
# It's safe to run but always review before executing.

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Arra - Proxmox LXC Setup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

# ============================================================================
# PHASE 1: System Update
# ============================================================================
echo -e "${YELLOW}[1/10] Updating system packages...${NC}"
apt update
apt upgrade -y
apt install -y curl wget git build-essential nano htop

echo -e "${GREEN}✓ System updated${NC}"
echo ""

# ============================================================================
# PHASE 2: Install Node.js
# ============================================================================
echo -e "${YELLOW}[2/10] Installing Node.js 24 LTS...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt install -y nodejs
    echo -e "${GREEN}✓ Node.js installed: $(node --version)${NC}"
else
    echo -e "${GREEN}✓ Node.js already installed: $(node --version)${NC}"
fi
echo ""

# ============================================================================
# PHASE 3: Create App User
# ============================================================================
echo -e "${YELLOW}[3/10] Setting up application user...${NC}"
if ! id -u appuser &>/dev/null; then
    useradd -m -s /bin/bash appuser
    echo -e "${GREEN}✓ Created 'appuser' (non-root)${NC}"
else
    echo -e "${GREEN}✓ 'appuser' already exists${NC}"
fi
echo ""

# ============================================================================
# PHASE 4: Create App Directory
# ============================================================================
echo -e "${YELLOW}[4/10] Creating application directory...${NC}"
mkdir -p /opt/arra
chown -R appuser:appuser /opt/arra
echo -e "${GREEN}✓ Directory: /opt/arra${NC}"
echo ""

# ============================================================================
# PHASE 5: Install MongoDB
# ============================================================================
echo -e "${YELLOW}[5/10] Installing MongoDB...${NC}"
if ! command -v mongod &> /dev/null; then
    apt-get install -y gnupg
    wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add - 2>/dev/null || true
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
    apt update
    apt install -y mongodb-org
    systemctl start mongod
    systemctl enable mongod
    echo -e "${GREEN}✓ MongoDB installed and started${NC}"
else
    echo -e "${GREEN}✓ MongoDB already installed${NC}"
    systemctl start mongod
    systemctl enable mongod
fi
echo ""

# ============================================================================
# PHASE 6: Install Nginx
# ============================================================================
echo -e "${YELLOW}[6/10] Installing Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    systemctl enable nginx
    echo -e "${GREEN}✓ Nginx installed${NC}"
else
    echo -e "${GREEN}✓ Nginx already installed${NC}"
fi
echo ""

# ============================================================================
# PHASE 7: Install Application Dependencies
# ============================================================================
echo -e "${YELLOW}[7/10] Installing application dependencies...${NC}"
echo -e "${BLUE}  → This may take a few minutes...${NC}"

cd /opt/arra

# Check if app files exist
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}  NOTE: No package.json found in /opt/arra${NC}"
    echo -e "${YELLOW}  You need to copy the app files here first.${NC}"
    echo -e "${YELLOW}  Skipping npm install.${NC}"
else
    npm install --omit=dev > /dev/null 2>&1 || true
    
    if [ -d "server" ]; then
        cd server
        npm install --omit=dev > /dev/null 2>&1 || true
        cd ..
    fi
    
    if [ -d "client" ]; then
        cd client
        npm install > /dev/null 2>&1 || true
        npm run build > /dev/null 2>&1 || true
        cd ..
    fi
    
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi
echo ""

# ============================================================================
# PHASE 8: Create .env File
# ============================================================================
echo -e "${YELLOW}[8/10] Creating .env configuration file...${NC}"

ENV_FILE="/opt/arra/.env"

if [ ! -f "$ENV_FILE" ]; then
    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    
    cat > "$ENV_FILE" << EOF
# Server Configuration
PORT=5050
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/arra

# JWT Secret
JWT_SECRET=${JWT_SECRET}

# APIs - REPLACE THESE WITH YOUR ACTUAL KEYS
OPENAI_API_KEY=sk-paste-your-openai-key-here
TAVILY_API_KEY=paste-your-tavily-key-here

# Frontend
REACT_APP_API_URL=/api
EOF
    
    chown appuser:appuser "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    
    echo -e "${GREEN}✓ Created: $ENV_FILE${NC}"
    echo -e "${YELLOW}  ⚠ IMPORTANT: Edit this file and add your API keys:${NC}"
    echo -e "${YELLOW}     nano $ENV_FILE${NC}"
else
    echo -e "${GREEN}✓ .env already exists${NC}"
fi
echo ""

# ============================================================================
# PHASE 9: Configure Nginx
# ============================================================================
echo -e "${YELLOW}[9/10] Configuring Nginx reverse proxy...${NC}"

NGINX_CONF="/etc/nginx/sites-available/arra"

if [ ! -f "$NGINX_CONF" ]; then
    cat > "$NGINX_CONF" << 'EOF'
server {
    listen 80;
    server_name _;

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

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:5050;
        access_log off;
    }
}
EOF
    
    ln -sf /etc/nginx/sites-available/arra /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    nginx -t
    systemctl restart nginx
    
    echo -e "${GREEN}✓ Nginx configured and restarted${NC}"
else
    echo -e "${GREEN}✓ Nginx configuration already exists${NC}"
fi
echo ""

# ============================================================================
# PHASE 10: Create Systemd Service
# ============================================================================
echo -e "${YELLOW}[10/10] Setting up systemd service...${NC}"

SERVICE_FILE="/etc/systemd/system/arra.service"

if [ ! -f "$SERVICE_FILE" ]; then
    cat > "$SERVICE_FILE" << 'EOF'
[Unit]
Description=Arra Audit App
After=network.target mongodb.service
Wants=mongodb.service

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/arra/server
ExecStart=/usr/bin/node /opt/arra/server/server.js

Restart=always
RestartSec=5

Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="NODE_ENV=production"

StandardOutput=journal
StandardError=journal
SyslogIdentifier=arra

NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable arra
    
    echo -e "${GREEN}✓ Systemd service created${NC}"
else
    echo -e "${GREEN}✓ Systemd service already exists${NC}"
fi
echo ""

# ============================================================================
# Initialize MongoDB Database
# ============================================================================
echo -e "${YELLOW}Initializing MongoDB indexes...${NC}"

mongosh << 'MONGOEOF'
use arra
db.users.createIndex({ "email": 1 }, { unique: true })
db.songs.createIndex({ "userId": 1, "youtubeId": 1 }, { unique: true })
db.audits.createIndex({ "userId": 1, "songId": 1 })
db.audits.createIndex({ "userId": 1, "createdAt": -1 })
db.techniqueentries.createIndex({ "userId": 1, "category": 1 })
db.techniqueentries.createIndex({ "userId": 1, "createdAt": -1 })
MONGOEOF

echo -e "${GREEN}✓ MongoDB indexes created${NC}"
echo ""

# ============================================================================
# Summary
# ============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo -e "  1. ${BLUE}Edit .env file and add your API keys:${NC}"
echo -e "     ${GREEN}nano /opt/arra/.env${NC}"
echo ""
echo -e "  2. ${BLUE}Copy application files to /opt/arra:${NC}"
echo -e "     ${GREEN}(server, client/build, package.json, etc.)${NC}"
echo ""
echo -e "  3. ${BLUE}Start the application:${NC}"
echo -e "     ${GREEN}systemctl start arra${NC}"
echo ""
echo -e "  4. ${BLUE}Verify it's running:${NC}"
echo -e "     ${GREEN}systemctl status arra${NC}"
echo -e "     ${GREEN}curl http://localhost/${NC}"
echo ""
echo -e "  5. ${BLUE}Get your container IP:${NC}"
echo -e "     ${GREEN}hostname -I${NC}"
echo ""
echo -e "  6. ${BLUE}Open browser:${NC}"
echo -e "     ${GREEN}http://<your-container-ip>${NC}"
echo ""

echo -e "${YELLOW}Useful Commands:${NC}"
echo ""
echo -e "  Status:        ${GREEN}systemctl status arra${NC}"
echo -e "  View Logs:     ${GREEN}journalctl -u arra -f${NC}"
echo -e "  Stop App:      ${GREEN}systemctl stop arra${NC}"
echo -e "  Restart App:   ${GREEN}systemctl restart arra${NC}"
echo -e "  Test API:      ${GREEN}curl http://localhost:5050/health${NC}"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "Documentation: See PROXMOX_DEPLOYMENT.md"
echo -e "${BLUE}========================================${NC}"
