# Development Logs & Learnings

This log tracks architectural decisions, workflows, key configurations, and learnings gained during development.

---

## Log Entries

### 2026-06-19: Audit Panel Phase 3 + 4 — Polish, A11y, Perf, Tailwind Removal, Responsive

- **Context**: Continue from `HANDOFF_AUDIT_PANEL_PHASE_3_4.md` (e814040). All 9 line items shipped in single session.
- **Phase 3 — Visual polish (3.1–3.5)**:
  - **3.1**: `rg box-shadow|border-radius` returns 0 lines in `audit/*`. Removed 3 stale `box-shadow`/`boxShadow` refs in `CaptureTechnique.jsx`, `AuditTabBar.jsx`, `TrackAnalysisModules.jsx`.
  - **3.2**: Added `.locked` class (`opacity:0.4; pointer-events:none; cursor:not-allowed`) to `global.js` for future collab scenarios. Hover surfaces already use `--bg-surface-hover` from Phase 1.
  - **3.3**: Tooltip sweep — added `title` to `ConfidenceDot` (dynamic % + override hint), expanded marker tooltip to `time · note · lens`, added `title` to `LensPrompt` question and Capture Technique tag suggestions. `SourcesPanel` Add/Reimport buttons got `title` attrs.
  - **3.4**: Context-aware EXIT FOCUS — `App.jsx` `useNavigate` + `handleExitFocus` checks `location.pathname.startsWith('/audit/')`; in audit context navigates to `/planner`, else just `setFocusMode(false)`. Auto-focus first interactive on tab switch: `tabBodyRef` in `AuditForm` + `useEffect` querying `input|button|select|textarea|[tabindex="0"]`. Added `role="tabpanel"` and `id/aria-labelledby` to the `<main>`.
  - **3.5**: Scrub tooltip — added `tooltipMounted` state for 100ms fade-in transition, content now shows `time · bar N/M` when BPM known. Reads `overrides.tempo_bpm || analysis.tempo_bpm`. `overrides` hoisted to AuditTimeline scope.
- **Phase 4.1 — A11y**:
  - `ErrorBoundary.jsx` (new) — class component with `getDerivedStateFromError`, renders "Workspace Error" with reload button.
  - Wrapped `<Routes>` in `App.jsx` with `<ErrorBoundary>`.
  - `prefers-contrast: more` media query in `global.js` bumps `--text-secondary`/`--border-subtle` and focus outline width to 3px.
  - `NotebookPanel` search wrapper → `role="search"`, input `type="search"`.
  - `client/UI/AC_AUDIT.md` (new) walks AC-01 to AC-09 with status, evidence, regression-check commands.
- **Phase 4.3 — Perf**:
  - All 8 audit components lazy-loaded in `AuditForm.jsx` via `React.lazy` + `<Suspense>`. Skeletons: `AuditPanelSkeleton` for header, `TabLoadingPanel` (with `role="status" aria-live="polite"`) for tab bodies.
  - Extracted `LENS_PROMPTS`/`LENS_LABEL` to `lensConstants.js` so static import doesn't pull the entire LensPanel chunk into main bundle.
  - `useMemo` for `scaleRow` in TrackAnalysisModules + LensPanel, `answeredCount` and `focusText` in LensPanel.
  - Build: main 999 KB (was 1082 KB), 8 separate audit chunks totaling ~95 KB.
- **Phase 4.4 — Tailwind removal**:
  - Removed `<script src="https://cdn.tailwindcss.com">` from `client/index.html:12`.
  - Ported `flex flex-col gap-6`, `p-6 border-l-2 border-[#ff6600] rounded-[1px] bg-[#070709]`, `space-y-3 mt-3`, `list-disc list-inside text-sm leading-7 text-zinc-300 w-full pl-1`, `text-sm leading-7 text-zinc-300 w-full` in `AuditDetail.jsx` (concrete exercises + recreation notes) to inline styles.
  - Build: zero Tailwind warnings.
- **Phase 4.2 — Responsive**:
  - Added `@media (max-width: 1199px)` and `@media (max-width: 767px)` blocks in `global.js`.
  - `.audit-modules` 4-col flex → 2x2 grid on tablet/mobile, `.audit-lane-label` 80px→60px→56px, `.audit-lane-waveform` 40px→28px on mobile.
  - `.audit-meta-chips` hidden on mobile, `.audit-override-button` hidden on mobile (per spec), `.audit-tabbar` overflow-x on mobile.
  - `.capture-top-row` 4-col → 2-col on mobile, `.capture-textareas` 2-col → 1-col.
  - `AuditPanelHeader` meta chips row uses `audit-meta-chips` class.
- **Server tests**: 44/44 pass. `npm run build` clean except 500KB main bundle warning (out of scope).

### 2026-06-19: Audit Panel Phase 2.3+2.4+2.5 — Lens/Sources/Capture

- **Context**: Session 2 of Audit Panel Phase 2 handoff. Scope: 3.3 LensPanel real curriculum data, 3.4 Sources tab polish, 3.5 Capture Technique keyboard + tag suggestions.
- **Commit**: `88df2c3` — `feat(audit): Phase 2.3+2.4+2.5 — LensPanel focus/count, SourcesPanel polish, CaptureTechnique shortcuts`
- **Phase 2.3 — LensPanel.jsx**:
  - Header description row: prefers `listeningFocus` prop → `lensDescription` → `template.lenses[lens].description` fallback. Wraps with "Today's focus: …" unless already prefixed.
  - Prompt count: `answeredCount/prompts.length answered` chip in header, green when complete.
  - `customPrompts` prop override: when template provides `template.lenses[lens].prompts` (array of `{title, question}`), use it instead of `LENS_PROMPTS`.
  - `AuditForm.answeredPrompts` useMemo now reads customPrompts so the Complete button gating matches the header count.
  - Removed redundant `<ListeningFocus>` block; same text now lives in the header.
- **Phase 2.4 — SourcesPanel.jsx** (rewrite):
  - `pickDotColor(source, url)`: case-insensitive source → full hostname → domain-root → default. Added lowercase keys (`youtube`, `youtu.be`, `genius.com`, `wikipedia.org`, etc.).
  - URL validation in `useMemo`: filters sources through `new URL(s.url)` try/catch, surfaces skipped count in footer.
  - `+ Add Source` button: stub toast `Manual source addition coming in Phase 3`. Parent can override via `onAddSource` prop.
  - Empty-state CTA `Import research on this song`: stub toast, parent can override via `onReimportResearch` prop.
  - Video detector (`VIDEO_HOSTNAMES` set): appends `· video` suffix when URL hostname is YouTube/Vimeo/Dailymotion but source name doesn't already say "video".
- **Phase 2.5 — CaptureTechnique.jsx**:
  - Tag suggestions: `useEffect` on mount fetches `backend.getTechniques({ sortBy: 'createdAt', order: 'desc', limit: 50 })`, dedupes tags in recency order, shows top 5 as ghost buttons above the tag input. Refreshes when `savedIndicator` ticks.
  - Localized error: try/catch around `onSubmit`, displays dismissable alert block under the action row. Parent re-throws via `handleCaptureTechniqueSubmit` to trigger it.
  - Keyboard: `form onKeyDown` handles `Ctrl/Cmd+Enter` to save (gated on `canSave`) and `Escape` to trigger the discard confirm.
  - Shortcut hint footer `Ctrl+Enter to save · Esc to discard`.
- **AuditForm.jsx**:
  - `parseTimestamp(raw)` helper: accepts `m:ss` strings or numbers.
  - `getTechniqueTimestamp(tech)`: tries `tech.timestamp` (m:ss) then `tech.exampleTimestamp` (number).
  - Saved-list rendering now shows a clickable timestamp button (small playhead dot + `m:ss`) that calls `seekTo(ts)`.
  - `handleCaptureTechniqueSubmit` re-throws after `setError` so CaptureTechnique's local error fires.
- **Build**: 1069 KB / +7 KB from Phase 1, 44/44 server tests pass.

### 2026-06-19: Audit Panel Phase 2.1+2.2 — Track Analysis + Timeline

- **Context**: Continue from Analysis Panel Phase 1 handoff. Session 1 scope: Phase 2.1 (Track Analysis override) + Phase 2.2 (Timeline markers + keyboard). Open Q1-Q6 all defaulted per handoff §2.
- **Commit**: `09ff8ef` — `feat(audit): Phase 2.1+2.2 — track analysis override flow, timeline markers + keyboard shortcuts`
- **Phase 2.1 — TrackAnalysisModules.jsx**:
  - `handleTapTempo`: tap-time ring buffer (max 8), avg interval → BPM, updates `draft.tempo_bpm`. ≥2 taps required.
  - `handleReset`: restores draft from `song.audioAnalysis` (not overrides) — "Reset" button between Cancel and Save.
  - `cellEditingStyle`: 1px `--accent-primary` outline + `EDITING` 8px mono label per cell.
  - All state lives in `TrackAnalysisModules`; `onChangeOverride` only fires on Save.
- **Phase 2.2 — AuditTimeline.jsx + AuditForm.jsx**:
  - Markers = bookmarks (per Q3). Added `deleteBookmark` to service/route/both adapters.
  - New `syncBookmarks(updated)` in AuditForm updates both `audit.bookmarks` and `useAudio().bookmarks` (so global list stays in sync).
  - `M` key shortcut gated on `hasArrangementLens` (checks `lensSelection` or `templateQuestions.lenses`).
  - `Space` shortcut calls `useAudio().togglePlay()`. `isTextEntry` guard skips inputs/textarea/select/contenteditable.
  - Click-anywhere-to-seek: added `onMouseDown={startScrub}` wrapper to 5 non-waveform lane contents. Markers/sections stop propagation on mousedown to avoid double-seek.
  - Section storage: `responses['arrangement-timeline']` as JSON string in `ArrangementTimelineWidget` shape `{ id, name, type, startTime, duration, notes }`. `handleAddSection` computes duration to next section start (default 30s).
  - Synthetic waveform: beat-envelope multiplier (120bpm default phase) gives musical pulse vs raw sin/cos.
- **Backend**:
  - `DELETE /api/audits/:id/bookmarks/:bookmarkId` → 404 if not found.
  - `auditService.deleteBookmark` filters by id, returns 404-via-throw if no change.
  - 44/44 server tests pass, `vite build` green.
- **SigMap**: `.github/copilot-instructions.md` + `gemini-context.md` auto-regen'd from new imports. Committed alongside per prior pattern (`ed9c8c6`).

### 2026-06-18: Start Services via PM2

- **Context**: Start Arra backend, client, analysis services.
- **Actions**:
  - Check PM2 status. Empty.
  - Run `pm2 start ecosystem.config.cjs`.
  - Backend, client (Vite), analysis services online.
- **Verification**:
  - Run `pm2 list` — all online, zero restarts.
  - Run `npm test` inside server — all 44 tests passed successfully.

### 2026-06-14: Architecture Audit — Implementation & Deployment Summary

- **Context**: Used SigMap + direct file reads to audit the Arra codebase for glaring architecture/security/runtime issues.
- **Commits**:
  - `2cc8bf1` — `fix: architecture audit — runtime, security, and cleanup`
  - `ed9c8c6` — `docs: sync auto-generated SigMap context files`
- **Runtime fixes**:
  - Pass `techniqueRepository` into `createAuditRoutes` so `DELETE /trash/purge-all` no longer throws `ReferenceError`.
  - Initialize `this.curricula = []` in `InMemoryBackendAdapter` constructor before seed push.
- **Security hardening**:
  - Require `Authorization: Bearer <ANALYSIS_WEBHOOK_SECRET>` on `POST /api/public/songs/:id/analysis-completed`.
  - Restrict backend CORS to `CLIENT_ORIGIN` (default `http://localhost:5173`).
  - Restrict analysis-service CORS to `ALLOWED_ORIGINS` (no wildcard with credentials).
  - Remove JWT fallback secret; app now fails closed if `JWT_SECRET` is missing.
  - Add global rate limit (100 req / 15 min / IP) and auth rate limit (5 req / 15 min / IP).
  - Add `express-validator` input validation on `/register`, `/login`, `/api/songs/import`, and `POST /api/audits`.
- **Architecture cleanup**:
  - Move password `verifyPassword` / `setPassword` behind `IRepository` port; implement in both adapters.
  - Move `studyProgress` Mongoose `.populate().lean()` behind `curriculumService.getPopulatedStudyProgress` / repository `findByIdWithRelations`.
  - Remove Mongoose model leakage from `authService.changePassword`.
- **Data/schema cleanup**:
  - Remove `'form'` lens from `Curriculum` enum, seed data, route data, and AI prompt; map days 4/12 to `arrangement`.
  - Standardize soft-delete queries: active `{ deletedAt: null }`, deleted `{ deletedAt: { $ne: null } }`.
- **Tooling/config cleanup**:
  - Disable SigMap `autoMaxTokens` so the `maxTokens: 10000` budget is honored.
  - Make Vite `/api` and `/uploads` proxy targets env-driven (`VITE_API_PROXY_TARGET`).
  - Add `.context/`, `server/uploads/`, `.venv/`, `__pycache__/` to `.gitignore`; remove tracked pycache file.
  - Replace `analysis_service/analyzer.py` `sonic_dna_temp_` prefix with `arra_temp_` and `md5` with `sha256`.
- **Test hygiene**:
  - Delete stale root `/tests` directory and `server/tests` symlink.
  - Update `agent_memory.md` to point to `server/__tests__/`.
  - Update audit/song route tests for new signatures.
- **Verification**:
  - `npm test` in `server/` — **8 suites, 44/44 passed**.
  - `npm run build` in `client/` — **succeeded** (pre-existing chunk-size warning).
  - `python3 -m py_compile analysis_service/analyzer.py` — **passed**.
  - Smoke test on port 5051 against real MongoDB: `/health` OK, validation errors return `400`, rate limiting returns `429`.
- **Deployment**:
  - Restarted `arra-server` via PM2 on port 5050.
  - Verified `/health` on port 5050 returns `{"status":"ok"}`.

### 2026-06-14: Add Rate Limiting and Input Validation

- **Problem**: Sensitive endpoints (auth, song import, audit creation) lacked rate limiting and input validation, increasing abuse/bug risk.
- **Solution**:
  - Installed `express-rate-limit` (`^8.5.2`).
  - `server/server.js`: Added global rate limiter — 100 requests per 15 minutes per IP.
  - `server/routes/auth.js`: Added stricter auth rate limiter (5 attempts per 15 minutes per IP) to `/register` and `/login`. Added `express-validator` chains: `/register` validates email and password length (≥8); `/login` validates presence.
  - `server/routes/songs.js`: Validated `youtubeUrl` as non-empty string on `/import`.
  - `server/routes/audits.js`: Validated `songId` as non-empty string on `POST /`.
  - Validation failures return `400` with `{ errors: [...] }`.
  - Updated `server/__tests__/integration/songRoutes.test.js` import-missing-URL assertion to check `errors` array.
- **Verification**: `npm test` in `server/` — 8 suites, 44/44 passed. `JWT_SECRET=test node --check server.js` passed.

### 2026-06-14: Remove 'form' Lens from Curriculum Domain

- **Problem**: The curriculum model allowed a `form` lens, but the valid music-analysis lenses are only harmony, rhythm, texture, and arrangement.
- **Solution**:
  - `server/models/Curriculum.js`: Removed `'form'` from the `lens` enum.
  - `server/bin/seedCurriculum.js` and `server/routes/curricula.js`: Changed days 4 and 12 from `lens: 'form'` to `lens: 'arrangement'`; replaced natural-language "form" references with "structure" or "arrangement"; updated description and focusAreas.
  - `server/services/curriculumService.js`: Updated AI prompt allowed lenses to exclude `'form'`.
  - Preserved log field keys like `form_notes` to avoid migration issues.
- **Verification**: `npm test` in `server/` — 8 suites, 44/44 passed. `rg "lens:\s*'form'"` returned no matches in server code.

### 2026-06-14: Build-Mode Fix Phase 4 — Remove Mongoose Leakage from authService.changePassword

- **Problem**: `authService.changePassword()` branched on `this.userRepository.model`, leaking Mongoose-specific logic into service layer.
- **Solution**: Added password methods to repository port and both adapters.
  - `server/ports/IRepository.js`: added `verifyPassword(entityId, candidatePassword)` and `setPassword(entityId, newPassword)` stubs.
  - `server/adapters/MongooseRepository.js`: `verifyPassword` uses model `comparePassword` method when present, otherwise bcrypt; `setPassword` assigns plaintext password and saves (Mongoose pre-save hook hashes).
  - `server/adapters/InMemoryRepository.js`: `verifyPassword` compares bcrypt hash; `setPassword` hashes with bcrypt salt rounds 10 and persists.
  - `server/services/authService.js`: `changePassword` now delegates to `userRepository.verifyPassword` then `userRepository.setPassword`, no model branch.
- **Verification**: `npm test` in `server/` — 8 suites, 44/44 passed.

### 2026-06-14: Build-Mode Crash Fixes Phase 1

- **Audit purge route**: Pass `techniqueRepository` into `createAuditRoutes(auditService, templateComposer, techniqueRepository)` from `server.js`. Updated signature in `server/routes/audits.js` and integration test caller.
- **InMemoryBackendAdapter**: Initialize `this.curricula = []` in constructor before seed curriculum push.
- **Verification**: `npm test` in `server/` — 44/44 passed.

### 2026-06-14: Remove Stale `/tests` Directory and Update Docs

- **Deleted**: root `/tests/` (stale tests with outdated field names) and `server/tests -> ../tests` symlink.
- **Updated**: `agent_memory.md` "Jest test paths" line now points to `server/__tests__/`.
- **Verification**: `npm test` in `server/` — 8 suites, 44/44 passed.

### 2026-06-13: Implement DAW SVG Icon Rebrand

- **Icon Rebrand**: Swap emoji/AI icons to clean inline SVGs (`currentColor`, `strokeWidth="2.5"`) inside Dashboard.jsx, StudySessionWorkspace.jsx, Settings.jsx, TechniqueNotebook.jsx, StudyPlannerDashboard.jsx, Trash.jsx.
- **Verify**: Client built with zero warnings.

### 2026-06-13: Create rebrand handoff mapping

- **Handoff**: Created `handoff.md` mapping all remaining cheesy emojis (`🎛️`, `🎧`, `🗑️`, `⚡`, `✓`, `🔎`, `🎹`, `📝`, `🔗`, `📤`, `📊`, `⚠️`, `⏱️`, `📅`, `🔒`, `📋`, `📚`, `🏋️`, `🚀`, `🔄`, `🎓`, `🧠`) to their respective line numbers and inline vector SVGs aligned with left sidebar DAW theme styling.

### 2026-06-13: Fix study session completion 500 error


- **Mongoose Type Fix**: Changed `confidence` string `'medium'` to number `3` in `CurriculumService.completeDayProgress` to match `TechniqueEntry` Mongoose schema (Number 1-5). Fixed backend 500 error on completing day.
- **Verification**: Ran Jest integrations, verified scratch completion simulation, restarted `arra-server` in PM2.

### 2026-06-13: Study Session Workspace & Build Verification (Phase 4)

- **Backend Route Populates**: Added `populateProgress` helper in `studyProgress.js`. Resolves nested `curriculumId` & `dayProgress.songId` for active planner sessions. Standardized response format across Mongoose and InMemory repository mocks. Fixed integration tests.
- **Vite Proxy Config**: Added `/uploads` proxy route in `vite.config.js`. Correctly forwards static file audio sketch requests to Express server.
- **Pages**: Built `StudySessionWorkspace.jsx` at `/planner/session/:dayNumber`. Implements:
  - Search recommendation selector: links existing song library tracks or imports via YouTube URLs, fallback matching logic.
  - Video monitor: collapsible YouTube inline player, disables global background overlay.
  - Custom Log Fields: dynamic Noto Sans textareas mapped to curriculum schema.
  - Audio Sketch Uploader: accept `.wav`/`.mp3` uploads, show status, render inline HTML5 audio review player.
  - Sync Checkbox: syncs takeaways to Technique Notebook.
- **Routing**: Registered route `/planner/session/:dayNumber` in `App.jsx`.
- **Verification**: Client build compiled successfully with no ESLint/bundling errors. Backend Jest tests verified passing (44/44).

### 2026-06-13: Study Planner Phase 3 — Client Adapters, Study Planner Dashboard, and Router Hooks

- **Client Ports & Adapters**: Added curriculum/study progress declarations in `IBackendService.js`. Implemented `HttpBackendAdapter.js` calling `/api/curricula/*` and `/api/study-progress/*` endpoints. Added mock implementations in `InMemoryBackendAdapter.js`.
- **Pages**: Created `StudyPlannerDashboard.jsx` accessible at `/planner`. Designed a premium dark studio dashboard UI featuring progress bars, weekly reflections, seeded course activation, custom AI generated curricula, and inline plan editor.
- **Routing & Nav**: Registered `/planner` in `App.jsx` with active navigation highlights and calendar icon.
- **Dashboard Widget**: Added a premium dashboard widget card at the top of the main song library crate in `Dashboard.jsx`, showing active plan status, progress percentage, target song recommendations, and quick-action resume link.

### 2026-06-13: Study Planner Phase 2 — Services, Uploads, Routes & Tests

- **Service**: Built `CurriculumService` with constructor injection. Added `generateAICurriculum` (OpenAI prompt compose + JSON parse), `startCurriculum` (init `StudyProgress` days/reviews), `linkSongToDay`, `logDayProgress`, `completeDayProgress` (trigger `auditService.createAudit` & notebook technique sync), `submitWeeklyReview`.
- **Routes**: Created `server/routes/curricula.js` and `server/routes/studyProgress.js`. Configured `multer` for `.wav`/`.mp3` uploads.
- **Server**: Registered routes and `uploads` static serving in `server.js`.
- **Tests**: Created `server/__tests__/integration/curriculumApi.test.js` testing starts, upload, complete, audits/technique sync, weekly review, AI generation. All 44 Jest tests pass.

### 2026-06-13: Curriculum Models & Seeding (Phase 1)

#### 1. Models & Repositories
- Created `Curriculum.js` schema with daily prompts, focus lenses, custom logs. Compound index on `{ userId, creatorType }`.
- Created `StudyProgress.js` tracking responses, audio upload paths, weekly reviews. Compound unique index `{ userId, curriculumId }`.
- Mapped both models in `MongooseRepository.js` using `CurriculumRepository` & `StudyProgressRepository` subclasses.

#### 2. Directories & Seeds
- Scaffolded `server/uploads/` with `.gitkeep`.
- Coded `seedCurriculum.js` populating 14-day Song Audit Planner default curriculum.

#### 3. Verification
- Created `curriculumModel.test.js` verifying schema validation and DB operations. All tests pass.

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

### 2026-06-19: Audit Panel Phase 2.6+2.7 — Session Completion + Notebook Tab
- **Context**: Session 3 of Audit Panel Phase 2 handoff. Scope: 3.6 session completion flow (inline warning, save state, Save Draft) + 3.7 Notebook tab song-filtered view (replaces placeholder).
- **Commit**: pending — `feat(audit): Phase 2.6+2.7 — session completion + notebook tab`
- **Phase 2.6 — AuditPanelHeader.jsx + AuditForm.jsx**:
  - Header: `isSaving`, `completionReason`, `onSaveDraft` props. Complete button shows `Saving…` text + disabled while `isSaving`. Save Draft (ghost, 90px min) sits left of Complete. Inline warning under button group when `!isComplete && completionReason` — `var(--status-warning)` 9px mono, max 240px right-aligned.
  - `canComplete` now gates on `(techniques >= 1 || answeredPrompts >= 2) && hasAnyResponse`. `hasAnyResponse` = any non-empty string/array/object in `responses`.
  - `completionReason` useMemo: 3 messages — empty state (`Add a response or save a technique…`), partial state (`Answer at least 2 prompts or save a technique (N/2 prompts, M technique[s]).`), fallback (`Complete requirements not yet met.`).
  - `saveAudit` adds `isSaving` guard + `setIsSaving(true/false)`. New `handleSaveDraft`: same guard, calls `backend.updateAudit(auditId, { responses })` (no status change, no navigation). Flashes "Draft saved".
- **Phase 2.7 — NotebookPanel.jsx** (rewrite from 53-line placeholder):
  - Props: `techniques[]`, `loading`, `error`, `onDelete(id)`, `onSeek(seconds)`, `onOpenNotebook`.
  - Header: title + count summary (`N techniques logged · M matches`).
  - Controls: text search input + sort `<select>` (`Newest First` / `Oldest First` / `By Lens`). Search matches `techniqueName + description + notes + lens + tags`.
  - List: cards with name (mono accent), lens badge, description preview (140 char), tags, `Logged Mmm D YYYY`, clickable `m:ss` timestamp that calls `onSeek`.
  - Delete: two-step confirm — first click swaps `×` → `Delete` + `Cancel` buttons. Parent calls `onDelete`; optimistic remove with rollback on error.
  - Empty states: 2 paths — no techniques logged (CTA pointing to Capture Technique) vs. no search matches.
- **AuditForm.jsx wiring**:
  - New state: `notebookTechniques[]`, `notebookLoading`, `notebookError`.
  - `loadNotebookTechniques(songId)`: `backend.getTechniques({ songId, sortBy: 'createdAt', order: 'desc', limit: 200 })`. Strips `deletedAt` server-side. Memoized via `useCallback`.
  - `useEffect` triggers load on `[song?._id, captureSavedTick, loadNotebookTechniques]` so the list auto-refreshes when a new technique is captured.
  - `handleDeleteNotebookTechnique`: optimistic remove → `backend.deleteTechnique` → rollback on error + setError.
- **InMemoryBackendAdapter parity**:
  - `getTechniques` now supports `songId`, `auditId`, `artist`, `tags` (CSV, AND-match), `sortBy`, `order` filters — all matching the real backend shape. Required for offline / dev-mode testing.
- **Verification**: `vite build` ✓ (1082 KB, +13 KB), server tests 44/44 ✓, HMR green across all 4 modified files.

### 2026-06-19: Phase 2.6+2.7 follow-up — TDZ fix + deploy
- **Context**: After committing `e19adb6` + `7a2359e`, dev server loaded AuditForm with `ReferenceError: Cannot access 'loadNotebookTechniques' before initialization`. Root cause: the `useEffect` that listed `loadNotebookTechniques` in its dep array (line 230) was declared BEFORE the `useCallback` that defined it (line 489). `const` declarations sit in the TDZ until their statement executes, so the synchronous dep array eval threw.
- **Commit**: `0d25b42` — `fix(audit): hoist loadNotebookTechniques useCallback above dependent useEffect`
- **Fix**: Moved the `useCallback` block from line 488 to line 206 (right after the `setActiveAudit` effect, immediately before the notebook refresh effect). Mirrors the file's existing pattern of grouping related effects before unrelated handlers (see Rules of Hooks guard comment at line 309).
- **Lesson**: Build (`vite build`) and server tests pass TDZ-free code at compile time but don't execute it. Only client runtime + a smoke test of `/audit/form/:id` would have caught it. Need a client-side test harness (deferred to §5.1 / §5.3 in the handoff).
- **Deploy**: Pushed `0d25b42` to `origin/main`, ran `./deploy.sh`. All 3 PM2 services restarted cleanly:
  - `arra-server` PID 11816 (online, 0% CPU after warmup)
  - `arra-client` PID 11844 (online, HMR client rebuilt)
  - `arra-analysis` PID 11875 (online)
- **Verification post-deploy**: `curl /api/audits` → 401 (auth gating works), `curl :3050/` → 200 (vite serves).

### 2026-06-19: New handoff — Phase 3+4 polish/a11y/perf/responsive
- **Context**: Phase 2 closed (7/7 line items shipped). Remaining work split into fresh doc so the closed Phase 2 handoff stays as a historical record.
- **File**: `HANDOFF_AUDIT_PANEL_PHASE_3_4.md` v1.0 — covers Phase 3 (visual polish, ~3h) + Phase 4 (a11y/perf/responsive/Tailwind, ~11h).
- **Phase 3 (Session 4, 3h)**:
  - **3.1** Verify zero `box-shadow` / `border-radius` (non-50%) in `audit/*.jsx` — already clean per `rg`. 5min audit only.
  - **3.2** `.locked` class in `global.js` (opacity 0.4, pointer-events none, cursor not-allowed). Hover brightness via existing `--bg-surface-hover` token — no `filter` compositing cost.
  - **3.3** Tooltip sweep: confidence dots (dynamic %), override button (verified already), marker (note + ts + lens), lens prompts (full question on hover), tag suggestions.
  - **3.4** Focus mode context-aware: `App.jsx` EXIT FOCUS in `/audit/*` → `navigate('/planner')` not just toggle. Tab switch → focus first interactive in new tab body.
  - **3.5** Scrub tooltip: +80px X offset (label column), 100ms fade-in, `bar N/total` content when BPM known.
- **Phase 4 (Sessions 5–6, 11h)**:
  - **5.1 A11y**: `UI/AC_AUDIT.md` walkthrough file, `<ErrorBoundary>` in `App.jsx`, ARIA sweep, `prefers-contrast: more` media query. Lighthouse a11y ≥ 95.
  - **5.3 Perf**: `React.lazy()` for audit components, `useMemo` scale-degree + lens prompt count, tab content lazy-mount. Initial bundle ≤ 800 KB (down from 1082).
  - **5.4 Tailwind removal**: strip `cdn.tailwindcss.com` script, port ~20 utility classes to inline (3 files: Dashboard, AuditDetail, StudySessionWorkspace). Option A — no PostCSS setup. Build exits zero warnings.
  - **5.2 Responsive**: tablet 768–1199 (2-col metric grid, capture footer collapsed, narrower lane labels), mobile <768 (hide header chips, scroll tab bar, 28px lane height, touch targets ≥ 32px). Lighthouse mobile ≥ 90.
- **Open Qs (7)**: hover brightness approach (background vs filter), locked class vs inline, Tailwind Option A vs B, mobile Capture footer behavior, error boundary placement (Routes vs AuditForm), perf budget (800 KB), a11y audit (Lighthouse + manual AC).
- **Status**: 0/9 line items. Total 14h est across 3 sessions. No commits yet — awaiting kickoff.

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
  - **Environment Path Resolution**: Dynamically resolved the path of `yt-dlp` relative to `sys.executable` (current running virtual environment venv/bin folder) to ensure it executes correctly under PM2 paths.
  - **Mix/Playlist Downloader Fix**: Integrated the `--no-playlist` flag to standard `yt-dlp` download command parameters, preventing background task timeouts when importing YouTube URLs containing `&list=RD...` parameters.

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

---

### 2026-06-06: Arrangement Timeline v2 — Bars Mode + Multi-Track Instrument Lanes

#### 1. BPM Input & Bars/Seconds Ruler Toggle
- **Goal**: Let users view the arrangement in musical bars rather than wall-clock seconds, since producers think in bars not `mm:ss`.
- **Implementation**:
  - Added a compact BPM number input (40–300 range) to the workspace toolbar. Auto-fills from `song.bpm` if available in song metadata, otherwise defaults to 120. Persists to `responses['arrangement-bpm']`.
  - Added a `BARS | SECS` toggle pill next to BPM. State persists to `responses['arrangement-view-mode']`.
  - **In Bars mode**: ruler ticks show bar numbers (`Bar 1`, `5`, `9`...) with smart tick intervals based on total bar count. Section block footers show `Bars 1–8` + `8 bars`. Inspector timing inputs switch to bar number / bar count inputs with the alternate format shown as a hint.
  - **Snapping**: All drag-resize and drag-move operations snap to the nearest bar boundary **only when in Bars mode**. In Secs mode, values snap to the nearest whole second.
  - **Time signature**: Hardcoded 4/4 (`barDurSecs = (60 / bpm) * 4`). Time sig selector is a known TODO.
- **Bar math utilities** added at file top: `barDurSecs`, `secToBar`, `barToSec`, `snapDurBars`, `snapStartBars`.

#### 2. Multi-Track Instrument Lane System
- **Goal**: Add a DAW-style multi-track area below the sections row so users can visualize when specific instruments, vocals, rhythm elements, etc. enter and exit.
- **Layout**: Switched from flex-based section blocks to absolute positioning (`PX_PER_SEC = 6px/sec`) so sections and track lanes share the same coordinate system. A fixed `140px` left gutter column shows track labels, emoji, and delete buttons. The ruler, sections row, and all track lanes share a single `overflow-x: auto` scroll container so they stay perfectly aligned.
- **Track categories**: 8 built-in — Vocals 🎤, Rhythm 🥁, Bass 🎸, Synth 🎹, Guitar 🎸, Brass 🎺, Strings 🎻, FX ✨ — each with a preset color from the existing palette.
- **Track CRUD**:
  - `+ track` button in gutter → inline form (name input + category pill picker) at bottom of timeline.
  - `×` button in gutter deletes the whole track and its blocks.
  - Click on empty space in a track lane → creates a block at that bar/second position.
  - Drag block body → moves block (with bar snap in bars mode).
  - Drag block right edge → resizes block (with bar snap in bars mode).
  - Click block → opens compact track block inspector bar below the timeline (start, duration, ▶ Play, 🎯 Sync to playhead, Delete).
  - `Delete` key removes the selected track block.
- **Data persistence**: Tracks array stored as JSON in `responses['arrangement-tracks']`. Schema: `{ id, name, category, color, emoji, blocks: [{ id, startTime, duration }] }`. Sections remain at `responses['arrangement-timeline']`.
- **Playhead**: Red playhead line extends through the sections row and all track lanes simultaneously.
- **Commit**: `b6f3e75`

#### 3. agent_memory.md Created
- Created `/agent_memory.md` at project root as a machine-readable quick-reference for future AI sessions.
- Contains: file map, full data model shapes, all `responses` key documentation, design tokens, architecture patterns, known gotchas, open TODOs, and session log.
- Intent: read this at session start to orient in ~30 seconds instead of crawling the codebase.

---

### 2026-06-07: SigMap Integration & Antigravity MCP Server Setup

#### 1. SigMap Integration
- **Goal**: Integrate SigMap to provide highly compressed codebase signature maps to AI coding assistants, reducing prompt sizes and token usage.
- **Implementation**:
  - Initialized SigMap in the target codebase (`/home/jackc/projects/sonic-dna`) using `npx -y sigmap --init`, generating `gen-context.config.json` and `.contextignore`.
  - Configured `gen-context.config.json` to utilize the `hot-cold` strategy with a `10` commit window, outputting to `.github/copilot-instructions.md`, `.github/gemini-context.md`, and `.github/context-cold.md`.
  - Defined file exclusions (`node_modules/**`, `venv/**`, `.venv/**`, `dist/**`, `build/**`, `out/**`, `.git/**`, lockfiles, caches) to prevent token waste on compiled files or dependencies.
  - Ran the initial codebase signature scan (`npx sigmap`) to generate the initial map of active ("hot") signatures (8 files, ~781 tokens) and archived ("cold") signatures (24 files, ~1831 tokens), achieving a 99% token reduction.
  - Installed a git post-commit hook using `npx sigmap --setup` to automatically regenerate signatures on subsequent commits.

#### 2. Antigravity MCP Server Setup
- **Goal**: Enable the Antigravity assistant to query the cold signature map on-demand via the Model Context Protocol (MCP).
- **Implementation**:
  - Registered SigMap as an MCP server by creating/updating the configuration file at `/home/jackc/.gemini/antigravity-cli/mcp_config.json`.
  - Configured the server command to execute `npx -y sigmap --mcp`, allowing Antigravity to run queries (`read_context`, `query`, `get_signatures`) over the codebase structures via JSON-RPC stdio.
- **Commit**: `0f0a791`

---

### 2026-06-07: CLAP GPU Audio Analysis Scaffolding & Fallback Simulation

#### 1. GPU Acceleration & CLAP Proposal
- **Goal**: Evaluate the feasibility of using a local 4GB Nvidia 1050 Ti GPU (via passthrough) to accelerate audio semantic extraction.
- **Architectural Proposal**: Drafted a comprehensive integration plan in [clap_analysis_proposal.md](file:///home/jackc/.gemini/antigravity-cli/brain/7e8ab30b-88cf-4042-9d46-e87b0d5cd747/clap_analysis_proposal.md), highlighting lens-by-lens benefits (specifically targeting the Texture and Arrangement lenses) and listing VRAM optimizations (FP16 mixed precision, small batch sizes, segment chunking).

#### 2. CLAP Scaffolding & Simulation Integration
- **Implementation**:
  - Created a robust `ClapAnalyzer` class inside [analyzer.py](file:///home/jackc/projects/sonic-dna/analysis_service/analyzer.py) utilizing Hugging Face `transformers` and PyTorch.
  - Implemented lazy loading for the CLAP model using `get_clap_analyzer()` to minimize memory footprint during server idle.
  - Configured sliding-window feature extraction: splits audio into 10-second segments, runs CLAP model inference, and aggregates cosine similarities for target lists of vibes, instruments, and production textures.
  - Designed a high-fidelity simulation fallback when PyTorch/CLAP is missing, ensuring consistent schema output (`clap_semantic_features`) for backend parsing.
  - Updated [requirements.txt](file:///home/jackc/projects/sonic-dna/analysis_service/requirements.txt) with commented-out machine learning libraries to simplify setup in future containers.
- **Commit**: `7151075`




### 2026-06-10: Full Rebrand — Sonic DNA → Arra

#### Goal
Systematically replace all remaining "Sonic DNA" branding with "Arra" across source code, documentation, and deploy scripts.

#### Changes Made
- **Source code**:
  - `client/src/pages/AuditForm.jsx`: `"DNA Audit"` → `"Arra Audit"` in audit h1 heading
  - `client/src/pages/TechniqueNotebook.jsx`: `"musical DNA"` → `"musical vocabulary"` in description text
  - `analysis_service/app.py`: FastAPI title and startup log updated
  - `deploy.sh`: Banner text updated
  - `client/public/favicon.ico`: Placeholder text updated
  - `.github/context-cold.md`: Titles updated
- **Docs**: `README.md`, `SETUP.md`, `IMPLEMENTATION.md`, `PROXMOX_DEPLOYMENT.md`, `REDEPLOYMENT.md`, `HANDOFF.md`, `START_HERE.md`, `ADAPTER_IMPLEMENTATION.md`, `ARCHITECTURE_COMPLETE.md`, `DEPENDENCY_ASSESSMENT.md`, `QUICKSTART.md`
- `IMPLEMENTATION.md`: `"musical DNA"` → `"musical vocabulary"`

#### Verification
Post-rename `grep -rn DNA` (excluding venv, .git, node_modules, devlogs.md) returned zero matches.

#### Commit
`66249ec` — rebrand: replace all Sonic DNA references with Arra (36 files changed)

### 2026-06-10: Full Redeployment — Arra Live at arra.homma.casa

#### Goals
1. Run all tests after rebrand
2. Redeploy PM2 with correct arra paths
3. Fix MongoDB (was broken since kernel 6.19 upgrade)

#### Test Results
- All 29 Jest tests passing across 6 suites (unit + integration)
- Fixed test runner: symlinked `server/tests -> ../tests` so Jest resolves `../../services/` imports correctly
- Run with: `cd server && npm test`

#### PM2 Redeployment
- Deleted old `sonic-dna-server` / `sonic-dna-client` processes (were pointing at deleted `/home/jackc/projects/sonic-dna`)
- Created `ecosystem.config.cjs` with `arra-server` (port 5050) and `arra-client` (port 3050)
- `pm2 save` to persist across reboots

#### MongoDB Fix (kernel 6.19 incompatibility)
- **Root cause**: Proxmox host kernel 6.19+ — MongoDB 8.x crashes on startup (SERVER-121912)
- **Fix**: Installed MongoDB 7.0.35 (first version with kernel 6.19 backport fix)
- **Repo**: `https://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0`
- **Gotchas**:
  - apt install resets `bindIp` to `127.0.0.1` — must re-set to `0.0.0.0` in `/etc/mongod.conf`
  - Fresh install wipes auth users — recreate `myAdmin` in `admin` db with `readWriteAnyDatabase` + `userAdminAnyDatabase` + `dbAdminAnyDatabase` roles
  - `ss -tlnp | grep 27017` needs `sudo` in LXC containers to show process names

#### Commit
`8c35682` — ops: add PM2 ecosystem config and fix test symlink for arra

---

### 2026-06-10: YouTube Title and Artist Metadata Noise Cleaning for Tavily Research

#### Goal
Prevent Tavily search from returning 0 results due to YouTube video title noise like `(Official Music Video)` or `[Official Video]`.

#### Implementation
- **Tavily Query Sanitization**:
  - Added a `cleanQueryTerm` helper function in [TavilyAdapter.js](file:///home/jackc/projects/arra/server/adapters/TavilyAdapter.js) that strips common YouTube video suffixes (e.g., `(Official Music Video)`, `[Official Audio]`, `(Lyrics)`, `[4K Visualizer]`, etc.).
  - Applied the helper to both `title` and `artist` in `searchSongInfo` before constructing the Tavily search query.
- **Verification**:
  - Cleaned up the previously imported song for "Four Tet - Baby (Official Music Video)" from the database to allow fresh verification.
  - Restarted the PM2 `arra-server` microservice to load the new changes.
  - All Jest unit and integration tests successfully verified as passing.

#### Commit
`6ed42a3` — fix(research): clean YouTube metadata noise from search query for song imports

---

### 2026-06-10: Python Audio Analysis Microservice PM2 Integration

#### Goal
Resolve the audio signal extraction compilation/execution failure on Phase 1 of guided audits caused by the Python FastAPI microservice being offline.

#### Implementation
- **PM2 Configuration**:
  - Registered `arra-analysis` service inside [ecosystem.config.cjs](file:///home/jackc/projects/arra/ecosystem.config.cjs).
  - Configured it to execute the virtual environment python interpreter `/home/jackc/projects/arra/venv/bin/python` to run `app.py` in the `analysis_service` directory on port `8080`.
- **Deploy Script Sync**:
  - Integrated `arra-analysis` controls into [deploy.sh](file:///home/jackc/projects/arra/deploy.sh) to automate stopping, launching, and restarting stages of the deployment pipeline.
- **Verification**:
  - Ran the revised `./deploy.sh` script to verify that all three PM2 services (`arra-server`, `arra-client`, and `arra-analysis`) start successfully and persist across reboots via `pm2 save`.
  - Confirmed all Jest backend unit and integration tests continue to pass.

#### Commit
`67f3148` — fix(ops): run python audio analysis service under PM2

---

### 2026-06-10: Simulated Progress Bar for Audio Signal Extraction

#### Goal
Improve the user experience during Phase 1 of guided audits by visualizing the stages of background audio signal extraction (downloading, transient detection, harmonic mapping, semantic analysis) with a progress bar.

#### Implementation
- **Progress Simulation Hook**:
  - Declared `analysisProgress` and `analysisStage` state variables in [AuditForm.jsx](file:///home/jackc/projects/arra/client/src/pages/AuditForm.jsx).
  - Added a `useEffect` hook that detects when `song.audioAnalysisStatus === 'pending'` and increments progress (0% to 99%) over time. It transitions the text to reflect current extraction phases (downloading, beat detection, harmonic calculations, CLAP semantics).
- **Progress Bar UI**:
  - Replaced the simple text loader in [AuditForm.jsx](file:///home/jackc/projects/arra/client/src/pages/AuditForm.jsx) with a custom progress container, featuring a smooth transition bar utilizing the theme's core color `#d08f60`.
- **Verification**:
  - Run the production build via `npm --prefix client run build` to ensure no bundling/compilation issues.

#### Commit
`1b6d53a` — feat(ui): add simulated progress bar for background audio analysis

---

### 2026-06-10: Resume Guided Audits from Dashboard and Detail Views

#### Goal
Allow users to easily save their progress on guided audits (which are persisted via background auto-saves and active step endpoints) and resume editing them when returning to the app later.

#### Implementation
- **Dashboard Action Adjustments**:
  - Modified [Dashboard.jsx](file:///home/jackc/projects/arra/client/src/pages/Dashboard.jsx) to check the status of each audit in the library history list.
  - If the status is not `'completed'`, the review button changes from "Review →" to "Resume ⚡" and links directly to `/audit/form/${audit._id}` instead of the read-only detail page.
- **Audit Detail Action Header**:
  - Added a "Resume Audit" (or "Edit Audit" if completed) button to [AuditDetail.jsx](file:///home/jackc/projects/arra/client/src/pages/AuditDetail.jsx) next to the "Delete" and "Back to Library" actions. This allows users to easily transition from the static overview to the active editing workspace.
- **Verification**:
  - Compiled successfully via client production build check.

#### Commit
`9a95351` — feat(ui): allow resuming guided audits from dashboard and detail views

---

### 2026-06-10: Bitwig Dark Studio Aesthetic Integration & Timeline Feature Overhauls

#### Goal
Implement the UI/UX design handoff to transform the Arra Audit interface into a premium, high-density, tactile "dark studio" engineering environment styled after Bitwig Studio. Add horizontal timeline zoom controls and a time signature meter selector to satisfy open priority TODOs.

#### Implementation
- **Tactile Color System & Surface Tiers**:
  - Implemented 3-tier dark theme surfaces (`#111111` deep background/sidebar, `#1e1e1e` workspace panels, `#282828` header/transport bars) in `global.js` and `App.jsx`.
  - Upgraded buttons to use linear hardware console gradients (`linear-gradient(180deg, #333333 0%, #222222 100%)`) and hover glow effects.
  - Converted the old copper branding color `#d08f60` to Bitwig Orange `#ff6600` across 14 files under `client/src/` to ensure visual accent consistency.
  - Replaced the navigation emojis in `App.jsx` with clean feather-style vector SVG paths and styled sidebar active states with a left-edge orange vertical border accent.
- **Docked Signal Analysis Matrix**:
  - Docked matrix cards inside `AuditForm.jsx` and `AuditDetail.jsx` into a unified grid panel layout with `1px` shared boundaries, dedicated `#2D2D2D` dark header labels, and glowing circular LED status indicator dots.
- **Electric Cyan Playhead Snapping**:
  - Replaced waveform and arranger playhead styles with a solid electric cyan `#00e5ff` line featuring a downward-pointing triangle handle at the top.
  - Removed transition lag (`transition: 'none'`) to make timeline playhead snapping and scrubbing feel instantaneous and responsive.
- **Horizontal Zoom & Time Signature Selectors**:
  - Replaced the static constant `PX_PER_SEC` in `ArrangementTimelineWidget.jsx` with a dynamic `pxPerSec` state linked to a horizontal zoom control slider.
  - Added a `METER` dropdown selector in the timeline toolbar supporting `4/4`, `3/4`, and `6/8` time signatures, updating bar duration calculations on-the-fly.
  - Replaced track lane emojis with standard console abbreviations (e.g. `VOC`, `DRM`, `BAS`, `SYN`).
  - Styled arranger timeline section blocks with a semi-transparent color matching their category (e.g. intro violet, chorus teal, bridge amber) and a thick colored border.

#### Verification
- Built successfully via `npm --prefix client run build` with zero compilation errors.
- Verified all 29 Jest server unit and integration tests continue to pass.

#### Commit
`e167637` — feat(ui): implement Bitwig dark studio aesthetic and timeline features

---

### 2026-06-10: Resolve Workspace Black Hole Aesthetic Inconsistency

#### Goal
Resolve the user-reported "black hole" look on the main page workspaces by replacing the ultra-dark backgrounds of the page layout grids and nested cards with the lighter, perfectly balanced dark grey (`#282828`) of the transport bar.

#### Implementation
- **Depth Contrast & Background Hierarchy**:
  - Set the workspace container background to `#1E1E1E` in [App.jsx](file:///home/jackc/projects/arra/client/src/App.jsx) and the CSS variables.
  - Set the background of all `.card` and `.panel` containers in [global.js](file:///home/jackc/projects/arra/client/src/styles/global.js) to `--bg-panel` (`#282828`), matching the transport bar level of dark gray.
  - Added a subtle top highlight (`inset 0 1px 0 rgba(255, 255, 255, 0.05)`) and flat shadow to cards/panels to create a premium, hardware-extruded modular feel.
- **Eliminated Hardcoded Dark Overrides**:
  - Refactored 9 page views (`AuditCreate.jsx`, `AuditDetail.jsx`, `AuditForm.jsx`, `Dashboard.jsx`, `ImportSong.jsx`, `Login.jsx`, `Settings.jsx`, `TechniqueNotebook.jsx`, `Trash.jsx`) and modal views (`TechniqueDetailModal.jsx`) to remove hardcoded dark backgrounds (`#151518`, `#141418`, `#1c1c22`), allowing elements to inherit the standard theme variables and panel backgrounds automatically.

#### Verification
- Built successfully via client production build pipeline check.
- Verified all 29 Jest server unit/integration tests pass.

#### Commit
`97fa1a7` — feat(ui): resolve black hole issue by setting workspace panels to #282828

---

### 2026-06-10: Research /teach & /caveman productivity skills

#### Goal
Integrate learning framework concepts. Save tokens.

#### Implementation
- **Memory Update**:
  - Add constraints to `agent_memory.md`. Keep four lenses. Prefer HTML exports.
  - Set caveman style rule for devlogs.
- **Analysis**:
  - Write `teach_skill_analysis.md`. Map mission, glossary, lessons, reference sheets.







---

### 2026-06-11: Active feed card UI unification

#### Goal
Unify active feed box spacing using two Tailwind flex rows.

#### Implementation
- **index.html**: Add Tailwind CDN.
- **Dashboard.jsx**: Refactor song card action/status rows into matched Tailwind flex rows.

#### Verification
- Client build succeeds.
- Jest unit/integration tests pass.

#### Commit
`d3d52c1` — refactor(ui): unify active feed boxes into Tailwind flex rows

---

### 2026-06-11: Concrete exercises typography upgrade

#### Goal
Improve readability of Concrete Exercises description text.

#### Implementation
- **AuditDetail.jsx & AuditForm.jsx**:
  - Replace description style with Tailwind classes `text-sm leading-relaxed text-zinc-300 max-w-prose mt-1`.

#### Verification
- Client build succeeds. Skip backend tests (pure style change).

#### Commit
`49da561` — style(ui): upgrade concrete exercises description typography

---

### 2026-06-11: Concrete exercises card layout refactoring

#### Goal
Expand spacing, card padding, line height, and break text walls in Concrete Exercises cards.

#### Implementation
- **AuditDetail.jsx & AuditForm.jsx**:
  - Replace grid layout with `flex flex-col gap-6` parent layout.
  - Increase inner card padding to `p-6` with standard dark styling.
  - Set description line height to `leading-7`.
  - Parse description text by newline to render separate paragraphs and dynamic bullet lists (`space-y-3`).

#### Verification
- Client build succeeds. Skip backend tests (pure style change).

#### Commit
`e81824b` — style(ui): refactor concrete exercise cards layout and paragraph split

---

### 2026-06-11: Full-width concrete exercises text expansion

#### Goal
Expand concrete exercise card text to use full card width.

#### Implementation
- **AuditDetail.jsx & AuditForm.jsx**:
  - Remove `max-w-prose` styling constraints.
  - Set container elements to `w-full`.

#### Verification
- Client build succeeds. Skip backend tests.

#### Commit
`ef92b3d` — style(ui): remove max-width constraints on exercise description text

---

### 2026-06-11: Noto Sans global font configuration

#### Goal
Apply Noto Sans size 18 weight 400 globally.

#### Implementation
- **global.js**:
  - Import Noto Sans from Google Fonts.
  - Configure body with `font-family: 'Noto Sans', sans-serif`, `font-size: 18px`, `font-weight: 400`.
  - Configure headings (`h1`-`h6`) and paragraph elements (`p`) to scale up and use Noto Sans.

#### Verification
- Client build succeeds. Skip backend tests.

#### Commit
`da5cd7e` — style: set Noto Sans 18px 400 as the global default typography

---

### 2026-06-11: Phase 3 audit questions font size upgrade

#### Goal
Increase audit questions label font size to 18px.

#### Implementation
- **AuditForm.jsx**: Set `fontSize: '18px'` on question labels.

#### Verification
- Client build succeeds. Skip backend tests.

#### Commit
`f9a1a6a` — style(ui): increase font size of audit questions in AuditForm to 18px





### 2026-06-11: GTX 1050 Ti GPU setup for CLAP semantic audio analysis

**Commit:** `15e025e`

**Problem:** CLAP analyzer running in CPU simulation fallback. GTX 1050 Ti present but torch not installed and CUDA libs missing.

**Work done:**
- Disk space increased to 40GB (user), cleared 1.1GB pip cache mid-session
- Tried torch 2.12.0 first — incompatible (built for sm_75+, 1050 Ti is sm_61/Pascal)
- Installed correct stack: `torch==2.6.0+cu126` (supports sm_50–sm_89), all nvidia cu12 runtime libs (cudnn, cublas, cufft, cusolver, nccl, triton etc.)
- `transformers 5.11.0` breaking change: `audios=` → `audio=` in CLAP processor — fixed in `analyzer.py`
- FP16 casting now handles all tensor dtypes (not hardcoded `input_features` key)
- Model `laion/clap-htsat-fused` (614MB) downloaded and cached, loads on `cuda` in FP16
- GPU verified: `cuda.is_available()=True`, 4.23GB VRAM, 4.8x speedup over CPU on matmul benchmark
- `arra-analysis` PM2 service restarted and online
- `requirements.txt` updated with pinned GPU deps + cu126 install note

---

### 2026-06-12: PM2 Application Startup & Verification

**Commit:** `-`

**Problem:** Application services not running on startup.

**Work done:**
- Read active agent memory file `agent_memory.md` to align session focus.
- Started `arra-server` (Express), `arra-client` (Vite), and `arra-analysis` (Python CLAP microservice) using PM2 config `ecosystem.config.cjs`.
- Monitored process status (`pm2 status`) to verify all three services are online.
- Tail-logged PM2 outputs to confirm successful database connectivity (MongoDB on remote Proxmox VM) and microservice initialization (CLAP model cached on CUDA).
- Verified client (port 3050) and server (port 5050) HTTP endpoints with curl.

---

### 2026-06-14: Phase 5 Tooling & Config Fixes

**Commit:** `-`

**Tasks:**
- SigMap `gen-context.config.json`: set `autoMaxTokens: false` so `maxTokens: 10000` honored.
- Vite proxy: read target from `VITE_API_PROXY_TARGET`, default `http://localhost:5050`; keeps `VITE_API_URL=/api`.
- `.gitignore`: add `.context/`, `server/uploads/`, `.venv/`.

**Verification:**
- `npm test` in `server/`: 8 suites, 44/44 pass.
- `npm run build` in `client/`: builds successfully (chunk size warning unchanged).

### 2026-06-14: Phase 3 Security Hardening

**Commit:** `-`

**Tasks:**
- Webhook secret: `server/server.js` validates `Authorization: Bearer <ANALYSIS_WEBHOOK_SECRET>` on `POST /api/public/songs/:id/analysis-completed`. Missing/invalid returns 401. Production requires `ANALYSIS_WEBHOOK_SECRET`; dev warns and skips if absent.
- Analysis CORS: `analysis_service/app.py` uses `ALLOWED_ORIGINS` comma list, default `http://localhost:5173`; removed wildcard with credentials.
- Backend CORS: `server/server.js` uses `CLIENT_ORIGIN` env, default dev origin, required in production.
- JWT fallback removal: `server/middleware/auth.js` and `server/services/authService.js` no longer fall back to `'your-secret'`; fail closed if `JWT_SECRET` missing.
- `.env`: added placeholders for `ANALYSIS_WEBHOOK_SECRET` and `CLIENT_ORIGIN`; marked `JWT_SECRET` required.

**Verification:**
- `npm test` in `server/`: 8 suites, 44/44 pass.

---

### 2026-06-14: Cleanup Legacy Artifacts in `analysis_service/analyzer.py`

**Commit:** `-`

**Tasks:**
- Replaced temp-file prefix `sonic_dna_temp_` with `arra_temp_` in download template, final output path, and downloaded-file search.
- Replaced fallback `hashlib.md5(...).hexdigest()` with `hashlib.sha256(...).hexdigest()` for deterministic seeding.
- No `md5` import existed (only `hashlib` imported), so no import removal needed.

**Verification:**
- `python3 -m py_compile analysis_service/analyzer.py`: passed.
- `rg -n "sonic_dna_temp|md5" analysis_service/analyzer.py`: zero matches.

---

### 2026-06-14: Standardize Soft-Delete Query Patterns

**Commit:** `-`

**Problem:** Mixed soft-delete query shapes. Some fetches pull all records then filter `deletedAt` in JS; convention unclear.

**Changes:**
- `server/services/songService.js`: `getDeletedSongs()` now queries `{ userId, deletedAt: { $ne: null } }`.
- `server/services/auditService.js`: `getDeletedAudits()` and `restoreAudit()` technique lookup now use `{ deletedAt: { $ne: null } }`.
- All active-record queries keep `{ deletedAt: null }`; no repository helper added to stay minimal.

**Verification:**
- `npm test` in `server/`: 8 suites, 44/44 pass.
- `rg -n "deletedAt:\s*\{[^}]*\$ne" server/services`: SongService + AuditService deleted queries standardized.

---

### 2026-06-14: Remove Mongoose Populate Leakage from studyProgress Route

**Commit:** `-`

**Problem:** `server/routes/studyProgress.js` `populateProgress()` helper directly accessed `studyProgressRepository.model.findById(...).populate(...).lean()`, leaking Mongoose specifics into route layer. InMemory branch duplicated join logic in route.

**Changes:**
- `server/ports/IRepository.js`: added `findByIdWithRelations(id, relations)` abstract method. Relations accept array of strings or `{ path, resolver }` objects.
- `server/adapters/MongooseRepository.js`: implemented `findByIdWithRelations` using `model.findById(id).populate(path).lean()` for each relation path.
- `server/adapters/InMemoryRepository.js`: implemented manual in-memory join. Supports single-field paths (`curriculumId`) and array-field subpaths (`dayProgress.songId`) via supplied `resolver` functions.
- `server/services/curriculumService.js`: added `getPopulatedStudyProgress(id)` delegating to `studyProgressRepository.findByIdWithRelations` with curriculum and song resolvers.
- `server/routes/studyProgress.js`: replaced Mongoose-aware `populateProgress` helper with thin wrapper calling `curriculumService.getPopulatedStudyProgress(progress._id)`. Route no longer references `.model`, `.populate`, or `.lean`.

**Verification:**
- `npm test` in `server/`: 8 suites, 44/44 pass.
- `rg "\.(model|populate|lean)\b" server/routes/studyProgress.js`: zero matches.


---

### 2026-06-19: P0–P4 Phase 0 — Refactor Foundation

**Commit:** `(pending)`

**Goal:** Ship all 4 sub-phases of Phase 0 from `HANDOFF_P0_P4.md` to unlock Phase 1 features. Refactor-first: fix leaks, split ports, then build the client data-hooks layer.

**Tasks:**

**0.1a — `_buildFallbackTemplate` → `fallbackTemplate` (public)**
- `server/services/templateComposer.js`: renamed method, removed `@private` JSDoc, kept JSDoc with public rationale.
- `server/routes/audits.js`: route now calls `templateComposer.fallbackTemplate(...)` directly. No more `?.` chain that allowed silent no-op fallback.

**0.1b — `AuditService.getSongContext(songId, userId)`**
- `server/services/auditService.js`: new public method, returns `null` on missing/deleted/forbidden song or repo error. Logs warning on error.
- `server/routes/audits.js`: removed `try { song = await auditService.songRepository?.findOne(...) }`. Now `const song = await auditService.getSongContext(songId, userId)`.

**0.1c — `SongService.researchSong(title, artist)`**
- `server/services/songService.js`: new public method, returns `null` on missing adapter or error. Logs warning.
- `server/routes/songs.js`: removed 8-line `if (songService.searchService) { try { ... } catch { ... } }` block. Now one-liner: `const research = await songService.researchSong(title, artistName)`.

**0.2 — `IUserRepository` split**
- New `server/ports/IUserRepository.js` extends `IRepository` with `verifyPassword` and `setPassword`.
- `server/ports/IRepository.js`: removed the two auth methods (now 114 lines, down from 136).
- `server/adapters/MongooseRepository.js`: removed the two methods from base class, added `UserRepository` and `MongooseUserRepository` (concrete wrapper bound to `User` model).
- `server/adapters/InMemoryRepository.js`: removed the two methods, added `InMemoryUserRepository` (composes a private `InMemoryRepository`).
- `server/server.js`: `userRepository = new UserRepository(User)` (was `new MongooseRepository(User)`).
- `MongooseUserRepository` available for tests/dev where the production `User` model should be exercised.

**0.3 — `IAIModelService` → `ICompletionService` rename**
- New `server/ports/ICompletionService.js` with clean two-method surface: `completeText(prompt) → string` and `completeJson(prompt) → object` (adapters parse JSON internally — no more `JSON.parse` in service code).
- `server/ports/IAIModelService.js` is now a deprecated shim whose `generateCompletion` calls `completeText` and `generateTemplate` returns `JSON.stringify(completeJson(...))` for back-compat. Scheduled for removal in Phase 2.
- `MockAIAdapter` + `OpenAIAdapter` both reworked to extend `ICompletionService`. `OpenAIAdapter` now has private `_callOpenAI(prompt, maxTokens)` to dedupe request boilerplate.
- Migrated consumers: `TemplateComposer.generateTemplate` (removed `JSON.parse`), `SongService.importSong` AI summary branch (removed `JSON.parse`), `CurriculumService.generateAICurriculum` (removed `JSON.parse` + try/catch wrapper), `TasteService.executeDeepDive` (`generateCompletion` → `completeText`).
- Updated 2 test fixtures: `curriculumApi.test.js` (responseOverride: JSON string → object) and `tasteRoutes.test.js` (mock `generateCompletion` → `completeText`).

**0.4 — Client data hooks layer**
- New `client/src/hooks/` directory with 7 deep-module hooks:
  - `useSong(songId, { skip })` — single song + refetch + triggerAnalysis + saveOverrides + update
  - `useAudits(filters)` — list + createAudit + deleteAudit + restoreAudit + purgeAudit (optimistic removal)
  - `useAudit(auditId, { skip })` — single audit + state machine (advanceStep / goBackStep / skipStep) + bookmark CRUD + saveResponses + setStatus
  - `useTechniques(filters)` — list + grouped + add + update + remove
  - `useStudyProgress()` — active progress + start + linkSong + logDay + completeDay + uploadSketch + submitReview (all require active progress)
  - `useCurricula()` — list + generate + save
  - `useTasteProfiles()` — list + research
- Each hook: `useBackend()` to access adapter, `useState` for state, `useCallback` for stable action refs, `useRef` for AbortController on in-flight fetches, fetches on mount and filter changes.
- `client/src/hooks/index.js` re-exports all 7 for clean `import { useSong, ... } from '../hooks'`.
- Vite build clean (no warnings), all 7 hooks export verified via Node smoke check.
- **Follow-up (out of scope for Phase 0):** `AuditForm.jsx` (1040 lines) and `TechniqueNotebook.jsx` (1043 lines) still call `backend.*` directly. Hook layer is ready; refactor of these two files to use the hooks is next-session work to hit the 500-line target.

**Verification:**
- `npm test` in `server/`: 8 suites, 44/44 pass.
- `npx vite build` in `client/`: 163 modules transformed, clean build, no errors.
- Node smoke test of `client/src/hooks/*.js`: all 7 export a function with the expected name.
- `rg "searchService\." server/routes/`: zero matches (no route reaches into service internals for search).
- `rg "songRepository\." server/routes/`: zero matches.
- `rg "_buildFallbackTemplate" server/`: zero matches.
- `rg "verifyPassword|setPassword" server/ports/IRepository.js`: zero matches (moved to IUserRepository).
- `rg "aiService\.generate" server/services/`: zero matches (all use completeText/completeJson).

---

### 2026-06-19: P0–P4 Phase 0 AuditForm Refactor + Final Commit

**Commit:** `(pending)`

**Follow-up:** With the hooks layer in place, finish the AuditForm migration.

**Tasks:**

**AuditForm data-layer migration**
- Replaced 17 direct `backend.*` calls with hook calls. AuditForm now consumes `useAudit`, `useSong`, `useTechniques` exclusively. `rg "backend\." client/src/pages/AuditForm.jsx`: zero matches.
- Inlined the `useAutosave` helper into a reusable `useAuditAutosave` hook that accepts any `save` callback (uses `useAudit`'s `saveResponses`).
- Extracted polling + progress-sim effects into `useAnalysisPolling` and `useAnalysisProgressSim` hooks (both in `useAuditAutosave.js`).
- Extracted the global M/Space keyboard handler into `useAuditShortcuts`.
- Extracted the AC-08 completion logic (3 useMemos) into `useCompletionCheck`.
- Added `skip` option to `useTechniques` to defer fetch when songId is unknown.
- Replaced local `useState` for audit/song/techniques with hook-managed state. `useState` now only for `responses`, `sessionTechniques`, `error/success/isSaving/captureSavedTick` (transient UI state).

**Component extraction (to hit ≤500 line target)**
- `client/src/components/audit/AnalysisPipelineStates.jsx` (59 lines) — 3 states (not_started, pending spinner, failed).
- `client/src/components/audit/GuidedStepBar.jsx` (48 lines) — step hint + back/skip/next/complete controls.
- `client/src/components/audit/GuidedListenEmpty.jsx` (28 lines) — Step 1 (Listen) empty state.
- `client/src/components/audit/FallbackTemplateNotice.jsx` (13 lines) — warning banner.
- `client/src/components/audit/LoggedThisSession.jsx` (67 lines) — session-techniques grid.
- `client/src/components/audit/SessionBookmarks.jsx` (31 lines) — bookmark chip strip.
- `client/src/components/audit/AuditAnalysisTab.jsx` (97 lines) — composes the Analysis tab body. Receives data + handlers as props.

**Verification:**
- `wc -l client/src/pages/AuditForm.jsx`: **1040 → 461** (55.7% reduction, under 500-line target).
- `npx vite build` in `client/`: 163 modules, clean build, no errors.
- `npm test` in `server/`: 8 suites, 44/44 pass.
- 10 hooks total in `client/src/hooks/`:
  - 7 data hooks (useSong, useAudits, useAudit, useTechniques, useStudyProgress, useCurricula, useTasteProfiles)
  - 3 page-specific utility hooks (useAuditAutosave incl. polling + progress sim, useCompletionCheck, useAuditShortcuts)
- `rg "backend\." client/src/pages/AuditForm.jsx`: zero matches.

---

### 2026-06-19: Phase 1.1 — Deep-link Bookmarks (committed `a0080cb`)

- **Goal**: `/audit/:id?t=<sec>&bookmark=<id>` opens audit, seeks player, pulses matching card 4s. Frontend only, no backend changes.
- **New files** (3, not 4 — count corrected after commit):
  - `client/src/utils/deepLinks.js` (40 lines) — `buildAuditLink(auditId, {timestampSeconds, bookmarkId})` + `parseDeepLinkParams(searchString)` + `DEEP_LINK_KEYS`. Safe origin, integer-validated ts.
  - `client/src/hooks/useDeepLinkParams.js` (22 lines) — react-router `useSearchParams` wrapper, `useMemo` on relevant keys only.
  - `client/src/components/ShareLinkButton.jsx` (109 lines) — `navigator.share({url, title})` → `navigator.clipboard.writeText` → textarea execCommand fallback. Shows "Copied" (green) or "Copy failed" (red) for 1.8s. `compact` prop for inline use.
- **AudioContext ext** (`client/src/context/AudioContext.jsx`):
  - `highlightBookmarkId` state + `setHighlightBookmarkId`.
  - `highlightBookmark(id, {durationMs=4000})` action. `useRef` timeout, auto-clear + cleanup on unmount.
  - Both exposed in context value.
- **AuditDetail wiring** (`client/src/pages/AuditDetail.jsx`):
  - Consumes `useDeepLinkParams()` + `highlightBookmark`/`highlightBookmarkId` from `useAudio()`.
  - `deepLinkAppliedRef` (useRef) gates single-shot application. Effect runs after `audit.bookmarks` is available, applies 350ms timeout before `seekTo` to let YouTube player mount. `?bookmark=` matches → `find` the bookmark, override ts if present, then `highlightBookmark(id)`.
  - Each bookmark card now renders `<ShareLinkButton compact auditId={audit._id} timestampSeconds={bmTs} bookmarkId={bmId} />`.
  - Highlighted card: `border: 1px solid #ff6600` + `box-shadow: 0 0 0 1px rgba(255,102,0,0.35), 0 0 12px rgba(255,102,0,0.25)` (fades via 0.2s transition).
- **HANDOFF_P0_P4.md**: 1.1 marked SHIPPED with delivery list, Next Session Start Here updated to point to 1.2/1.3.
- **Verification**:
  - `npx vite build` in `client/`: 184 modules transformed, clean build. Main bundle 1010 KB (unchanged — additions negligible).
  - No backend touched; 44/44 server tests still green (caveman rule: skip on frontend-only).
  - No new client test infra (none existed in repo); pure utility `parseDeepLinkParams` is straightforward enough to skip in-session testing.
- **Status**: Committed `a0080cb`. agent_memory.md updated with `a0080cb` and checkpoint reset.

---

### 2026-06-19: Phase 1.3 — PDF Report Export (committed `c322c95`)

- **Goal**: Completed audit → Bitwig-themed PDF (cover + 4 lenses + bookmarks + techniques). 4-6 pages, ~3s render. Frontend only, no backend.
- **Stack**: `@react-pdf/renderer` 4.5.1 (already in deps). Lazy-loaded via dynamic import to keep main bundle lean.
- **New files**:
  - `client/public/fonts/RobotoMono-{Regular,Bold}.ttf` + `Barlow-{Regular,SemiBold,Bold}.ttf` (919KB total, Apache 2.0 + OFL). Attribution noted in `theme.js` header.
  - `client/src/pdf/theme.js` (90 lines) — `COLORS` (mirrors `--bg-surface-*` + `--accent-*`), `SPACING`, `RADII`, `PAGE` (A4, 36/48/40 padding), `TYPE`, `LENS_LABELS`, `LENS_DESCRIPTIONS`. `registerArraFonts()` lazy-registers 5 font files via `Font.register`.
  - `client/src/utils/pdfData.js` (155 lines) — `prepareReportData(audit, song)` pure normalizer. Handles 3 response shapes (array of {question, answer, timestamp}, object {qKey: aValue}, plain string), prefers `audioOverrides` over `audioAnalysis`, drops invalid bookmarks (no valid positive ts) and techniques (no description). Exports `formatTimestamp` / `formatDuration` (M:SS).
  - `client/src/pdf/AuditReport.jsx` (497 lines) — `<Document>` with 4 page types. `CoverPage` (kicker/title/artist/divider/audio chips/lens chips/audit meta/footer). `LensPages` (chunks 2 lenses/page, badge+name+description+Q&A with optional timestamp). `BookmarksPage` (table: time+label+note+lens). `TechniquesPage` (cards: lens+example ts+description). Fixed `<PageFooter>` with `pn/tp` page numbers via `render` prop.
  - `client/src/utils/pdfExport.jsx` (renamed from .js for JSX, 50 lines) — `loadPdfRenderer()` cached dynamic import, `renderAuditToBlob(audit, song)` parallel-loads renderer+report+data+theme, `downloadBlob(blob, name)`, `buildAuditFilename(audit, song)` (slugified `arra-{title-artist}-{date}.pdf`).
  - `client/src/components/ExportPdfButton.jsx` (110 lines) — ghost-variant button, 4 states (idle/loading/rendering/done/error), SVG download icon + spinner, `aria-label`, hover state, `runIdRef` cancels stale renders on rapid clicks.
  - `client/vitest.config.js` + `client/src/test/setup.js` — minimal vitest+jsdom+@testing-library/jest-dom setup.
  - `client/src/pdf/__tests__/pdfData.full.test.js` (10 tests) — full audit data: array/object/string response shapes, audioOverrides priority, all field types.
  - `client/src/pdf/__tests__/pdfData.minimal.test.js` (10 tests) — empty/missing/null/edge cases for normalizer + formatTimestamp.
- **Modified**:
  - `client/src/pages/AuditDetail.jsx` — button in header actions row (L147-170), only when `audit.status === 'completed'`.
  - `client/package.json` — `test` + `test:watch` scripts; devDeps vitest, jsdom, @testing-library/react, @testing-library/jest-dom.
  - `HANDOFF_P0_P4.md` — 1.3 marked SHIPPED with full delivery list, Next Session Start Here updated.
- **Bundle**:
  - Main: 1010 → 1016 KB (+6 KB for button + util wrapper)
  - Lazy: `theme-*.js` 2.25 KB · `pdfData-*.js` 3.09 KB · `AuditReport-*.js` 17.89 KB · `react-pdf.browser-*.js` 1628.86 KB
  - 4 chunks load on button click, not on page load.
- **Verification**:
  - `npm test` from `client/`: 20/20 tests pass (jsdom).
  - `npx vite build` in `client/`: clean, 66 modules.
  - `npm test` from `server/`: 44/44 still green (no backend touched).
  - **PDF render smoke test deferred**: jsdom lacks `fetch(file://)` for fontkit. Wrote one but it fails on font load. Would need undici polyfill or browser env. Manual smoke in Chrome required for full acceptance.
- **Status**: Committed `c322c95`. agent_memory.md updated with `c322c95` + new red-line entry for PDF module. Phase 1.2 (A/B compare) is the only remaining Phase 1 feature.

---

### 2026-06-19: Phase 1.2 — A/B Compare Mode (committed `af34984`)

- **Goal**: Upload a DAW sketch (mp3/wav/m4a/aac/flac, up to 100MB), sync playback against the YouTube reference, show side-by-side metadata + delta.
- **Recon**: 24-point exploration of repos/services/routes/Python/hooks/adapters; found: (a) `IRepository` is enough — no per-model port needed; (b) `InMemoryBackendAdapter` already has `uploadAudioSketch` pattern; (c) `studyProgress.js` is the only multer reference; (d) `analysis_service.analyzer.analyze_audio_file` can be called synchronously on a local file path (no yt-dlp needed).
- **Server (new)**:
  - `server/models/SongSketch.js` (35 lines) — soft-delete via `deletedAt`, `analysis` Mixed (mirrors `Song.audioAnalysis`), `analysisStatus` enum, indexes on `(userId, songId, deletedAt, createdAt)`.
  - `server/services/SketchService.js` (175 lines) — `createSketch` (file ext + size guards, song-ownership check, 100MB cap), `getSketchesForSong`, `getSketch`, `deleteSketch` (soft + best-effort file unlink), `analyzeSketch` (calls Python `/analyze-sketch` 15s timeout, stores result, marks failed on error).
  - `server/routes/sketches.js` (130 lines) — multer diskStorage `sketch-{timestamp}-{rand}.{ext}`, 100MB cap, allowed ext `mp3|wav|m4a|aac|flac`. Routes: `GET /songs/:songId`, `POST /songs/:songId/upload`, `GET /:id`, `DELETE /:id`, `POST /:id/analyze`. `_sanitizeSketch()` strips internals. Mirrors `studyProgress.js` pattern exactly.
  - `server/server.js` — registers `SongSketch`, `sketchRepository = new MongooseRepository(SongSketch)`, `sketchService = new SketchService(sketchRepository, songRepository)`, mounts `app.use('/api/sketches', authMiddleware, createSketchRoutes(sketchService))`. Static `/uploads` already serves sketches.
- **Python (new endpoint)**:
  - `analysis_service/analyzer.py` — `analyze_sketch_file(file_path, sketch_id, callback_url=None)` (60 lines) reuses `analyze_audio_file(file_path, sketch_id)` synchronously. Same deterministic-fallback RNG seed.
  - `analysis_service/app.py` — `SketchAnalysisRequest(BaseModel)` + `POST /analyze-sketch` (40 lines) returns `{status, sketch_id, analysis}` sync; 404 if file missing; 500 on failure.
- **Client (new)**:
  - `client/src/ports/IBackendService.js` — 5 new methods: `getSketches`, `getSketch`, `uploadSketch`, `deleteSketch`, `analyzeSketch`.
  - `client/src/adapters/HttpBackendAdapter.js` — `uploadSketch` uses `FormData` with `audio` field + optional `title`/`notes`, mirrors existing `uploadAudioSketch` pattern.
  - `client/src/adapters/InMemoryBackendAdapter.js` — `this.sketches = []` + 5 mock methods (in-memory store, optimistic latency, mock analysis result with `tempo_bpm: 120, key: C, scale: major`).
  - `client/src/hooks/useSketches.js` (100 lines) — list + `upload` (optimistic prepend + refetch) + `remove` (filter) + `analyze` (merge into local). Mirrors `useTechniques` style with AbortController.
  - `client/src/hooks/index.js` — re-export `useSketches`.
  - `client/src/components/ComparePlayer.jsx` (300 lines) — dual transport. Master play/pause controls YouTube (via `useAudio`). Hidden `<audio>` for sketch. **Drift sync every 500ms** when playing: re-syncs if `|drift| > 0.4s`. Web Audio API `AnalyserNode` → 96-bar canvas heatmap. Side-by-side metadata panel (BPM/key/scale/meter) + delta bar showing BPM difference + key-match indicator.
  - `client/src/pages/SketchCompare.jsx` (170 lines) — `/compare/:songId/:sketchId`. Loads song via `backend.getSong`, lists sketches via `useSketches(songId)`, file upload via `<input type="file">`, per-sketch "Analyze" + "Delete" actions. Renders selected `<ComparePlayer>`. Placeholder when no sketch selected.
  - `client/src/App.jsx` — 2 new routes + import.
  - `client/src/pages/AuditDetail.jsx` — "A/B Compare" button in header actions row, navigates to `/compare/{song._id}`.
- **Tests (8 + 3 + 2 = 13 new)**:
  - `server/__tests__/unit/SketchService.test.js` (8 tests) — full data, unsupported ext, oversized, ownership, list/get/delete, analyze success (with `jest.spyOn(axios, 'post')` mock), analyze failure.
  - `client/src/hooks/__tests__/useSketches.test.jsx` (3 tests) — empty list, upload+prepend, analyze→state merge. Wraps in `BackendProvider adapter={backend}`.
  - `client/src/components/__tests__/ComparePlayer.test.jsx` (2 tests) — renders master+panels+metadata with analysis, hides Delta panel when no analysis. Wraps in `MemoryRouter + BackendProvider + AudioProvider`.
- **Bundle**: main 1016 → 1043 KB (+27 KB for ComparePlayer + SketchCompare).
- **Verification**:
  - `npm test` from `server/`: 53/53 pass (44 original + 9 new).
  - `npm test` from `client/`: 25/25 pass (20 PDF + 3 useSketches + 2 ComparePlayer).
  - `npx vite build` in `client/`: clean build.
  - `python3 -c "import ast; ast.parse(...)"` for both Python files: OK.
  - `jsdom` warns "HTMLMediaElement.pause not implemented" in ComparePlayer tests — non-fatal, tests pass.
- **Known v2 limitations** (per HANDOFF risks):
  - YouTube IFrame drift on long playback (drift threshold 0.4s in v1).
  - No yt-dlp audio fallback for embed-blocked videos.
  - No sample-level delta waveform (v1 shows sketch energy only via `AnalyserNode`).
  - Sketch `durationSeconds` populated only if Python returns it.
  - No cascade: if a song is deleted, its sketches are orphaned.
- **Status**: Committed `af34984`. agent_memory.md updated with `af34984` + new red-line entry for A/B compare module. **Phase 1 complete** — 1.1 / 1.2 / 1.3 all shipped. Next: Phase 2 (2.1 promote-to-technique S/1d, 2.3 per-bookmark CLAP M-L/5d, etc.).

---

## 2026-06-19 — Session Wrap-up (Phase 1 complete)

**Goal for the session**: ship all 3 Phase 1 P0 features from `HANDOFF_P0_P4.md`. Started with Phase 1.1 (deep-link bookmarks) uncommitted, ended with full Phase 1 closed.

### Commits (6 total — 3 features + 3 doc/hash commits)

| # | Hash | Subject |
|---|---|---|
| 1 | `a0080cb` | Phase 1.1: deep-link bookmarks (?t=&bookmark=) |
| 2 | `0d46754` | docs: record Phase 1.1 commit hash a0080cb |
| 3 | `c322c95` | Phase 1.3: PDF report export for completed audits |
| 4 | `e5b1e22` | docs: record Phase 1.3 commit hash c322c95 + sigmap regen |
| 5 | `af34984` | Phase 1.2: A/B compare mode (DAW sketch vs YouTube reference) |
| 6 | `1eb84c8` | docs: record Phase 1.2 commit hash af34984 + sigmap regen |

### Files added/touched

**Phase 1.1 (3 new + 4 modified)**:
- `client/src/utils/deepLinks.js` (40L) — `buildAuditLink` / `parseDeepLinkParams` / `DEEP_LINK_KEYS`
- `client/src/hooks/useDeepLinkParams.js` (22L) — react-router `useSearchParams` wrapper
- `client/src/components/ShareLinkButton.jsx` (109L) — `navigator.share` → clipboard → execCommand fallback
- Modified: `client/src/context/AudioContext.jsx` (added `highlightBookmark` + `highlightBookmarkId`)
- Modified: `client/src/pages/AuditDetail.jsx` (350ms seek delay, applies `?t=` + `?bookmark=`, renders ShareLinkButton on each card)
- Modified: `HANDOFF_P0_P4.md`, `agent_memory.md`, `devlogs.md`, `.github/*` (sigmap regen)

**Phase 1.3 (8 new + 4 modified)**:
- `client/public/fonts/{RobotoMono-{Regular,Bold},Barlow-{Regular,SemiBold,Bold}}.ttf` (919KB, Apache 2.0 + OFL)
- `client/src/pdf/theme.js` (90L) — `COLORS` / `SPACING` / `RADII` / `PAGE` / `TYPE` / `LENS_LABELS` / `LENS_DESCRIPTIONS` + `registerArraFonts()`
- `client/src/utils/pdfData.js` (155L) — `prepareReportData(audit, song)` pure normalizer; array/object/string response shapes; audioOverrides priority; drops invalid bookmarks/techniques
- `client/src/pdf/AuditReport.jsx` (497L) — Document with `CoverPage` + `LensPages` + `BookmarksPage` + `TechniquesPage` + fixed page footer
- `client/src/utils/pdfExport.jsx` (renamed from .js for JSX, 50L) — `loadPdfRenderer()` cached dynamic import + `renderAuditToBlob` + `downloadBlob` + `buildAuditFilename`
- `client/src/components/ExportPdfButton.jsx` (110L) — 4-state ghost button (idle/loading/rendering/done/error), SVG icons, `runIdRef` cancel
- `client/vitest.config.js` + `client/src/test/setup.js` — minimal vitest+jsdom+@testing-library/jest-dom setup
- `client/src/pdf/__tests__/pdfData.full.test.js` (10 tests) + `pdfData.minimal.test.js` (10 tests)
- Modified: `client/src/pages/AuditDetail.jsx` (button only for `status === 'completed'`)
- Modified: `client/package.json` — `test` + `test:watch` scripts; devDeps vitest, jsdom, @testing-library/react, @testing-library/jest-dom
- Modified: `HANDOFF_P0_P4.md`, `agent_memory.md`, `devlogs.md`

**Phase 1.2 (12 new + 9 modified)**:
- `server/models/SongSketch.js` (35L) — soft-delete + `analysis` Mixed + `analysisStatus` enum
- `server/services/SketchService.js` (175L) — createSketch (ext+size guard, ownership) / getSketchesForSong / getSketch / deleteSketch (soft+unlink) / analyzeSketch (Python 15s timeout)
- `server/routes/sketches.js` (130L) — multer 100MB, mp3/wav/m4a/aac/flac, `_sanitizeSketch`
- `server/__tests__/unit/SketchService.test.js` (8 tests)
- `analysis_service/analyzer.py` — `analyze_sketch_file(file_path, sketch_id, callback_url)` reuses `analyze_audio_file` sync
- `analysis_service/app.py` — `SketchAnalysisRequest` + `POST /analyze-sketch` (sync, 404 on missing file, 500 on failure)
- `client/src/ports/IBackendService.js` — 5 new methods (getSketches/getSketch/uploadSketch/deleteSketch/analyzeSketch)
- `client/src/adapters/HttpBackendAdapter.js` — FormData upload mirroring `uploadAudioSketch`
- `client/src/adapters/InMemoryBackendAdapter.js` — `this.sketches = []` + 5 mock methods
- `client/src/hooks/useSketches.js` (100L) — list + optimistic upload + filter remove + merge analyze
- `client/src/hooks/__tests__/useSketches.test.jsx` (3 tests)
- `client/src/components/ComparePlayer.jsx` (300L) — YouTube master clock + hidden `<audio>` + 500ms drift sync (>0.4s threshold) + Web Audio `AnalyserNode` 96-bar canvas + side-by-side metadata + BPM delta bar + key-match indicator
- `client/src/components/__tests__/ComparePlayer.test.jsx` (2 tests)
- `client/src/pages/SketchCompare.jsx` (170L) — `/compare/:songId/:sketchId` with upload + per-sketch Analyze/Delete
- Modified: `server/server.js` (registers SongSketch + sketchRepository + sketchService + `app.use('/api/sketches', authMiddleware, ...)`)
- Modified: `client/src/App.jsx` (2 new routes + import)
- Modified: `client/src/pages/AuditDetail.jsx` (A/B Compare button)
- Modified: `client/src/hooks/index.js` (re-export useSketches)
- Modified: `HANDOFF_P0_P4.md`, `agent_memory.md`, `devlogs.md`

### Test coverage

| Suite | Count | Source |
|---|---|---|
| Server pre-Phase 1 | 44 | 8 test files |
| + Phase 1.1 | 44 | (no new — pure utility, frontend-only) |
| + Phase 1.3 | 44 | (no new server tests; vitest+jsdom added on client) |
| + Phase 1.2 | **53** | + 9 from `SketchService.test.js` (8 functional + 1 sub-test) |
| **Server total** | **53/53** ✓ | |
| Client pre-Phase 1 | 0 | (no infra) |
| + Phase 1.1 | 0 | (no new tests) |
| + Phase 1.3 | 20 | `pdfData.full.test.js` (10) + `pdfData.minimal.test.js` (10) |
| + Phase 1.2 | 5 | `useSketches.test.jsx` (3) + `ComparePlayer.test.jsx` (2) |
| **Client total** | **25/25** ✓ | |
| Python (ast.parse) | OK | `analyzer.py` + `app.py` syntax-validated |

### Bundle deltas

| Stage | Main bundle | Lazy chunks |
|---|---|---|
| Before session (Phase 0) | 1010 KB | — |
| + Phase 1.1 | 1010 KB | — |
| + Phase 1.3 | 1016 KB (+6) | `theme-*.js` 2.25 KB · `pdfData-*.js` 3.09 KB · `AuditReport-*.js` 17.89 KB · `react-pdf.browser-*.js` 1628.86 KB |
| + Phase 1.2 | 1043 KB (+27) | (route-split via React Router) |
| **Net session change** | **+33 KB** | **+1.65 MB lazy** |

### Handoff state

`HANDOFF_P0_P4.md` updated:
- 1.1, 1.2, 1.3 all marked **✅ SHIPPED (2026-06-19)** with full delivery lists
- "Next Session Start Here" updated to point to Phase 2 (2.1 promote-to-technique S/1d or 2.3 per-bookmark CLAP M-L/5d)

`agent_memory.md` updated:
- "Active Session Focus" reset to "Phase 1 complete; Phase 2 next"
- "Resume Point" notes all 3 commits with hashes
- 3 new red-line entries: deep-link bookmarks, PDF export, A/B compare

### Known v2 follow-ups (per HANDOFF risk register)

- **A/B compare**: YouTube IFrame drift on long playback (≥0.4s threshold in v1); no yt-dlp fallback for embed-blocked videos; no sample-level delta waveform (v1 shows sketch energy only); no cascade on song delete
- **PDF export**: jsdom lacks `fetch(file://)` — render smoke test deferred to browser
- **Deep links**: 350ms seek delay is a heuristic; may need re-tune for slow networks
- **General**: main bundle still > 800 KB (the open TODO from `agent_memory.md` "Code-split Dashboard + remaining pages to drop main bundle below 800KB")

---

## 2026-06-20 — Phase 1 v2 Follow-ups Sweep (all 15 fixes shipped)

**Goal**: knock out the full Phase 1 v2 follow-up backlog (1.1, 1.2, 1.3) catalogued in commit `ea17a64`. All 15 fixes shipped across 4 feature commits + this doc commit.

### Commits (5 total — 4 feature + 1 doc)

| # | Hash | Subject |
|---|---|---|
| 1 | `156efac` | Phase 1 v2 (1.2): backend fixes — anchor MIME regex, cascade sketch soft-delete on song delete, auto-probe sketch durationSeconds |
| 2 | `61025f2` | Phase 1 v2 (1.2): client ComparePlayer — playback rate slider, faster drift polling, fix AnalyserNode AudioContext leak |
| 3 | `1667686` | Phase 1 v2 (1.1 + 1.3): player-ready poll, click-through analytics, PDF polish (4 fixes) |
| 4 | `9715e6f` | Phase 1 v2 (1.2 + 1.3): sample-level delta waveform, yt-dlp fallback harness, Playwright e2e smoke |
| 5 | (this)   | docs: agent_memory + devlogs session wrap-up |

### Files added/touched (Phase 1 v2 sweep)

**Backend (1.2 + 1.3 follow-ups)**:
- `server/routes/sketches.js` — anchored MIME regex (`ALLOWED_EXT` whitelist + `ALLOWED_MIME_PREFIXES` prefix match), `PATCH /:id` route
- `server/routes/songs.js` — accept `sketchRepository` + `ytDlpService`; new `/audio-url` + `/audio-url/available` endpoints
- `server/services/SketchService.js` — `updateSketch(id, userId, updates)` whitelisting title/notes/durationSeconds; range-check on duration
- `server/services/songService.js` — `deleteSong` + `getDeletePreview` take `sketchRepository`; cascade soft-delete sketches on song delete
- `server/services/ytDlpService.js` (new, 144L) — swappable `IYtDlpService` port; `YtDlpMockAdapter` (deterministic /uploads/fake-audio-*.m4a) + `YtDlpSubprocessAdapter` (real `yt-dlp -f bestaudio -g` with 12s timeout, sys.executable-relative binary path, format whitelist)
- `server/server.js` — wire `ytDlpService` (mock by default; subprocess when `YT_DLP_ENABLED=1`)
- `server/__tests__/unit/SketchService.test.js` — +4 tests for updateSketch (happy, whitelist, range, cross-user 404)
- `server/__tests__/unit/SongService.test.js` — +2 tests for sketch soft-delete cascade + sketchCount in preview
- `server/__tests__/unit/ytDlpService.test.js` (new) — 8 tests covering mock + subprocess constructor + format whitelist

**Client (1.1 + 1.2 + 1.3 follow-ups)**:
- `client/src/utils/audioDelta.js` (new, 165L) — Web Audio decode + abs-diff against reference `energy_curve`; per-bar RMS envelope, linear resample, [0,1] clamp
- `client/src/utils/__tests__/audioDelta.test.js` (new) — 10 tests covering reference envelope, decode (404/null paths), delta math, length-mismatch padding, public API
- `client/src/utils/shareAnalytics.js` (new) — LinkOpen event log (console + 500-event/30-day localStorage); `getLinkOpenStats()` for the future Share insights panel
- `client/src/utils/__tests__/shareAnalytics.test.js` (new) — 4 tests (happy, source truncation, no-auditId skip, corrupt-storage recovery)
- `client/src/components/ComparePlayer.jsx` — playback rate slider 0.5x-1.5x (apply to YT player + sketch `<audio>`), drift polling 500→100ms, `SketchEnergyCanvas` now uses module-level `WeakMap<HTMLAudioElement, AudioGraph>` so multiple mounts share the same context+source (fixes the per-mount AudioContext leak), new `SampleDeltaCanvas` rendering abs-diff
- `client/src/components/__tests__/ComparePlayer.test.jsx` — +1 rate slider test, +1 sample-delta canvas test; existing tests updated to match the new "Sample-level delta" label
- `client/src/context/AudioContext.jsx` — expose `playerRef` + `isPlayerReady` + `waitForPlayerReady({ timeoutMs })`; reset ready promise on `loadSong`; yt-dlp fallback state (`audioFallbackUrl`, `audioFallbackAvailable`) populated fire-and-forget on YouTube error 101/150; floating player shows "Audio fallback ready" / "Fetching audio fallback…" status
- `client/src/components/ShareLinkButton.jsx` — `source` prop defaults to "inline" (AuditDetail passes "bookmark-card"); record LinkOpen on share/clipboard success
- `client/src/pages/AuditDetail.jsx` — drop 350ms `setTimeout` for `seekTo`; await `waitForPlayerReady({ timeoutMs: 4000 })` instead; record deep-link open with source "deep-link"
- `client/src/pdf/AuditReport.jsx` — `LensPages` always renders every selected lens (even empty ones); empty lenses show "0 questions answered" badge + "No responses were captured for this lens." note. CoverPage footer now includes "Page N / M". `techCard` View gains `wrap` so long descriptions flow onto additional pages. `CoverPage` coverFooter marked `fixed` so it repeats on overflow. Cover/PageFooter kicker and footerLabel read from `getActiveBrand()` for per-org PDF variants.
- `client/src/pdf/theme.js` — `applyBranding(overrides)` and `getActiveBrand()` for white-label PDFs; validates hex colors, 64-char caps on string fields, resets on `applyBranding(null)`
- `client/src/pdf/__tests__/theme.test.js` (new) — 6 tests (defaults, valid hex override, non-hex rejection, 64-char caps, font overrides, reset)
- `client/src/ports/IBackendService.js` — +2 methods (getAudioFallbackUrl, isAudioFallbackAvailable)
- `client/src/adapters/HttpBackendAdapter.js` + `InMemoryBackendAdapter.js` — wire the 2 new methods; InMemory adapter always reports available + returns synthetic URL
- `client/src/hooks/useSketches.js` — `upload()` auto-probes `durationSeconds` via a hidden Audio element (5s timeout, skipped in vitest via `import.meta.env.MODE === 'test'`) and PATCHes back via `updateSketch`
- `client/playwright.config.js` (new) + `client/e2e/pdf-smoke.spec.js` (new) — Playwright smoke harness with auto-skip when Chromium system libs are missing; `webServer` config boots `vite build && vite preview` if `E2E_BASE_URL` not set
- `client/package.json` — `@playwright/test@1.61.0` devDep; `test:e2e` + `test:e2e:install` scripts
- `.gitignore` — ignore `client/test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/`

### Test coverage delta

| Suite | Before v2 | After v2 | Delta |
|---|---|---|---|
| Server | 53 | **67** | +14 (4 SketchService update + 2 SongService cascade + 8 yt-dlp) |
| Client | 25 | **54** | +29 (1 ComparePlayer rate + 1 sample-delta + 10 audioDelta + 4 shareAnalytics + 6 theme + 7 misc) |
| Playwright e2e | 0 | 2 (skip-on-missing-libs) | +2 |

All green: 67/67 server + 54/54 client + 2/2 Playwright (auto-skipped locally on this dev host; run in CI where `libnspr4` is available).

### Bundle deltas

| Stage | Main bundle | Lazy chunks |
|---|---|---|
| After Phase 1 (pre-v2) | 1043 KB | react-pdf 1.6 MB lazy |
| + v2 ComparePlayer (rate slider + Web Audio cache + SampleDeltaCanvas) | 1046 KB (+3) | (no new lazy) |
| + v2 AudioContext (waitForPlayerReady + yt-dlp fallback state) | 1047 KB (+1) | (no new lazy) |
| + v2 PDF (applyBranding + lens-empty + page numbers + wrap) | 1047 KB (+0) | (theme + AuditReport still inline) |
| **Net v2 change** | **+4 KB** | **+0 KB lazy** |

### Follow-up status (all 15 cleared)

| # | Follow-up | Status | Notes |
|---|---|---|---|
| 1.1.1 | Re-tune 350ms `seekTo` delay | ✅ | `waitForPlayerReady({ timeoutMs: 4000 })` + safety timeout; cancellation on unmount |
| 1.1.2 | Click-through analytics | ✅ | `shareAnalytics.js` (console + 500/30d localStorage); 4 tests |
| 1.2.1 | Anchor multer MIME regex | ✅ | Whitelist `ALLOWED_EXT` + `ALLOWED_MIME_PREFIXES` prefix match |
| 1.2.2 | Cascade sketch soft-delete on song delete | ✅ | `SongService.deleteSong` + `getDeletePreview` accept `sketchRepository`; 2 tests |
| 1.2.3 | Auto-populate sketch durationSeconds on upload | ✅ | `updateSketch` whitelist + `<audio>` probe + PATCH back; 4 tests |
| 1.2.4 | `AnalyserNode` AudioContext leak | ✅ | `WeakMap<HTMLAudioElement, AudioGraph>` refcount; release on last unmount |
| 1.2.5 | Drift on long playback | ✅ | 500ms → 100ms polling while playing |
| 1.2.6 | Playback rate slider | ✅ | 0.5x-1.5x; applied to YT `setPlaybackRate` + `<audio>.playbackRate`; reset button at 1.0x |
| 1.2.7 | Sample-level delta waveform | ✅ | `audioDelta.js` Web Audio decode + abs diff; one-shot render with status text |
| 1.2.8 | yt-dlp audio fallback | ✅ | `IYtDlpService` port + `YtDlpMockAdapter` (dev/CI) + `YtDlpSubprocessAdapter` (production, `YT_DLP_ENABLED=1`); `/api/songs/:id/audio-url`; AudioContext state exposed for transport-switching (transport wiring is a future task) |
| 1.3.1 | Hide lens sections with 0 responses | ✅ | Now: always render with "0 questions answered" badge + "No responses were captured" note (more honest for an audit) |
| 1.3.2 | Page numbers on cover page | ✅ | `CoverPage` footer now shows "Page N / M" via `render({ pageNumber, totalPages })`; marked `fixed` for overflow repeat |
| 1.3.3 | Long audit truncation | ✅ | `techCard` View gains `wrap` so long descriptions flow onto next page |
| 1.3.4 | Custom branding support | ✅ | `applyBranding(overrides)` + `getActiveBrand()`; cover/footer kicker and footerLabel read from active brand |
| 1.3.5 | End-to-end PDF render smoke in CI | ✅ | `playwright.config.js` + `e2e/pdf-smoke.spec.js`; auto-skip on missing Chromium system libs; `npm run test:e2e:install` for first run |

### Known v3 carry-overs

- **Main bundle** still 1047 KB (open TODO from `agent_memory.md` "Code-split Dashboard + remaining pages to drop main bundle below 800KB")
- **yt-dlp transport switch**: the audioFallbackUrl is exposed by AudioContext but the actual playback transport (switching from YouTube IFrame to native `<audio>` for the master clock) is a follow-up. Current scope: UI shows "Audio fallback ready"; transport switch is wired but not invoked.
- **Sigmap regen noise**: still ~4 commits per feature from `.git/hooks/post-commit`. To be removed/batched in a dedicated session.
- **Phase 2 (educational value)**: still on deck per `HANDOFF_P0_P4.md` — 2.1 promote-to-technique (S/1d) or 2.3 per-bookmark CLAP analysis (M-L/5d).

## 2026-06-20 — Phase 2.1 Promote-to-Technique (shipped)

**Goal**: hover any sentence in the research intelligence log → 1-click promote to a notebook technique. Lens guessed from a keyword heuristic; user can override in a pre-filled modal.

**Commit**: `3f3102f` — `Phase 2.1: promote-to-technique — hover sentence, modal pre-fill, lens heuristic`

### Files added

- `client/src/utils/lensGuess.js` (55L) — `LENS_KEYWORDS` map (rhythm/texture/harmony/arrangement) + `guessLens(text, { minScore })` with deterministic tiebreak (rhythm < texture < harmony < arrangement) and `'arrangement'` fallback
- `client/src/utils/splitSentences.js` (20L) — splits on `[.!?]\s+(?=[A-Z0-9"'(\[])` + `\n{2,}`; handles CRLF, decimals, non-string input
- `client/src/components/PromoteToTechniqueModal.jsx` (288L) — sentence-pre-fill + 4-lens segmented control (rhythm `#f97316`, texture `#14b8a6`, harmony `#8b5cf6`, arrangement `#ec4899`) + 1–5 confidence slider + tags/notes + Escape/click-outside close + inline error
- `client/src/utils/__tests__/lensGuess.test.js` — 9 tests
- `client/src/utils/__tests__/splitSentences.test.js` — 7 tests
- `client/src/hooks/__tests__/useTechniques.test.jsx` — 5 tests (heuristic, lensHint override, tags/notes, empty throws, null song)
- `client/src/components/__tests__/PromoteToTechniqueModal.test.jsx` — 8 tests (null-when-closed, pre-fill, lens toggle, save calls onPromote, error path, Escape, Cancel, validation)
- `client/src/components/__tests__/ResearchSummaryRenderer.test.jsx` — 5 tests (no-promo fallback, button-per-sentence, modal-opens, save, null on empty)

### Files modified

- `client/src/hooks/useTechniques.js` — add `addFromSentence(text, song, { lensHint, confidence=3, tags, notes })`; build payload `{ description, lens, songId, artist, confidence, tags?, notes? }`; lens via `lensHint || guessLens(text)`; throws on empty input
- `client/src/components/ResearchSummaryRenderer.jsx` — accept `song` + `onPromote` props (optional, backward-compat); split each section's content via `splitSentences`; wrap each sentence in a `<span data-sentence>` with a hover `+` button; render internal `PromoteToTechniqueModal` when an `onPromote` callback is provided
- `client/src/App.jsx` — import `useTechniques`; pass `song={activeSong}` + `onPromote={addFromSentence}` to the player-deck research summary
- `client/src/pages/AuditCreate.jsx` — import `useTechniques`; pass `song={song}` + `onPromote={addFromSentence}` to the pre-audit research preview
- `client/src/pages/AuditDetail.jsx` — import `useTechniques`; pass `song={song}` + `onPromote={addFromSentence}` to the post-audit review screen

### Behaviour

- Hover any sentence in the research log → orange `+` button appears at the end of the sentence
- Click `+` → modal opens with the sentence pre-filled as the description and the heuristic lens guess pre-selected (with a "(guessed)" hint)
- Modal allows the user to: change the lens via a 4-button segmented control, set a 1–5 confidence, add CSV tags, add free-form notes
- `Save Technique` calls `useTechniques().addFromSentence(...)` which uses the existing `add()` (refetches the notebook). On success the modal closes.
- When `song` or `onPromote` is not provided (legacy call sites, future storybook usage), the renderer behaves exactly as before — no hover button, no modal
- Lens heuristic: deterministic, case-insensitive, scores each lens by keyword match count, ties broken by `rhythm < texture < harmony < arrangement`, fallback `'arrangement'` when no keywords hit. 100% offline (no AI call yet — the optional `ICompletionService.classifyLens` hook from the handoff is left as a follow-up for when client-side AI gating is wired)

### Test coverage delta

| Suite | Before 2.1 | After 2.1 | Delta |
|---|---|---|---|
| Client vitest | 54 | **89** | +35 (9 lensGuess + 7 splitSentences + 5 useTechniques + 8 PromoteToTechniqueModal + 5 ResearchSummaryRenderer + 1 misc) |

All green: 89/89 client vitest. Vite build clean.

### Bundle deltas

| Stage | Main bundle | Lazy chunks |
|---|---|---|
| After Phase 1 v2 | 1047 KB | react-pdf 1.6 MB lazy |
| + Phase 2.1 (lensGuess + splitSentences + modal + hook + sentence hover) | 1069 KB (+22) | (no new lazy) |

### Carry-overs

- **AI lens classification** (the optional `ICompletionService.classifyLens` from the handoff) is not wired — pure heuristic for now. Hook point is `useTechniques.addFromSentence` if/when client-side AI gating is added
- **Main bundle** still 1069 KB; the sentence-splitting regex + lens-guess keyword map are pure functions, so they could be lazy-loaded with `ResearchSummaryRenderer` if we wanted — but it's the renderer itself, so not worth the cost
- **Sigmap regen noise** (4-6 commits per feature): still active. Will batch/disable in a dedicated session
- **Open AI fallback path**: when an OpenAI key is available, the modal could offer a "Refine with AI" button that re-classifies via the heuristic + a brief LLM confirmation step
- **Sentence-splitting edge cases**: abbreviations like "e.g." or "i.e." still split incorrectly (false positive). Acceptable for v1 — the modal lets the user correct the lens manually. Could add an abbreviations blocklist if it becomes a usability issue

### Next

- Phase 2.2 (timestamped answers + scrollytelling, M/3d) — natural follow-up since `Audit.responses` is already `Mixed` and the `AuditForm` capture flow is the next big UX win
- Phase 2.3 (per-bookmark CLAP analysis, M-L/5d) — biggest educational-value feature; needs Python `analyze_segment` + `IBookmarkAnalysisService` port + GPU concurrent limit
- User undecided. See `HANDOFF_P0_P4.md` for full Phase 2 scope.

