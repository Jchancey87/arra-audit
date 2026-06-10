# 🚀 Arra Audit App - Redeployment Guide

This document contains step-by-step instructions on how to commit/push development updates and redeploy them to your Proxmox server environment.

---

## 1. Local Development (Pushing Updates)

Run these commands from your local workspace root directory (e.g., on your local coding machine):

### Stage the changes
Add all the updated and new files to the git staging area:
```bash
git add .
```

### Commit the changes
Create a commit with a descriptive message detailing the refinements:
```bash
git commit -m "feat: make kanban cards interactive and enrich audit review"
```

### Push to remote repository
Push your local branch commits to the remote origin:
```bash
git push origin main
```

---

## 2. Proxmox Server (Redeployment)

Since your application is running in **development/dev-server mode** via `concurrently` (Vite on port 3050, Express on port 5050) directly out of your home directory repository:

### Navigate to the repository
Log into your server shell and go to:
```bash
cd /home/jackc/projects/arra
```

### Pull the latest updates
```bash
git pull origin main
```

### Sync dependencies
If there were updates to dependencies or `package.json` configurations (such as overrides), install them in one step:
```bash
npm run install-all
```

### Auto-Reload Verification
Since `nodemon` is running on the backend and `Vite` is running on the frontend, **both will hot-reload your changes immediately** after pulling and installing. No service or manual process restart is required.

---

## 3. Managing the Running Application

If the server was rebooted or you need to restart the application processes manually:

### Stop the running dev servers
Find the terminal where `npm run dev` is running and press `Ctrl+C`. Alternatively, you can kill the active Node processes:
```bash
killall node
```

### Start the application
Start the unified frontend/backend runner:
```bash
npm run dev
```
This launches:
- **Frontend**: Vite server on port `3050`
- **Backend**: Node.js API server on port `5050`

