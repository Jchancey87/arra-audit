# 🧠 Active Agent Memory — Arra

## 🎯 Active Session Focus (Intent)
- **Goal**: P0–P4 Phase 1 (Sharing & Export) — 1.1 / 1.2 / 1.3 all done. Phase 2 next.
- **Status**: ✅ Phase 1 complete. 1.1 deep-link bookmarks (`a0080cb`), 1.3 PDF export (`c322c95`), 1.2 A/B compare (`af34984`). Next: Phase 2 educational value.

## ⏸️ Resume Point (checkpoint 2026-06-19, session wrap-up)
- **Done**: All 3 Phase 1 features shipped in a single session. 6 commits (3 features + 3 doc/hash). 53/53 server + 25/25 client tests green, Vite build clean, Python files pass ast.parse.
- **Session wrap-up**: full inventory in `devlogs.md` "## 2026-06-19 — Session Wrap-up (Phase 1 complete)" — files touched, test coverage, bundle deltas, v2 follow-ups.
- **Next**: Phase 2 — 2.1 promote-to-technique (S/1d) is the smallest lift; 2.3 per-bookmark CLAP analysis (M-L/5d) is the biggest. User undecided.

## ⚠️ Critical Architectural Constraints (Red Lines)
- **YouTube Embedding**: Always set `controls: 1` and pass `origin` in `playerVars`. Removing `pointer-events: none` from iframe containers is mandatory to allow browser autoplay unlock gestures.
- **Service Layering**: Always write business logic in `services/`, not router files. Use swappable repository adapters (`MongoSongRepository.js` and `InMemoryRepository.js` for offline tests).
- **PM2 Python Paths**: Resolve `yt-dlp` relative to `sys.executable` in FastAPI scripts.
- **Mock Repo Querying**: `InMemoryRepository` must explicitly support null-matching and query operators (`$ne`, `$eq`) for parity with MongoDB.
- **Vite Proxying**: Set `VITE_API_URL=/api` and `host: true` in development to allow network exposure without hardcoded localhost strings.
- **MongoDB on Proxmox kernel 6.19+**: Only MongoDB 7.0.21+ works. v8.x crashes on startup. Use `mongodb-org` 7.0 repo (debian bookworm). After apt upgrade, `/etc/mongod.conf` resets `bindIp` to `127.0.0.1` — always re-set to `0.0.0.0`. Auth user `myAdmin` must be recreated in `admin` db after fresh installs (URI: `authSource=admin`).
- **Jest test paths**: Tests live in `server/__tests__/`. Always run as `npm test` from `server/` dir.
- **Audit Lenses**: Keep auditing templates and questions strictly structured under the four core lenses: rhythm, texture, harmony, and arrangement.
- **Export Formats**: Prefer beautiful HTML files over markdown for generated reference documents, lessons, and exportable handoff sheets.
- **Token Optimization (Caveman Style)**: Write devlogs, session summaries, and agent logs in highly terse, compressed "caveman" style (omit articles, pleasantries, fluff) to maximize token efficiency. Skip backend testing on pure frontend/style changes to conserve context window tokens.
- **Tailwind CDN banned**: No `<script src="https://cdn.tailwindcss.com">` in `index.html`. All utility classes must be ported to inline styles. Affects Dashboard, AuditDetail, StudySessionWorkspace.
- **Audit panel responsive classes**: `.audit-modules` (4→2 col), `.audit-lane-label` (80→60→56px), `.audit-lane-waveform` (40→28px mobile), `.audit-meta-chips` (hidden mobile), `.audit-override-button` (hidden mobile), `.audit-tabbar` (overflow-x mobile), `.capture-top-row`/`capture-textareas` (4→2, 2→1 col), `.audit-form-main` (16→10px padding). All in `client/src/styles/global.js`.
- **Lazy audit components**: All 8 audit components in `AuditForm.jsx` use `React.lazy()` + `<Suspense>`. LensPanel constants extracted to `lensConstants.js` to avoid static-import collision.
- **Service encapsulation**: Routes never touch `.searchService`, `.songRepository`, or `_`-prefixed methods. All ad-hoc repo/search access moved behind public service methods (`AuditService.getSongContext`, `SongService.researchSong`, `templateComposer.fallbackTemplate`).
- **IUserRepository split**: `verifyPassword`/`setPassword` live on `IUserRepository extends IRepository`, not on the generic `IRepository`. Production: `UserRepository(User)` in `MongooseRepository.js`. Tests: `InMemoryUserRepository` in `InMemoryRepository.js`. `server.js` uses `new UserRepository(User)`.
- **ICompletionService port**: Replaces `IAIModelService` (kept as deprecated shim, removed in Phase 2). Two clean methods: `completeText(prompt) → string` and `completeJson(prompt) → object` (adapters parse JSON internally). Production: `OpenAIAdapter`. Tests: `MockAIAdapter`. Migrated consumers: `TemplateComposer`, `SongService`, `CurriculumService`, `TasteService`.
- **Client data hooks (Phase 0.4)**: `client/src/hooks/` holds 7 deep-module hooks wrapping `IBackendService`: `useSong`, `useAudits`, `useAudit`, `useTechniques`, `useStudyProgress`, `useCurricula`, `useTasteProfiles`. Each provides `{ state, loading, error, refetch, action… }`. All use `useBackend()` to access the adapter (which works with both `HttpBackendAdapter` prod and `InMemoryBackendAdapter` test). AuditForm/TechniqueNotebook refactor to use the hooks is a follow-up task — the layer is now in place.
- **Deep-link bookmarks (Phase 1.1)**: `/audit/:id?t=<sec>&bookmark=<id>` opens audit, seeks player, pulses matching bookmark card for 4s. `client/src/utils/deepLinks.js` (buildAuditLink/parseDeepLinkParams/DEEP_LINK_KEYS), `client/src/hooks/useDeepLinkParams.js` (react-router `useSearchParams` wrapper), `client/src/components/ShareLinkButton.jsx` (`navigator.share` → clipboard fallback with "Copied"/"Copy failed" feedback). `AudioContext` exposes `highlightBookmark(id, {durationMs})` + `highlightBookmarkId`. `AuditDetail` consumes all three: applies deep-link once on mount (with 350ms seek delay for YouTube player mount), renders `ShareLinkButton` on each bookmark card with `compact` style, highlights matching card via `box-shadow` + orange border.
- **PDF report export (Phase 1.3)**: Bitwig-themed PDF for completed audits via `@react-pdf/renderer` 4.5.1. `client/src/pdf/theme.js` (COLORS/SPACING/RADII/PAGE/TYPE/LENS_LABELS/LENS_DESCRIPTIONS + `registerArraFonts()` for Roboto Mono + Barlow from `/fonts/`). `client/src/utils/pdfData.js` (`prepareReportData(audit, song)` pure normalizer — handles array/object/string response shapes, prefers `audioOverrides` over `audioAnalysis`, drops invalid bookmarks/techniques). `client/src/pdf/AuditReport.jsx` (Document with Cover + Lens + Bookmarks + Techniques pages, fixed footer). `client/src/utils/pdfExport.jsx` (renamed from .js for JSX; `loadPdfRenderer()` cached dynamic-import + `renderAuditToBlob` + `downloadBlob` + `buildAuditFilename`). `client/src/components/ExportPdfButton.jsx` (ghost-variant, 4 states, SVG icons, runIdRef cancel). `client/public/fonts/` ships Roboto Mono Regular+Bold (Apache 2.0) + Barlow Regular+SemiBold+Bold (OFL) — 919KB total. `AuditDetail` renders button in header actions only for `status === 'completed'`. **Bundle impact**: main 1010→1016KB (+6KB), react-pdf 1.6MB lazy-loaded on click. **Tests**: vitest+jsdom setup (`client/vitest.config.js` + `client/src/test/setup.js`); 20 tests across `pdfData.full.test.js` (10) + `pdfData.minimal.test.js` (10) covering normalizeResponseEntry/normalizeBookmark/normalizeTechnique + formatTimestamp. **Run**: `npm test` from `client/`. **Caveat**: end-to-end PDF render smoke test deferred — jsdom lacks `fetch(file://)`; would need polyfill or browser env. Manual smoke in Chrome/Preview still required before claiming full acceptance.
- **A/B compare mode (Phase 1.2)**: Upload DAW sketch, sync against YouTube reference, dual transport + delta. `server/models/SongSketch.js` (soft-delete, `analysis` Mixed mirrors `Song.audioAnalysis`, `analysisStatus` enum). `server/services/SketchService.js` (createSketch w/ type+size guard, getSketchesForSong, deleteSketch soft+unlink, analyzeSketch → Python `POST /analyze-sketch` 15s timeout). `server/routes/sketches.js` (multer 100MB, allowed ext `mp3|wav|m4a|aac|flac`, routes: `GET /songs/:songId`, `POST /songs/:songId/upload`, `GET /:id`, `DELETE /:id`, `POST /:id/analyze`). `analysis_service/analyzer.py` (`analyze_sketch_file(file_path, sketch_id, callback_url)` reuses `analyze_audio_file` synchronously). `analysis_service/app.py` (`SketchAnalysisRequest` BaseModel + `POST /analyze-sketch` returns `{status, sketch_id, analysis}` sync; 404 if file missing). Client port methods on `IBackendService`: `getSketches`/`getSketch`/`uploadSketch`/`deleteSketch`/`analyzeSketch`. `HttpBackendAdapter` FormData upload mirrors `uploadAudioSketch`. `InMemoryBackendAdapter` has `this.sketches = []` + 5 mocks. `client/src/hooks/useSketches.js` (list + optimistic upload + filter remove + merge analyze). `client/src/components/ComparePlayer.jsx` (YouTube master clock via `useAudio`, hidden `<audio>` for sketch, drift sync every 500ms when `|drift| > 0.4s`, Web Audio `AnalyserNode` → 96-bar canvas heatmap, side-by-side metadata + BPM delta bar + key-match indicator). `client/src/pages/SketchCompare.jsx` (`/compare/:songId/:sketchId` route, file upload + per-sketch Analyze/Delete). `client/src/App.jsx` 2 new routes. `client/src/pages/AuditDetail.jsx` "A/B Compare" button. **Bundle impact**: main 1016→1043KB (+27KB). **Tests**: 8 SketchService (full+ext+size+ownership+list+get+delete+analyze success/failure), 3 useSketches (empty+upload+analyze), 2 ComparePlayer (renders with/without analysis). **Known v2 limits**: YouTube IFrame drift on long playback; no sample-level delta (v1 shows sketch energy only); no yt-dlp fallback for embed-blocked videos; no cascade on song delete.

## 🛠️ Open Priority TODOs
- [x] Time signature selector (3/4, 6/8) in ArrangementTimelineWidget.
- [x] Horizontal zoom control (PX_PER_SEC slider) in timeline.
- [ ] Multi-select and bulk-delete track blocks.
- [ ] Export arrangement as image/PDF.
- [ ] Lighthouse CI gate + a11y/manual walkthrough (Phase 4.1 follow-up; AC_AUDIT.md created).
- [ ] Live-region for playhead time updates (AC-06 follow-up).
- [ ] Code-split Dashboard + remaining pages to drop main bundle below 800KB.

## 🔄 Pruned Session Log (Full history in devlogs.md)
| Date | Summary | Commit |
|---|---|---|
| 2026-06-19 | Phase 1.2 A/B compare: SongSketch model + SketchService + sketches route + 5 client port methods + useSketches hook + ComparePlayer (YouTube master clock + sketch audio + drift sync + Web Audio canvas) + SketchCompare page + Python /analyze-sketch endpoint. 8+3+2 tests. Main 1016→1043KB. | `af34984` |
| 2026-06-19 | docs: record Phase 1.2 commit hash af34984 + sigmap regen | `1eb84c8` |
| 2026-06-19 | Session wrap-up: full inventory (files/tests/bundle/v2 follow-ups) appended to devlogs.md | (wrap-up entry) |
| 2026-06-19 | Phase 1.3 PDF export: theme.js (Bitwig tokens + font reg), pdfData.js (normalizer), AuditReport.jsx (Document w/ 4 page types), pdfExport.jsx (dynamic-import wrapper), ExportPdfButton.jsx (4 states), fonts/ (Roboto Mono + Barlow), AuditDetail wiring, vitest+jsdom setup, 20 tests. Main 1010→1016KB; react-pdf 1.6MB lazy. | `c322c95` |
| 2026-06-19 | Phase 1.1 deep-link bookmarks: deepLinks util + useDeepLinkParams hook + ShareLinkButton (navigator.share→clipboard) + AudioContext.highlightBookmark + AuditDetail wiring. Vite clean. | `a0080cb` |
| 2026-06-19 | P0–P4 Phase 0: 0.1a/b/c leaks fixed, IUserRepository split, IAIModelService → ICompletionService rename, 7 client data hooks, AuditForm 1040→461 lines consuming hooks (no `backend.*` in pages), 6 extracted subcomponents + 3 utility hooks. Server 44/44, Vite clean. | `3a1e936` |
| 2026-06-19 | Audit Panel Phase 3 + 4: polish, a11y (ErrorBoundary, prefers-contrast, AC_AUDIT.md), perf (lazy 8 audit chunks + useMemo), Tailwind CDN removal, responsive (audit-modules 2x2, mobile lane heights) | `b6bb792` |
| 2026-06-19 | Audit Panel Phase 2.3+2.4+2.5: LensPanel focus + count + customPrompts, SourcesPanel URL guard + hostname dot color + add/reimport stubs, CaptureTechnique tag suggestions + Ctrl+Enter/Esc + localized error, saved-list clickable timestamp | `88df2c3` |
| 2026-06-19 | Audit Panel Phase 2.6+2.7: Header Save Draft + Saving state + inline completion warning, completionReason useMemo (3 msgs) + hasAnyResponse gate, NotebookPanel rewrite (search/sort/delete/seek) + 2-step confirm, InMemoryBackendAdapter songId/auditId/artist/tags/sortBy parity | `e19adb6` |
| 2026-06-19 | Fix TDZ: hoist loadNotebookTechniques useCallback above dependent useEffect in AuditForm; push to origin; deploy via deploy.sh — all 3 PM2 services online | `0d25b42` |
| 2026-06-19 | New handoff: HANDOFF_AUDIT_PANEL_PHASE_3_4.md — Phase 3 visual polish (3.1–3.5) + Phase 4 a11y/perf/responsive/Tailwind removal. 0/9 line items. 14h est across 3 sessions. | `e814040` |
| 2026-06-19 | Audit Panel Phase 2.1+2.2: Tap Tempo, Reset, edit indicator on Track Analysis; marker CRUD (M key, right-click menu), Space play/pause, click-anywhere-seek on all 6 lanes, inline section add form, beat-envelope synthetic waveform | `09ff8ef` |
| 2026-06-19 | Analysis Panel redesign Phase 1: tab system (Analysis/Lens/Sources/Notebook), new header, Capture Technique sticky footer, design tokens (JetBrains Mono, surface scale), Track Analysis modules with scale degree row, multi-lane timeline, Sources panel | `—` |
| 2026-06-18 | Start all services (backend, client, analysis) via PM2 ecosystem config. Tests pass. | - |
| 2026-06-14 | Architecture audit implementation: runtime fixes, security hardening, auth/repository abstraction, curriculum cleanup, rate limiting, config fixes, and dev-server restart | `2cc8bf1` |
| 2026-06-14 | Sync auto-generated SigMap context files after architecture audit changes | `ed9c8c6` |
| 2026-06-13 | Rebrand emoji icons to clean DAW-aligned inline SVGs across client pages | `a875e5c` |
| 2026-06-13 | Fix study progress day completion 500 error due to confidence field type mismatch | `f870e3d` |
| 2026-06-13 | Implement daily study session workspace page, uploader, populates, and verify builds | `ebaae66` |
| 2026-06-13 | Implement client adapters, StudyPlannerDashboard, Router hooks, and dashboard widget | `ebaae66` |
| 2026-06-13 | Create CurriculumService, Multer configs, API routes, server hooks, and integration tests | `ebaae66` |
| 2026-06-13 | Create Curriculum/StudyProgress models, seed script, uploads dir, Mongoose repo mapping, unit tests | `ebaae66` |
| 2026-06-06 | ArrangementTimelineWidget v2: BPM autofill, BARS/SECS ruler toggle (4/4), multi-track lanes | `b6f3e75` |
| 2026-06-07 | Integrate SigMap and configure Antigravity MCP server | `0f0a791` |
| 2026-06-07 | Prune agent_memory.md to optimize token usage | `c4c348c` |
| 2026-06-07 | Scaffold CLAP GPU analysis pipeline & fallback simulation | `7151075` |
| 2026-06-10 | Rebrand: all Sonic DNA → Arra references in source, docs, deploy scripts | `66249ec` |
| 2026-06-10 | Full redeployment: PM2 ecosystem config, MongoDB 7.0.35 upgrade, live at arra.homma.casa | `8c35682` |
| 2026-06-10 | Clean YouTube metadata noise (e.g. Official Music Video) from Tavily research queries | `6ed42a3` |
| 2026-06-10 | Integrate python audio analysis microservice into PM2 and deploy script | `67f3148` |
| 2026-06-10 | Add simulated progress bar displaying extraction stages to Phase 1 Audit loading state | `1b6d53a` |
| 2026-06-10 | Allow resuming guided audits from Dashboard history list and AuditDetail review views | `9a95351` |
| 2026-06-10 | Implement UI/UX design handoff: Bitwig dark studio theme, playheads, dynamic zoom, and meter signature dropdown | `e167637` |
| 2026-06-10 | Resolve workspace black hole theme issue by aligning card/panel backgrounds with perfect dark grey (#282828) | `97fa1a7` |
| 2026-06-10 | Research teach/caveman. Add token/lens rules. | `-` |
| 2026-06-11 | Refactor active feed song card badges/actions to Tailwind flex rows | `d3d52c1` |
| 2026-06-11 | Refactor concrete exercises description typography to improve readability | `49da561` |
| 2026-06-11 | Refactor concrete exercises card layout, padding, spacing, and lists | `e81824b` |
| 2026-06-11 | Remove max-width constraints on concrete exercises to allow full-width text | `ef92b3d` |
| 2026-06-11 | Set Noto Sans 18px 400 as default global typography style | `da5cd7e` |
| 2026-06-11 | Set size 18 on audit questions labels in AuditForm (Phase 3) | `f9a1a6a` |
| 2026-06-13 | Create handoff.md mapping all target files, lines, and custom SVG DAW elements | - |
| 2026-06-11 | GTX 1050 Ti GPU CLAP setup: torch 2.6.0+cu126, transformers 5.x API fix (audios→audio), 4.23GB VRAM confirmed | `15e025e` |
