# Development Logs & Learnings

This log tracks architectural decisions, workflows, key configurations, and learnings gained during development.

---

## Log Entries

### 2026-05-22: DAW-Style Layout & Persistent Playback Redesign

#### 1. Global Audio Context & Persistent YouTube Player
- **Goal**: Implement a persistent audio player shell so that route navigation does not interrupt playback.
- **Implementation**:
  - Built `AudioContext.jsx` using `react-youtube` in a single global provider wrapper at the root layout (`App.jsx`).
  - Implemented persistent player variables (`activeSong`, `activeAudit`, `isPlaying`, `currentTime`, `duration`, `volume`, `isMuted`, `bookmarks`) with global callback controllers (`loadSong`, `play`, `pause`, `seekTo`, `addGlobalBookmark`).
  - Added a toggleable mini video monitor for YouTube playback positioned outside the routing views.

#### 2. Dark DAW Theme & Monospace Typography
- **Styling Overhaul**: Replaced the consumer light theme with a dark, industrial "analog hardware" aesthetic.
- **Design Tokens**:
  - Backgrounds: `#0a0a0c` (main canvas), `#141418` (control chrome/sidebars), `#151518` (panels).
  - Accents: Muted amber/orange (`#d08f60`) for active signals/markers, soft red (`#f87171`) for destructive warnings.
  - Typography: Google Fonts Inter (interface labels) paired with Roboto Mono (metrics, logs, timecodes).
- **Hard-Edged Layouts**: Replaced rounded card containers and shadows with flat, border-only panels (`1px solid rgba(255,255,255,0.08)`).
- **Responsive Panels**: Configured a triple-pane layout (left collapsible Navigator, center viewport, right collapsible Inspector).

#### 3. Frontend Route View Alignment
- Refactored all page views to integrate with the global player state:
  - `Dashboard.jsx`: Replaced cards with panels; added `▲ LOAD` button to load song data to transport.
  - `AuditForm.jsx`: Removed local inline player; converted step indicators to hardware LED sequencers; synced responses, techniques, and global bookmarks.
  - `AuditDetail.jsx`: Synced session audit reference to update inspector details; converted list timestamps to click-to-seek playback actions.
  - `TechniqueNotebook.jsx`: Applied grid panel styles; enabled seeking on notebook timestamps if matching song is loaded.
  - `ImportSong.jsx` / `Trash.jsx` / `AuditCreate.jsx` / `Login.jsx`: Refactored inputs, buttons, warning modals, and list structures.

### 2026-05-22: Archives/Trash UI & Network Exposure Configuration

#### 1. Archives & Trash Feature Implementation
- **Goal**: Implement soft-delete and purge/restore functionality for Songs and Audits with cascade operations.
- **Backend Service Changes**:
  - `SongService`: Implemented `getDeletedSongs`, `restoreSong`, and `purgeSong` with cascade deletion and restoration of associated audits and techniques.
  - `AuditService`: Implemented `getDeletedAudits`, `restoreAudit`, and `purgeAudit` with rules preventing audit restoration if the parent song is deleted.
- **Endpoints**:
  - `GET /api/songs/trash`, `POST /api/songs/:id/restore`, `DELETE /api/songs/:id/purge`
  - `GET /api/audits/trash`, `POST /api/audits/:id/restore`, `DELETE /api/audits/:id/purge`

#### 2. InMemoryRepository Query & Operator Matching Behavior
- **Problem**: In-memory unit and integration tests failed when querying `{ deletedAt: null }` because the mock repository did strict matching. Furthermore, mock repositories did not support MongoDB operators like `$ne` (e.g. `{ deletedAt: { $ne: null } }`).
- **Learning**:
  - By default, MongoDB/Mongoose treats `{ field: null }` as matching documents where `field` is `null`, `undefined`, or missing.
  - In-memory mock repositories need to explicitly emulate this behavior for tests to align with production DB queries.
- **Solution**:
  - Enhanced `_matches` inside [InMemoryRepository.js](file:///home/jackc/projects/sonic-dna/server/adapters/InMemoryRepository.js) to:
    1. Match query value `null` against both `null` and `undefined`/missing values in mock documents.
    2. Support `$ne` and `$eq` operators (specifically for handling soft-delete checks like `deletedAt: { $ne: null }`).

#### 3. Exposing Development Server to Local Network
- **Problem**: Testing the UI on local network devices (e.g., using `192.168.0.x`) resulted in `ERR_EMPTY_RESPONSE` because Vite was only listening on `localhost` (loopback interface). Additionally, `VITE_API_URL` was hardcoded to `http://localhost:5050/api` in `.env`, causing external client devices to try (and fail) to reach `localhost:5050` on their own local loopback.
- **Workflows Learned**:
  - **Exposing Vite Host**: Add `host: true` to `server` in [vite.config.js](file:///home/jackc/projects/sonic-dna/client/vite.config.js):
    ```javascript
    server: {
      port: 3050,
      host: true, // Listens on 0.0.0.0
      proxy: {
        '/api': {
          target: 'http://localhost:5050',
          changeOrigin: true,
        },
      },
    }
    ```
  - **Relative API URL Proxying**: Configure `VITE_API_URL=/api` in `.env` instead of hardcoding `localhost`. This allows client Axios requests to hit relative `/api` paths (e.g. `http://192.168.0.203:3050/api`), which Vite then proxies locally to `http://localhost:5050`. This is the bulletproof setup for local network testing.

---

## Standard Workflows & Commands

### Running Backend Tests
Ensure mock repositories are used and all service logic remains verified:
```bash
npm --prefix server test
```

### Starting Development Server (Exposed)
Runs client on port 3050 (exposed to network) and backend server on port 5050 concurrently:
```bash
npm run dev
```
Check status:
- Local Client: `http://localhost:3050/`
- Network Client: `http://<your-local-ip>:3050/`
- API Proxy Target: `http://localhost:5050`
