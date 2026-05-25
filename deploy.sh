#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting Sonic DNA Deployment Sequence...${NC}"

# 1. Navigate to the repository
REPO_DIR="/home/jackc/projects/sonic-dna"
cd "$REPO_DIR" || { echo -e "${RED}✗ Repository directory not found!${NC}"; exit 1; }

# 2. Pull latest code from Git
echo -e "${YELLOW}📥 Pulling latest changes from GitHub...${NC}"
git pull origin main
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Git pull failed! Please check your network or branch status.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Code updated successfully.${NC}"

# 3. Install/Update dependencies
echo -e "${YELLOW}📦 Syncing dependencies (installing overrides & updates)...${NC}"
npm run install-all
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Dependency installation failed!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Dependencies synchronized.${NC}"

# 4. Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}⚠️ PM2 is not installed. Installing PM2 globally...${NC}"
  sudo npm install -g pm2
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ PM2 global installation failed! Please install it manually with: sudo npm install -g pm2${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ PM2 installed successfully.${NC}"
fi

# 5. Clean up any dangling raw node processes (not managed by PM2) that might block ports
echo -e "${YELLOW}🧹 Cleaning up port conflicts...${NC}"
# Stop PM2 instances if they are running, so they don't get forcefully killed
pm2 stop sonic-dna-server sonic-dna-client &> /dev/null

# Kill any other non-PM2 node processes
pkill -9 -f "concurrently" &> /dev/null
pkill -9 -f "nodemon" &> /dev/null
pkill -9 -f "vite" &> /dev/null

echo -e "${GREEN}✓ Cleanup complete.${NC}"

# 6. Deploy / Start processes under PM2
echo -e "${YELLOW}⚡ Starting services under PM2...${NC}"

# Manage Backend
pm2 describe sonic-dna-server &> /dev/null
if [ $? -eq 0 ]; then
  echo -e "${YELLOW}Restarting existing backend service...${NC}"
  pm2 restart sonic-dna-server
else
  echo -e "${YELLOW}Launching backend service...${NC}"
  cd "$REPO_DIR/server" && pm2 start server.js --name "sonic-dna-server" --watch
fi

# Manage Frontend
pm2 describe sonic-dna-client &> /dev/null
if [ $? -eq 0 ]; then
  echo -e "${YELLOW}Restarting existing frontend service...${NC}"
  pm2 restart sonic-dna-client
else
  echo -e "${YELLOW}Launching frontend service...${NC}"
  cd "$REPO_DIR/client" && pm2 start npm --name "sonic-dna-client" -- run dev
fi

cd "$REPO_DIR"

echo -e "${GREEN}✨ Deployment complete! Current status of your services:${NC}"
pm2 status
