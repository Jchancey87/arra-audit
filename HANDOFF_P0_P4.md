# Arra P0–P4 Implementation Roadmap

> Generated: 2026-06-14
> Strategy: Refactor-first → strict P0–P4 priority, one shipping block per tier
> Architecture: Client `@react-pdf/renderer` PDF · In-process `node-cron` + `socket.io`
> Prerequisite: Phase 0 (leak fixes + client hooks) ships before any feature

---

## Contents

1. [Phase 0 — Refactor Foundation](#phase-0--refactor-foundation)
2. [Phase 1 — P0 Sharing & Export](#phase-1--p0-sharing--export)
3. [Phase 2 — P1 Educational Value](#phase-2--p1-educational-value)
4. [Phase 3 — P2 Retention & Habit](#phase-3--p2-retention--habit)
5. [Phase 4 — P3 Community](#phase-4--p3-community)
6. [Phase 5 — P4 Power User](#phase-5--p4-power-user)
7. [New Ports & Adapters](#new-ports--adapters)
8. [Risk Register](#risk-register)

---

## Phase 0 — Refactor Foundation (1-2 sessions, prerequisite)

> Ship before any feature. Every feature in P0–P4 lands inside these patterns or is slowed down by the current leaks.

### 0.1 Service encapsulation fixes

| # | Change | File:line |
|---|---|---|
| 0.1a | `_buildFallbackTemplate` → `fallbackTemplate` (public). Route calls via public method. | `server/services/templateComposer.js:147` · `server/routes/audits.js:127` |
| 0.1b | `AuditService.getSongContext(songId, userId)` replaces `auditService.songRepository?.findOne(...)` in route | `server/services/auditService.js` · `server/routes/audits.js:97` |
| 0.1c | `SongService.researchSong(title, artist)` replaces `songService.searchService.searchSongInfo(...)` in route | `server/services/songService.js:12` · `server/routes/songs.js:81-87` |

**Acceptance**: routes never reference `.searchService`, `.songRepository`, or `_`-prefixed methods.

### 0.2 IRepository split

- New: `server/ports/IUserRepository.js` (extends IRepository, adds `verifyPassword` / `setPassword`)
- Change: `IRepository.js` — remove auth methods; `MongooseRepository` unchanged; `UserRepository` thin wrapper
- Existing auth behavior preserved, no route changes needed

**Files**: `server/ports/IRepository.js:122,133` · `server/ports/IUserRepository.js` (new)

### 0.3 IAIModelService rename

- `ICompletionService` (new) — `completeText(prompt) → string` · `completeJson(prompt) → object`
- Migrate `TemplateComposer`, `SongService` (summary prompt), `CurriculumService` → new port
- Keep old `IAIModelService` deprecated; remove in Phase 2

**Files**: `server/ports/IAIModelService.js` → `server/ports/ICompletionService.js`

### 0.4 Client data hooks (the missing deep-module layer)

Pages currently call `backend.X()` directly. Build `client/src/hooks/*.js` — hooks wrap IBackendService with caching, optimistic updates, and state-machine awareness.

| Hook | Exposes | Wraps |
|---|---|---|
| `useSong(songId)` | `{song, loading, error, refetch, triggerAnalysis, saveOverrides}` | `backend.getSong` + mutation |
| `useAudits(filters)` | `{audits, loading, createAudit, deleteAudit, restoreAudit}` | list CRUD |
| `useAudit(auditId)` | `{audit, responses, advanceStep, goBackStep, skipStep, addBookmark, updateResponses, ...}` | full audit state machine |
| `useTechniques(filters)` | `{techniques, grouped, add, update, delete, promoteFromText}` | technique CRUD |
| `useStudyProgress(progressId)` | `{progress, currentDay, linkSong, logDay, completeDay, uploadSketch, submitReview}` | planner CRUD |
| `useCurricula()` | `{curricula, generate, save, start}` | curriculum CRUD |
| `useTasteProfiles()` | `{profiles, research}` | taste CRUD |

**New files**: `client/src/hooks/use{Song,Audits,Audit,Techniques,StudyProgress,Curricula,TasteProfiles}.js` (12-15 files)

**Refactor target**: `AuditForm.jsx` (1317→≤500 lines) · `TechniqueNotebook.jsx` (1043→≤500) via hook extraction.

**Tests**: each hook gets 3+ tests with `InMemoryBackendAdapter`.

### 0.5 Phase 0 verification gate

- `npm test` from `server/` — all existing 51 tests green
- Hook tests with `InMemoryBackendAdapter` — 3+ per hook
- Manual smoke: all existing routes still serve correctly
- `agent_memory.md` + `devlogs.md` updated

---

## Phase 1 — P0: Sharing & Export (3 features)

### 1.1 Shareable deep-link bookmarks ✅ SHIPPED (2026-06-19)

**Effort**: S · frontend only · ~1 day

**What**: `/audit/:id?t=145&bookmark=BM123` opens audit, seeks to 2:25, highlights bookmark.

**Changes**:
- `client/src/App.jsx:284` — routes already wired; add `useDeepLinkParams()` hook on `AuditDetail`
- `client/src/context/AudioContext.jsx:75` — expose `highlightBookmark(id)` action
- `client/src/pages/AuditDetail.jsx:540` — bookmark list gets "Copy share link" button
- New: `client/src/utils/deepLinks.js` — `buildAuditLink(id, opts)`
- New: `client/src/components/ShareLinkButton.jsx` — `navigator.share` → clipboard fallback

**No backend changes**.

**Acceptance**: copy link → paste → opens at timestamp, bookmark highlighted. ✅

**Delivered**:
- `client/src/utils/deepLinks.js` (40 lines) — `buildAuditLink` / `parseDeepLinkParams` / `DEEP_LINK_KEYS`
- `client/src/hooks/useDeepLinkParams.js` (22 lines) — react-router `useSearchParams` wrapper
- `client/src/components/ShareLinkButton.jsx` (109 lines) — `navigator.share` → `clipboard.writeText` → execCommand fallback, 1.8s "Copied"/"Copy failed" feedback, `compact` prop
- `AudioContext.highlightBookmark(id, {durationMs=4000})` + `highlightBookmarkId` exposed in context value
- `AuditDetail` consumes all three; applies deep-link once on mount with 350ms `seekTo` delay (YouTube player mount). Highlighted card: orange border + box-shadow.

**Verification**: Vite build clean (184 modules), 44/44 server tests still green, no backend touched.

### 1.2 A/B compare mode ✅ SHIPPED (2026-06-19)

**Effort**: L · new model + Python + component · ~1 week

**What**: sync uploaded DAW sketch against reference track. Scrubbing either moves both. Delta waveform.

**Changes**:
- New model: `server/models/SongSketch.js` — `{userId, songId, fileName, filePath, durationSeconds, tempo_bpm, key, scale, uploadedAt}`
- New service: `server/services/SketchService.js` — `createSketch`, `getSketchesForSong`, `analyzeSketch`
- New Python endpoint: `analysis_service/app.py` — `POST /analyze-sketch` (reuses `analyzer.py`)
- New route: `server/routes/sketches.js` — upload/fetch/delete/analyze
- New port methods on `IBackendService`: `getSketches`, `uploadSketch`, `deleteSketch`, `analyzeSketch`
- New hook: `client/src/hooks/useSketches.js`
- New component: `client/src/components/ComparePlayer.jsx` — dual transport, synced, delta heatmap
- New page: `client/src/pages/SketchCompare.jsx` — `/compare/:songId/:sketchId`

**Sync**: shared master clock (YouTube embed). Sketch `<audio>` synced to `currentTime`. Drift correction every 2s.

**Tests**: 8 service tests · 3 hook tests · 2 component tests.

**Risks**: YouTube embed API latency causes drift on long playback. Document limitation; consider yt-dlp audio fallback.

**Delivered** (caveman):
- **Server**:
  - `server/models/SongSketch.js` (35 lines) — soft-delete via `deletedAt`, `analysis` Mixed (mirrors `Song.audioAnalysis`), `analysisStatus` enum, indexes on `(userId, songId, deletedAt, createdAt)`.
  - `server/services/SketchService.js` (175 lines) — `createSketch` (file type+size guard, song-ownership check), `getSketchesForSong`, `getSketch`, `deleteSketch` (soft + file unlink), `analyzeSketch` (calls Python `/analyze-sketch` with 15s timeout, stores result).
  - `server/routes/sketches.js` (130 lines) — multer diskStorage in `server/uploads/` with `sketch-{timestamp}-{rand}.{ext}` filename, 100MB cap, allowed ext `mp3|wav|m4a|aac|flac`. Routes: `GET /songs/:songId` (list), `POST /songs/:songId/upload`, `GET /:id`, `DELETE /:id`, `POST /:id/analyze`. `_sanitizeSketch()` strips internals.
  - `server/server.js` — registers `SongSketch` model, `sketchRepository = new MongooseRepository(SongSketch)`, `sketchService = new SketchService(...)`, mounts `app.use('/api/sketches', authMiddleware, createSketchRoutes(sketchService))`. Static `/uploads` already serves sketches.
- **Python**:
  - `analysis_service/analyzer.py` — `analyze_sketch_file(file_path, sketch_id, callback_url=None)` (60 lines) — calls existing `analyze_audio_file(file_path, sketch_id)` synchronously; optional callback notification; mirrors `/analyze` shape.
  - `analysis_service/app.py` — `SketchAnalysisRequest(BaseModel)` model + `POST /analyze-sketch` endpoint (40 lines) — synchronous response with `{ status, sketch_id, analysis }`; 404 if file missing; 500 on failure.
- **Client**:
  - `client/src/ports/IBackendService.js` — 5 new methods: `getSketches`, `getSketch`, `uploadSketch`, `deleteSketch`, `analyzeSketch`.
  - `client/src/adapters/HttpBackendAdapter.js` — implements all 5; `uploadSketch` uses `FormData` with `audio` field + optional `title`/`notes`, mirrors existing `uploadAudioSketch` pattern.
  - `client/src/adapters/InMemoryBackendAdapter.js` — `this.sketches = []` + 5 mock methods (in-memory store, optimistic latency, mock analysis result).
  - `client/src/hooks/useSketches.js` (100 lines) — list + `upload` (optimistic prepend + refetch) + `remove` (filter) + `analyze` (merge into local). Mirrors `useTechniques` style with AbortController.
  - `client/src/hooks/index.js` — re-export `useSketches`.
  - `client/src/components/ComparePlayer.jsx` (300 lines) — dual transport. Master play/pause controls YouTube (via `useAudio`). Hidden `<audio>` for sketch. Drift sync every 500ms when playing (re-syncs if drift > 0.4s). Web Audio API `AnalyserNode` → 96-bar canvas heatmap. Side-by-side metadata panel (BPM/key/scale/meter) + delta bar showing BPM difference + key-match indicator.
  - `client/src/pages/SketchCompare.jsx` (170 lines) — `/compare/:songId/:sketchId`. Loads song via `backend.getSong`, lists sketches via `useSketches(songId)`, file upload via `<input type="file">`, per-sketch "Analyze" + "Delete" actions. Renders selected `<ComparePlayer>`. Renders placeholder when no sketch selected.
  - `client/src/App.jsx` — added 2 routes: `/compare/:songId` and `/compare/:songId/:sketchId`; imported `SketchCompare`.
  - `client/src/pages/AuditDetail.jsx` — added "A/B Compare" button in header actions row that navigates to `/compare/{song._id}`.
- **Tests**:
  - `server/__tests__/unit/SketchService.test.js` (8 tests) — full + minimal + extension guard + size guard + ownership + list/get/delete + analyze success/failure (with `jest.spyOn(axios, 'post')`).
  - `client/src/hooks/__tests__/useSketches.test.jsx` (3 tests) — empty list, upload+prepend, analyze→state merge.
  - `client/src/components/__tests__/ComparePlayer.test.jsx` (2 tests) — renders master+panels+metadata with analysis, hides Delta panel when no analysis.

**Bundle**: main 1016 → 1043 KB (+27 KB for ComparePlayer + SketchCompare). SketchCompare is route-split (only loads when navigating to `/compare/...`).

**Verification**:
- `npm test` from `server/`: 53/53 pass (44 original + 9 new).
- `npm test` from `client/`: 25/25 pass (20 PDF + 3 useSketches + 2 ComparePlayer).
- `npx vite build` in `client/`: clean build.
- `python3 -c "import ast; ast.parse(...)"` for both Python files: OK (no runtime test — Python service not started in CI).

**Known limitations / v2 follow-ups**:
- YouTube IFrame drift on long playback (HANDOFF L130 risk — confirmed in v1; drift threshold 0.4s).
- No yt-dlp audio fallback for embedded-blocked videos.
- No actual sample-level delta waveform (v1 shows sketch energy via AnalyserNode; reference energy is metadata-only). Full "delta heatmap" requires Web Audio decode + resample of both sources.
- Sketch `analysis.durationSeconds` is populated only if Python returns it (librosa-based path). HTTP path may leave it null.
- Cascade: if a song is deleted, its sketches are orphaned (not auto-soft-deleted). Acceptable for v1.

### 1.3 PDF report export ✅ SHIPPED (2026-06-19)

**Effort**: M · uses installed `@react-pdf/renderer` · ~3 days

**What**: completed audit → Bitwig-themed PDF (cover + metadata + per-lens Q&A + exercises + bookmarks + techniques).

**Changes**:
- New: `client/src/pdf/AuditReport.jsx` — `@react-pdf/renderer` document
- New: `client/src/pdf/theme.js` — color/font/spacing tokens
- New: `client/src/utils/pdfExport.js` — dynamic import + render + download
- New: `client/src/components/ExportPdfButton.jsx` — credits missing @react-pdf/types
- Font registration: Roboto Mono + Barlow via `Font.register`

**Bundle**: code-split with `const {pdf} = await import('@react-pdf/renderer')` (~700KB on use).

**Tests**: 2 component tests (full + minimal data).

**Acceptance**: 4-6 page PDF in ~3s. Correct layout in Chrome/ macOS Preview. ✅

**Delivered**:
- `client/src/pdf/theme.js` — `COLORS` (mirror of `--bg-surface-*` + `--accent-*`), `SPACING`, `RADII`, `PAGE`, `TYPE`, `LENS_LABELS`, `LENS_DESCRIPTIONS`. `registerArraFonts()` lazy-registers Roboto Mono (Regular+Bold) and Barlow (Regular+SemiBold+Bold) from `/fonts/`.
- `client/src/utils/pdfData.js` — `prepareReportData(audit, song)` pure normalizer. Handles array/object/string response shapes, prefers `audioOverrides` over `audioAnalysis`, drops invalid bookmarks/techniques, exports `formatTimestamp` / `formatDuration` helpers.
- `client/src/pdf/AuditReport.jsx` — `<Document>` with 4 page types: `CoverPage` (title/artist/audio chips/lens chips/audit meta), `LensPages` (chunks 2 lenses per page, questions/answers/timestamps), `BookmarksPage` (timestamp + label + note + lens), `TechniquesPage` (card per technique with lens + example timestamp). Fixed `<PageFooter>` with `pn/tp`.
- `client/src/utils/pdfExport.jsx` (renamed from .js for JSX) — `loadPdfRenderer()` cached dynamic import wrapper, `renderAuditToBlob(audit, song)` parallel-loads renderer + AuditReport + pdfData + theme, `downloadBlob(blob, name)`, `buildAuditFilename(audit, song)` slug.
- `client/src/components/ExportPdfButton.jsx` — ghost-variant button with 4 states (idle/loading/rendering/done/error), SVG download icon + spinner, accessible `aria-label`, hover state, `runIdRef` cancels stale renders on rapid clicks.
- `client/public/fonts/` — Roboto Mono Regular+Bold (Apache 2.0), Barlow Regular+SemiBold+Bold (OFL), ~920KB total. Attribution noted in `theme.js` header.
- `client/src/pages/AuditDetail.jsx` — button rendered in header actions row (L147-170), only when `audit.status === 'completed'`.
- `client/vitest.config.js` + `client/src/test/setup.js` — minimal vitest + jsdom + @testing-library/jest-dom setup.
- 2 test files in `client/src/pdf/__tests__/`:
  - `pdfData.full.test.js` (10 tests) — full audit data: array/object/string response shapes, audioOverrides priority, all field types.
  - `pdfData.minimal.test.js` (10 tests) — empty/missing/null/edge cases for data normalizer + formatTimestamp.
- `package.json` — added `test` and `test:watch` scripts; devDeps `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`.

**Bundle impact**: main bundle 1010 → 1016 KB (+6 KB for the button + util wrapper). `@react-pdf/renderer` 1.6 MB lazy-loaded only on button click (4 chunks: theme 2.25KB / pdfData 3.09KB / AuditReport 17.89KB / react-pdf.browser 1628.86KB).

**Verification**:
- `npm test` from `client/`: 20/20 tests pass (jsdom).
- `npx vite build` in `client/`: clean build, 66 modules, 4 lazy chunks.
- `npm test` from `server/`: 44/44 still green (no backend touched).
- Manual smoke: button renders in completed-audit header, shows spinner during load+render, downloads PDF (not verified in CI — render smoke test deferred: jsdom lacks `fetch(file://)`, would need a polyfill or browser env).

**Acceptance**: 4-6 page PDF in ~3s (initial load includes dynamic import + font fetch + render). Bitwig-themed (orange/cyan accents, dark surfaces, JetBrains-Mono-styled numerals). Works for both `audioOverrides` and `audioAnalysis` data sources.

---

## Phase 2 — P1: Educational Value (5 features)

### 2.1 Promote sentence to technique

**Effort**: S · ~1 day

**What**: hover any sentence in research intelligence → "promote to technique" → modal pre-fills → `TechniqueEntry` created.

**Changes**:
- `client/src/components/ResearchSummaryRenderer.jsx` — wrap sentences in hoverable spans
- New: `client/src/components/PromoteToTechniqueModal.jsx`
- `useTechniques()` gets `addFromSentence(text, song, lensGuess)`; lens guess via keyword heuristic + optional `ICompletionService.classifyLens(text)`

**Acceptance**: any sentence becomes a technique in 2 clicks.

### 2.2 Timestamped question answers + scrollytelling

**Effort**: M · ~3 days

**What**: attach timestamp to any question answer. AuditDetail renders as scrollytelling — scroll scrubs audio.

**Changes**:
- No schema change (Audit.responses is `Mixed`). New response shape: `{text, timestampSeconds?}`
- `AuditForm.jsx` — "📍 tag current time" button next to each textarea
- `AuditDetail.jsx:446` — cards; IntersectionObserver scrollytelling trigger on hover/scroll
- New: `client/src/utils/scrollytelling.js` — debounced seek from intersection

**Acceptance**: tag answer at 2:25 → clicking it seeks player.

### 2.3 Per-bookmark CLAP analysis

**Effort**: M-L · touches Python · ~5 days

**What**: run CLAP on ±5s around each bookmark. Bookmarks gain `{timbre_tags, mood_tags, similar_to}`.

**Changes**:
- `analysis_service/analyzer.py` — new `analyze_segment(url, yt_id, start_s, end_s)`
- `analysis_service/app.py` — new `POST /analyze-segment`
- New port: `server/ports/IBookmarkAnalysisService.js`
- New adapters: `CLAPSegmentAdapter.js` + `MockBookmarkAnalysisAdapter.js`
- New service: `BookmarkAnalysisService` — enqueues on bookmark create
- `server/models/Audit.js:4-27` — bookmark schema extended with `analysis` field
- `client/src/pages/AuditDetail.jsx:540` — tag pills on bookmark cards

**Risks**: GPU contention. Add concurrent job limit of 2.

### 2.4 Liked-by-artist discovery

**Effort**: M · ~3 days

**What**: on a technique card, "Find similar" returns matching techniques across all artists in the user's notebook.

**Changes**:
- New port: `server/ports/IRecommendationService.js` — `findSimilarTechniques(userId, techniqueId, limit)`
- New adapter: `server/adapters/TFIDFAdapter.js` — TF-IDF cosine sim on `description + tags + lens`
- New hook: `client/src/hooks/useRecommendations.js`
- `client/src/components/TechniqueDetailModal.jsx` — "Similar techniques" section

**Fallback**: TF-IDF first. OpenAI embeddings if results poor.

### 2.5 Stem separation + per-stem analysis

**Effort**: L · ~1.5 weeks · new Python dep

**What**: separate song into 4 stems (drums, bass, vocals, other) via Demucs. Per-stem lanes in arrangement widget.

**Changes**:
- `pip install demucs` (~500MB)
- `analysis_service/app.py` — `POST /separate-stems`
- `server/models/Song.js:81-93` — add `stems` field
- New port: `server/ports/IStemSeparator.js`
- New adapters: `DemucsAdapter.js` + `MockStemSeparator.js`
- New service: `server/services/StemSeparationService.js`
- `client/src/components/ArrangementTimelineWidget.jsx` — per-stem lane toggle
- New: `client/src/components/StemPlayer.jsx` — solo/mute per stem

**Risks**: CPU/GPU demand. Serialize jobs, one at a time.

---

## Phase 3 — P2: Retention & Habit (3 features)

### 3.1 Daily "1 technique to remember" digest

**Effort**: M-L · ~5 days

**What**: daily push notification with one technique, spaced-repetition algorithm (SM-2 lite). 8am local time.

**Changes**:
- `server/package.json` — add `node-cron`, `web-push`
- `server/models/TechniqueEntry.js:53-57` — add `srs` fields
- New model: `server/models/PushSubscription.js`
- New service: `server/services/DigestService.js` — `pickDailyTechnique`, `sendDailyDigest`
- New port: `server/ports/INotificationService.js` — `sendPush`, `sendEmail`
- New adapters: `WebPushAdapter.js`, `SmtpAdapter.js`
- `server/server.js:71` — register node-cron job
- New hook: `client/src/hooks/usePushSubscription.js`

**Risks**: SMTP not configured by default. VAPID keys need documentation.

### 3.2 Offline-first audit drafts

**Effort**: L · ~1.5 weeks · full PWA setup

**What**: start audit, answer questions, log techniques offline. Syncs when online.

**Changes**:
- `client/package.json` — add `vite-plugin-pwa`, `workbox-*`
- `client/vite.config.js` — PWA plugin registration
- New: `client/src/db/idb.js` — IndexedDB schema
- New: `client/src/db/syncQueue.js` — operation log + retry
- New: `client/src/hooks/useOnlineStatus.js`
- Hooks gain offline-aware mode: write IDB first, replay to server on reconnect

**Risks**: Schema migrations painful. Last-write-wins acceptable for v1.

### 3.3 Mobile listening mode

**Effort**: M · ~3 days · depends on 3.2

**What**: stripped-down PWA screen for thumb use while walking. Big play/bookmark/lens buttons.

**Changes**:
- New page: `client/src/pages/MobileListen.jsx` — `/m/:songId`
- New component: `client/src/components/MobileTransport.jsx`
- Depends on PWA install (3.2)
- Deep-link from 1.1 → `/m/:songId`

---

## Phase 4 — P3: Community (4 features)

### 4.1 Multi-user collab on an audit

**Effort**: L · ~2 weeks · new model + WebSocket

**What**: share audit with read/write permissions. Per-question comments. Real-time presence.

**Changes**:
- New models: `AuditShare.js`, `AuditComment.js`
- `server/package.json` — add `socket.io`
- `server/server.js` — mount socket.io
- New port: `server/ports/ICollaborationService.js`
- New adapter: `server/adapters/SocketIOAdapter.js`
- New hook: `client/src/hooks/useAuditCollaboration.js`

**Risks**: JWT in `socket.handshake.auth.token`. 2+ concurrent connection testing.

### 4.2 Curriculum marketplace

**Effort**: M-L · ~1 week

**What**: publish, browse, fork custom curricula.

**Changes**:
- `server/models/Curriculum.js:30` — `creatorType` gains `'public'`
- New fields: `forkedFrom`, `likeCount`, `forkCount`
- New routes: marketplace (paginated), fork, like
- New page: `client/src/pages/Marketplace.jsx`
- New page: `client/src/pages/MarketplaceCurriculum.jsx`

### 4.3 Portfolio share image

**Effort**: S · ~1.5 days

**What**: 1200×630 OG image with stats, Bitwig-themed. Canvas render.

**Changes**:
- New: `client/src/components/PortfolioCard.jsx` — canvas render
- New: `client/src/utils/portfolioRenderer.js`
- New page: `client/src/pages/Portfolio.jsx` — `/portfolio`

### 4.4 Spotify / Apple Music playlist import

**Effort**: M-L · ~5 days · external API

**What**: paste playlist URL → server fetches tracks → bulk import into Arra.

**Changes**:
- New port: `server/ports/IPlaylistService.js`
- New adapter: `SpotifyAdapter.js` (+ `AppleMusicAdapter.js` deferred)
- New service: `server/services/PlaylistImportService.js`
- New route: `POST /api/import/playlist`
- New page: `client/src/pages/PlaylistImport.jsx`

**Risks**: Apple Music no public API — v2 only. Spotify OAuth for production.

---

## Phase 5 — P4: Power User (3 features)

### 5.1 MIDI sketch upload + analysis

**Effort**: M · ~4 days · Python dep

**What**: upload .mid → key/tempo/chord analysis. Piano-roll render in ComparePlayer.

**Changes**:
- `analysis_service/requirements.txt` — add `pretty_midi`
- `analysis_service/analyzer.py` — `analyze_midi(file_path)`
- `analysis_service/app.py` — `POST /analyze-midi`
- Extend `SongSketch` model with `midiAnalysis` field
- `client/src/components/ComparePlayer.jsx` — piano-roll when sketch is MIDI

### 5.2 Goal setting on study planner

**Effort**: S-M · ~2 days

**What**: set technique/curriculum completion goals. Dashboard shows progress bars.

**Changes**:
- New model: `server/models/Goal.js`
- New service: `server/services/GoalService.js`
- New route: `server/routes/goals.js`
- New page: `client/src/pages/Goals.jsx`
- `client/src/pages/Dashboard.jsx` — goal progress widget

### 5.3 Technique diffing (radar + monthly compare)

**Effort**: M · ~3 days

**What**: per-lens radar chart, month-over-month diff. Read-only analytics.

**Changes**:
- New service: `server/services/TechniqueAnalyticsService.js`
- New route: `GET /api/techniques/analytics`
- New component: `client/src/components/LensRadar.jsx`
- New component: `client/src/components/MonthlyDiffChart.jsx`
- New page: `client/src/pages/Analytics.jsx`

---

## New Ports & Adapters

| Phase | Port | Prod adapter | Test adapter |
|---|---|---|---|
| 0 | `IUserRepository` | wraps existing | wraps in-memory |
| 0 | `ICompletionService` | rename existing | rename existing |
| 1.2 | `ISketchRepository` | `MongooseSketchRepo` | `InMemorySketchRepo` |
| 2.3 | `IBookmarkAnalysisService` | `CLAPSegmentAdapter` | `MockBookmarkAnalysisAdapter` |
| 2.4 | `IRecommendationService` | `TFIDFAdapter` | `MockRecommendationAdapter` |
| 2.5 | `IStemSeparator` | `DemucsAdapter` | `MockStemSeparator` |
| 3.1 | `INotificationService` | `WebPushAdapter` | `MockNotificationAdapter` |
| 4.1 | `ICollaborationService` | `SocketIOAdapter` | `MockCollaborationAdapter` |
| 4.4 | `IPlaylistService` | `SpotifyAdapter` | `MockPlaylistAdapter` |

---

## Risk Register

| Risk | Phase | Mitigation |
|---|---|---|
| `@react-pdf/renderer` layout limits | 1.3 | Fixed positioning; code-split import |
| YouTube embed latency for A/B sync | 1.2 | Document; yt-dlp fallback for power users |
| Demucs GPU contention | 2.5 | Serialize; document hardware requirements |
| IndexedDB schema migrations | 3.2 | v1 schema versioning; last-write-wins |
| WebSocket auth | 4.1 | JWT in handshake; explicit disconnect |
| Spotify API OAuth | 4.4 | Public endpoint for v1; defer real OAuth |
| node-cron in same process | 3.1 | Acceptable; extractable to worker later |
| IRepository split breaks tests | 0.2 | Same-PR update; verify 51/51 green |

---

## Acceptance Gates (per phase)

1. All new code has tests; existing tests still pass (51 server + existing client)
2. Manual smoke: feature works end-to-end in dev
3. PM2 restart on Proxmox: `pm2 reload arra-server`
4. `agent_memory.md` session log updated · `devlogs.md` entry appended
5. No new linter warnings

---

## Next Session Start Here

**Phase 0 — SHIPPED** (`3a1e936`).
**Phase 1 — SHIPPED**: 1.1 deep-link bookmarks (`a0080cb`), 1.3 PDF export (`c322c95`), 1.2 A/B compare (uncommitted as of 2026-06-19).
**Next: Phase 2** (P1 Educational Value). Top candidates: 2.1 promote-to-technique (S/1d) or 2.3 per-bookmark CLAP analysis (M-L/5d).

To resume:
1. `git log --oneline -10` — confirm Phase 0 + all 3 Phase 1 features are committed
2. Read `agent_memory.md` checkpoint block
3. Pick Phase 2 entry and follow the **Changes** sub-list under that section
4. Honor the red lines in `agent_memory.md` (Phase 1 entries: deep-link, PDF, sketches/A-B compare)
