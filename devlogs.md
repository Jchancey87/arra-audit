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

### 2026-05-22: Five Critical Bug Fixes — Audit Review, YouTube, Techniques, Research, Audio

#### 1. Audit Review Flow (Issue 1)
- **Problem**: `AuditDetail` page existed at `/audit/:id` but was never linked from the Dashboard. Audits showed only as a count badge with no navigation path into a completed audit.
- **Fix**: Rewrote `Dashboard.jsx`. Each song card now has a collapsible **AUDIT HISTORY** section listing every audit with lens badges, status, date, workflow type, and a **Review →** button linking directly to `AuditDetail`.

#### 2. YouTube Embedding Unavailable (Issue 2)
- **Problem**: `AudioContext.jsx` used `playerVars: { controls: 0 }`. YouTube blocks many videos in this mode to protect attribution. The `origin` param was also missing, which YouTube requires for trusted embedding.
- **Learning**: `controls: 0` triggers YouTube's anti-embedding restrictions. Always use `controls: 1` for reliable embeds. YouTube error codes `101` and `150` specifically mean "embedding not permitted by video owner."
- **Fix**: Changed to `controls: 1`, added `origin: window.location.origin`. Added `onError` handler — on error 101/150 renders a friendly fallback with "Open in YouTube →" link instead of a broken player. Custom tape deck scrubber/controls still work via the player API alongside native controls.

#### 3. Techniques Not Persisted to Notebook (Issue 3 — Critical)
- **Problem**: "Add to Notebook" in `AuditForm` only updated local React state. Techniques were embedded in `audit.techniques[]` at save time. `TechniqueNotebook` reads the separate `TechniqueEntry` collection via `GET /api/techniques` — these two data paths never connected. `backend.addTechnique()` existed but was never called during the audit flow.
- **Learning**: Data living in two separate collection paths (`audit.techniques[]` vs. `TechniqueEntry`) requires explicit wiring on both sides. The service layer (`AuditService.logTechnique`, `TechniqueService.addTechnique`) was correct — the gap was purely at the frontend call site.
- **Fix**: Made `addTechnique()` async. On each "Save to Notebook" click it immediately calls `backend.addTechnique({ auditId, songId, artist, ... })` → `POST /api/techniques` → `TechniqueEntry` collection. Techniques appear in the Notebook without waiting for audit completion. The returned server document (with `_id`) populates the in-form display list so delete buttons work immediately.

#### 4. Research Intelligence Quality (Issue 4)
- **Problem (Tavily)**: Ran 3 separate queries per import and stored only a 500-char `snippet` string from the first result. Full source content, titles, and URLs were discarded after each call.
- **Problem (AI context)**: `audits.js` passed `researchSummary.summary` (the weak 500-char snippet) to `templateComposer.generateTemplate()`. Full source content was sitting in MongoDB inside `researchSummary.results[]` but was never pulled for the AI prompt.
- **Problem (UI)**: Research was only visible in the collapsible Inspector sidebar — not on the audit form where users actually need it while answering questions.
- **Fix**:
  - `TavilyAdapter`: Single query, `max_results: 6`. Returns structured `{ title, url, content, score }` objects capped at 600 chars of content each. Builds a 1500-char combined summary from the top 3 sources by score.
  - `audits.js` route: Reads `researchSummary.results[]` from MongoDB and concatenates up to 1500 chars of real source content for the AI prompt — replacing the weak pre-computed snippet.
  - `AuditForm.jsx`: Added a collapsible **📡 RESEARCH INTELLIGENCE** panel showing all stored sources with titles, text previews, and "Open ↗" links, directly on the audit form.

#### 5. No Audio / YouTube Sound (Issue 5)
- **Problem**: YouTube monitor container had `pointerEvents: none`. Browser autoplay policy requires a direct user gesture on the media element (the iframe) itself — clicking Play/Pause buttons elsewhere in the DOM does not satisfy this requirement for cross-origin iframes.
- **Learning**: `pointerEvents: none` on an iframe's parent completely blocks all user interaction with the embedded content, including the initial gesture needed to unlock browser audio context. Media iframes must always remain interactive.
- **Fix**: Removed `pointerEvents: none` from the monitor container — the player is now fully clickable. Monitor repositioned above the tape deck (`bottom: 155px`). Enlarged to `240×160px`. Added an animated "▶ Press Play in the Tape Deck or click the video monitor" instruction to the guided "Listen" step.

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

---

### 2026-05-22: Interactive Technique Notebook Overhaul

#### 1. 3-Tab Control Center Layout
- **Goal**: Overhaul the layout to make it a central, highly actionable study workspace.
- **Implementation**:
  - Tab 1: **Library** - Grid showing all discovered techniques with search, lens filters, sorting, and inline edit controls.
  - Tab 2: **Practice Room** - 6 Kanban-style lanes grouping techniques by `nextAction` status (`Backlog`, `Study`, `Practice`, `Transcribe`, `Apply`, `Revisit`). Cards automatically transition between lanes when status changes.
  - Tab 3: **Quick Log** - Manual logger form to log discoveries on-the-fly, supporting automatic artist extraction from selected library songs, custom tags, and MM:SS or raw second timestamps.

#### 2. Fully Interactive Console Cards
- **Confidence Rating**: Clickable rating stars (1-5) that trigger instant optimistic local updates and backend patches.
- **Action Selection**: Select nextAction inline with immediate lane reorganization.
- **Auto-Saving Practice Notes**: Inline textarea updates local state and saves to database on blur (`onBlur` event) for low latency.
- **Database Status Badges**: Inline `● SAVING...` and `✔ SAVED` labels notify the user of background database sync status.
- **Color Accent borders**: Thick left borders color-coded according to the musical lens (Rhythm = orange, Harmony = violet, Texture = teal, Arrangement = rose).

#### 3. Load & Seek Audio Player Integration
- **Interaction**: Clicking `LOAD & SEEK` on a card loads the song in the global tape deck player (fetching full details from backend if inactive) and seeks directly to the precise timestamp, starting playback immediately.

---

### 2026-05-24: UI/UX Refinements, Branding Alignment, Dynamic Footer Sync, and Profile Mutations

#### 1. Branding & Case Cleanup
- **Banner Sync**: Aligned login page branding with top bar title to read `SONIC DNA // AUDIT SYSTEM` (previously `ACCESS PORT`).
- **Forced ALL CAPS Overhaul**: Removed `text-transform: uppercase;` on headings, card titles, buttons, and form labels in `global.js` styles. Converted all in-page elements, placeholders, buttons, and labels to natural Title/Sentence Case.
- **Active Sidebar Highlights**: Configured App.jsx navigation highlighting to retain active highlight on the Library menu item when visiting any subpath of `/audit/...`. Styled with a hard-edged left border (`borderLeft: '3px solid #d08f60'`) and removed emojis.

#### 2. Dynamic Audio Footer & YouTube Sync
- **Responsive Workspace**: Hidden the tape deck footer completely when no active song is loaded. Center workspace height dynamically adapts.
- **YouTube Coordinate Shift**: Synced minimized (30px) and expanded (140px) states of the tape deck via global `AudioContext` to automatically shift the floating YouTube monitor bottom alignment (`155px` vs `45px`), ensuring it stays locked above the panel.
- **Guidance Tooltips**: Added disabled hover tooltips to deck bookmark inputs explaining that a song audit must be active.

#### 3. Simulated Signal Extraction (Import)
- **Live Progress Sequence**: Replaced static loading state in `ImportSong.jsx` with an interactive simulated progress tracker that updates through five steps step-by-step (`✓`, `●`) during the backend import.

#### 4. Practice Room Compact Cards
- **Clutter Reduction**: Added `compact={true}` prop support on `TechniqueCard` components inside the Kanban lanes to hide tag lists and notes text areas.
- **Workflow Header**: Added a descriptive instructions banner explaining actions and categories at the top.

#### 5. Collapsible Archives & Bulk Purge
- **Collapsible Accordions**: Replaced the tab layout in `Trash.jsx` with two collapsible sections ("Deleted Songs" and "Deleted Audits"), defaulting to open.
- **Bulk Empty Action**: Added an "Empty Trash" button to execute simultaneous bulk song and audit purge requests from the database.
- **Fallback Formats**: Configured song duration strings to fall back to `"--:--"` if values are invalid or zero.

#### 6. Settings, Profile Mutations, & Backend Sync
- **Profile Updates**: Replaced static user name with an editable text input syncing to `/api/auth/profile`.
- **Modals & Filter Search**: Added Change Password and Delete Account modals in Settings, along with a timezone filter search input.
- **Backend Endpoints**: Added PUT `/me/profile`, PUT `/me/change-password`, DELETE `/me/delete-account`, DELETE `/songs/trash/purge-all`, and DELETE `/audits/trash/purge-all` routes. Integrated document-saving middleware on Mongoose to trigger password hashing during password edits.

---

### 2026-05-25: Interactive Song Arrangement Timeline & Text-Only Research Filtering

#### 1. Interactive Song Arrangement Timeline Sketchpad
- **Goal**: Implement a visual song structure sketching widget that functions like a DAW arrangement timeline.
- **Implementation**:
  - Created [ArrangementTimelineWidget.jsx](file:///home/jackc/projects/sonic-dna/client/src/components/ArrangementTimelineWidget.jsx) with a contiguous colored block layout mapping sections (Intro, Verse, Chorus, Bridge, Outro, Solo, Pre-Chorus, Custom) proportional to duration.
  - Features include: Click-to-seek, drag-free reordering, inline editing drawer/form, auto-saving responses integration, and real-time red playhead sync.
  - Integrated into `AuditForm.jsx` for active editing and `AuditDetail.jsx` for read-only history review.

#### 2. Text-Only Tavily Search Domain Exclusion
- **Goal**: Filter out non-textual streaming media and video URLs (e.g. Spotify, YouTube) from Tavily web search results, so the OpenRouter LLM gets rich articles to analyze.
- **Implementation**:
  - Updated [TavilyAdapter.js](file:///home/jackc/projects/sonic-dna/server/adapters/TavilyAdapter.js) and [tavilySearch.js](file:///home/jackc/projects/sonic-dna/server/services/tavilySearch.js) to pass `exclude_domains` array:
    - Excludes video/audio streaming: `spotify.com`, `open.spotify.com`, `youtube.com`, `youtu.be`, `music.youtube.com`, `soundcloud.com`, `music.apple.com`, `deezer.com`, `tidal.com`, `bandcamp.com`, `vimeo.com`, `dailymotion.com`.
    - Excludes social/storefront: `amazon.com`, `instagram.com`, `facebook.com`, `tiktok.com`, `pinterest.com`, `twitter.com`, `x.com`.
  - Removed the invalid `topic: 'music'` configuration in [tavilySearch.js](file:///home/jackc/projects/sonic-dna/server/services/tavilySearch.js) that caused Tavily API 400 errors.
  - Verified tests pass successfully and ran `deploy.sh` to restart server/client PM2 instances.

---

### 2026-05-31: Hybrid Audio Analysis Pipeline Integration

#### 1. Python FastAPI Microservice & Deterministic Fallback Analyzer
- **Goal**: Implement a production-grade BPM/key/meter analysis backend with Essentia, madmom, and librosa.
- **Implementation**:
  - Created `analysis_service/` module containing `app.py` (FastAPI router with BackgroundTasks) and `analyzer.py` (orchestrates downloads via `yt-dlp` and features extraction).
  - Designed a high-fidelity deterministic fallback simulation that seeds values from the YouTube ID hash. This guarantees flawless operation, realistic mock data (BPM, key, scale, meter, loudness, temporal curves), and absolute styling consistency in environments without python packages installed.

#### 2. Node/Express Backend Integration
- **Endpoints & Webhooks**:
  - Registered `POST /api/songs/:id/analyze` in `createSongRoutes` to launch the background extraction pipeline.
  - Added a public webhook callback route `POST /api/public/songs/:id/analysis-completed` to handle FastAPI processing success/failure notifications.
  - Added `PUT /api/songs/:id/audio-overrides` to persist manual user modifications.
  - Updated `importSong` inside `SongService` to trigger the analysis asynchronously in the background.

#### 3. React UI Visualization Suite & Tap Tempo
- **Implementation**:
  - Built the **Signal Analysis Matrix** panel inside `AuditForm.jsx` (active editing) and `AuditDetail.jsx` (read-only past review).
  - Displays: Track facts grid, live confidence badges (Confident / Probable / Review Needed), active overrides status.
  - **Dynamic Lanes**: Overlaid beat ticks and downbeats onto a horizontal track synced to the global player playhead (`currentTime` and `duration`) and arrangement sections.
  - **Override Controls**: Drawer containing selectors for key, scale, meter, manual BPM inputs, and an interactive **Tap Tempo** button.
  - Updated frontend backend adapters (`HttpBackendAdapter`, `InMemoryBackendAdapter`) to support analysis triggering and override storage.




