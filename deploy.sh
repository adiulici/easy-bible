#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
PI_USER="adi"
PI_HOST="pi.local"
# PI_HOST="100.109.184.53" # tailscale proxy
PI_APP_DIR="~/apps/biblia"
SSH_DESTINATION="${PI_USER}@${PI_HOST}"

# --- 1. Build the application locally ---
echo "Building Next.js application for production..."
npm run build
echo "Build complete."
echo

# --- 2. Upload the .next directory ---
echo "Uploading .next directory to Raspberry Pi..."
rsync -avz --delete ./.next/ "${SSH_DESTINATION}:${PI_APP_DIR}/.next/"
echo "Upload complete."
echo

# --- 3. Deploy on the Raspberry Pi ---
echo "Connecting to Raspberry Pi to complete deployment..."
ssh "${SSH_DESTINATION}" <<'EOF'
  # Exit immediately if a command exits with a non-zero status.
  set -e

  # Source nvm to make node and npm available
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  echo "Navigating to application directory..."
  cd ~/apps/biblia

  echo "Pulling latest changes from git..."
  git pull

  echo "Installing dependencies..."
  npm install

  echo "Restarting application with pm2..."
  # 'pm2 restart' will start the app if it's not already running
  # The app should be started for the first time with:
  # pm2 start npm --name "biblia" -- start
  pm2 restart biblia --update-env

  echo "Deployment successful! Application is running."
EOF

echo
echo "--- DEPLOYMENT FINISHED ---"
