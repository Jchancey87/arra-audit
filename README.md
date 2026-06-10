# 🎵 Arra Audit App

Arra is a full-stack music production analysis workspace designed to help music producers, educators, and musicians reverse-engineer song structures, track arrangement dynamics, study composition techniques, and build a personalized vocabulary of production concepts.

The application leverages a clean **Hexagonal Architecture (Ports & Adapters)** to decouple external infrastructure dependencies from core business logic.

---

## 🏗️ Technical Architecture & Stack

### Ports & Adapters Design
- **Core Domain Services**: All business actions (Songs, Audits, Techniques, Style Tastes) are driven by isolated services (`SongService`, `AuditService`, `TechniqueService`, `TemplateComposer`) containing zero external library leakage.
- **Backend Infrastructure Adapters**:
  - `MongooseRepository` implements persistence ports.
  - `OpenAIAdapter` handles AI-generated adaptive audit templates (supports OpenRouter fallback).
  - `TavilyAdapter` handles search-based background artist research with bearer authentication limits.
- **Frontend Ports**: The React app communicates with services using the `useBackend()` context hook, allowing instant swapping between an `HttpBackendAdapter` and a mock/testing harness.

### Technology Stack
- **Backend API**: Node.js, Express, Nodemon (development), Jest (unit & integration testing).
- **Frontend SPA**: React 19, Vite, Axios, React YouTube (embedded player API).
- **Database**: Proxmox hosted MongoDB (`192.168.0.205:27017`).
- **Process Orchestration**: PM2 for background process execution in containerized environments.

---

## 💎 Core Features & Workspaces

### 1. Workstation-Grade Arrangement Workspace
The **Arrangement Lens** features a workstation-style visual editor mimicking digital audio workstation (DAW) patterns:
- **Timeline Ruler**: Dedicated time marker ruler above blocks to map out song durations.
- **Drag-to-Resize Blocks**: Click and drag the right edge handle of any section block to dynamically modify its duration in seconds.
- **Playhead Synced Progress**: Tracks global player progress and displays active segment progress bars on the blocks.
- **Contextual Inspector**: Interactive side-panel inspector replacing forms:
  - Quick-select category swatches (Intro, Verse, Chorus, Bridge, Solo, Outro, Custom, Pre-Chorus).
  - Fast start-time **Sync** action locking boundary timings to the player's playhead.
  - Progressive disclosure separating metadata coordinates from advanced observations.
  - Auto-growing textareas for detailed production notes.
- **Keyboard Shortcuts**:
  - `Space` -> Plays/pauses the active timeline section.
  - `ArrowLeft` / `ArrowRight` -> Switches inspection focus between adjacent sections.
  - `A` -> Adds a new timeline section at the end.
  - *Shortcuts are automatically bypassed when typing inside inputs and textareas.*

### 2. Signal Spectrum & YouTube Import
- **Automated Research Dives**: Importing a YouTube URL kicks off metadata extraction and background Tavily research indexing the artist's structural style.
- **AI Audit Prompting**: GPT-4 synthesizes research findings and user style preferences to compile 4-6 tailored analytical exercises per lens.

### 3. Practice Room & Notebooks
- **Kanban Board**: Drag-and-drop technique cards across custom practice states with compact views.
- **Notebook Registry**: Distill observations into portable rules searchable by lens, artist, and keyword.

### 4. System Hardening & Settings
- **Collapsible Archives**: Accordion-grouped Deleted Songs and Deleted Audits under Trash with a bulk empty purge action.
- **Mutations & Security**: Supports display name updates, security password rotations, and account deletions.
- **Timezone Search**: Fast text-based filtering across global IANA timezone formats.

---

## 🚀 Environment Setup & Deployment

### Prerequisite Environment Variables
Create a `.env` file in the repository root:
```env
PORT=5050
NODE_ENV=development

# Database
MONGODB_URI=mongodb://192.168.0.205:27017/arra

# JWT Authenticator
JWT_SECRET=your-super-secret-auth-token-key

# External Keys
OPENAI_API_KEY=sk-your-openai-key
TAVILY_API_KEY=tvly-your-tavily-search-key
```

### Local Development Workflow
1. **Sync Dependencies**: Install npm packages across client and server packages.
   ```bash
   npm run install-all
   ```
2. **Execute Dev Servers**: Spin up Vite and Express under a unified runner.
   ```bash
   npm run dev
   ```
   - Frontend client loads at: `http://localhost:3050`
   - Express server loads at: `http://localhost:5050/api`

### Running Test Suites
Run backend Jest integration/unit test runners:
```bash
npm --prefix server test
```

### Proxmox LXC Container Deployment
Production deployment uses process separation managed by **PM2**:
1. Commit and push updates to your origin branch.
2. Log into the Proxmox container shell and navigate to the project directory `/home/jackc/projects/arra`.
3. Execute the deployment script:
   ```bash
   ./deploy.sh
   ```
   This script handles:
   - Pulling commits from remote origin.
   - Syncing npm packages.
   - Restoring port configurations.
   - Launching PM2 process instances (`arra-server` and `arra-client`).

---

## 📞 PM2 Process Administration
Inspect status logs inside the container shell:
- View active instances: `pm2 status`
- Monitor processes: `pm2 monit`
- View logs: `pm2 logs`
- Service restarts: `pm2 restart all`
