# Active Agent Memory — Arra

## Active Session Focus (Intent)
- **Goal**: Phase 2 educational value shipped (2.1, 2.2, 2.3, 2.4). 2.5 stem separation deferred. All carry-overs cleared. Next: Phase 3 or polish.
- **Status**: 234/234 client + 137/137 server + Vite clean. Main 614 KB. All 3 PM2 services online.
- **Next**: Phase 3 (3.1 daily digest / 3.2 offline-first PWA / 3.3 mobile listening) or polish (Lighthouse real scores, venv recreation, SSE→Redis pub/sub, PDF export perf).

## Resume Point (checkpoint 2026-06-20 — CARRY-OVER SWEEP #2 COMPLETE, 0 open)
- 5 commits closed all carry-overs: venv cleanup, TTL purge (`5cc91e3`), OpenAI embeddings (`017cc0e`), SSE push (`0fc8965`), multi-select+bulk-delete (`2ae313b`), export PNG+PDF (`9de48fe`), Lighthouse CI (`e6b0537`). Full per-commit detail in `devlogs.md`.
- Test totals: client 179→234 (+55), server 104→137 (+33). Vite clean. Main 614 KB unchanged.
- Service state: `arra-server` (SSE route wired), `arra-analysis` (576 MB RSS post-venv-cleanup), `arra-client` (26h+ uptime, no restart needed). All online.

## Critical Architectural Constraints (Red Lines)
- **YouTube Embedding**: `controls: 1` + `origin` in `playerVars`. Never `pointer-events: none` on iframe containers (blocks autoplay unlock gesture).
- **Service Layering**: Business logic in `services/`, not routers. Swappable repos (`MongoSongRepository`, `InMemoryRepository`).
- **PM2 Python Paths**: Resolve `yt-dlp` relative to `sys.executable` in FastAPI scripts.
- **Mock Repo Querying**: `InMemoryRepository` must support null-matching + `$ne`/`$eq` for MongoDB parity.
- **Vite Proxying**: `VITE_API_URL=/api` + `host: true` for network exposure without hardcoded localhost.
- **MongoDB on Proxmox kernel 6.19+**: Only 7.0.21+ works (v8.x crashes on startup). After apt upgrade, re-set `bindIp: 0.0.0.0` (resets to 127.0.0.1). Recreate `myAdmin` in `admin` db after fresh installs (`authSource=admin`).
- **Jest test paths**: `server/__tests__/`, run `npm test` from `server/` dir.
- **Audit Lenses**: Only rhythm, texture, harmony, arrangement (no `form`).
- **Export Formats**: Prefer HTML over markdown for generated reference docs/lessons/handoff sheets.
- **Token Optimization (Caveman)**: Terse devlogs/session summaries (omit articles/fluff). Skip backend tests on pure frontend/style changes to conserve tokens.
- **Tailwind CDN banned**: No `<script src="https://cdn.tailwindcss.com">` in `index.html`. Port utilities to inline styles.
- **Analysis webhook auth**: `server.js:156` enforces `Authorization: Bearer <ANALYSIS_WEBHOOK_SECRET>`. Python `analyzer.py` uses stdlib `_load_repo_dotenv()` + `_callback_headers()` (PM2 `env` block for arra-analysis is empty — .env is source of truth). Regression symptom: songs stuck `audioAnalysisStatus: 'pending'`, progress bar at 99%, `pm2 logs arra-analysis` shows `Callback response: 401`. Unstuck: set `status='failed'` + push message to `importErrors` (UI shows "Re-run Pipeline").
- **CLAP idle-evict**: `analyzer.py` lazy-loads CLAP singleton with 60s idle reaper (env `CLAP_IDLE_EVICT_SECONDS=0` disables). Evict = `del` + `gc.collect()` + `torch.cuda.empty_cache()` + `malloc_trim(0)`. GPU fully releases; RSS only -26 MB (mmap pages reused for fast warm restart). For full RSS recovery: `pm2 restart arra-analysis`.
- **Bigger CLAP on sm_61 (1050 Ti)**: `laion/larger_clap_music` (~1.2GB, music-tuned) runs via two Pascal workarounds: (1) `torch.backends.cudnn.enabled = False` (sm_61 missing from torch 2.6 cuDNN cap list); (2) skip `.half()` (FP16 convs hang on cuDNN-disabled path). FP32 ~0.4s/10s clip. No laion-clap package needed (transformers-format `ClapModel`). Remove both workarounds on sm_70+.
- **Service encapsulation**: Routes never touch `.searchService`, `.songRepository`, or `_`-prefixed methods. Use public service methods (`AuditService.getSongContext`, `SongService.researchSong`, `templateComposer.fallbackTemplate`).
- **IUserRepository split**: `verifyPassword`/`setPassword` on `IUserRepository extends IRepository`. Production: `UserRepository(User)`. Tests: `InMemoryUserRepository`. `server.js`: `new UserRepository(User)`.
- **ICompletionService port**: `completeText(prompt)→string` + `completeJson(prompt)→object` (adapters parse JSON internally). Production: `OpenAIAdapter`. Tests: `MockAIAdapter`. Consumers: TemplateComposer, SongService, CurriculumService, TasteService. Old `IAIModelService` shim deleted in Phase 2.1.

## Open TODOs
**Status: ALL CARRY-OVERS CLEARED. Next: Phase 3.**
- **3.1 Daily digest** (M-L/5d): `node-cron` + `web-push` + `PushSubscription` model + `INotificationService` port + SM-2 spaced repetition.
- **3.2 Offline-first audit drafts** (L/1.5w): `vite-plugin-pwa` + IndexedDB + sync queue.
- **3.3 Mobile listening mode** (M/3d, depends on 3.2): stripped `/m/:songId` page.
- **Polish**: real Lighthouse scores (needs `libnspr4+libnss3+libxss1+libgbm1+libasound2` apt install), venv recreation (stale pip shebangs from sonic-dna→arra rebrand), SSE→Redis pub/sub (multi-instance deploys), PDF export perf (large arrangements slow).

## Phase Status
- **Phase 1** (1.1 deep-links / 1.2 A/B compare / 1.3 PDF export): ✅ shipped + all 15 v2 follow-ups ✅.
- **Phase 2** (2.1 promote-to-technique / 2.2 timestamped+scrollytelling / 2.3 per-bookmark CLAP / 2.4 liked-by-artist TF-IDF): ✅ shipped. 2.5 stem separation deferred (Demucs heavy dep + 1.5w estimate).

## Pruned Session Log (Full history in devlogs.md; pre-June-19 in devlogs-archive.md)
| Date | Summary | Commit |
|---|---|---|
| 2026-06-20 | Carry-over sweep #2: ALL 5 closed — venv cleanup (RSS 716→576 MB), TTL purge `5cc91e3`, OpenAI embeddings `017cc0e` (17 tests), SSE push `0fc8965` (26 tests), multi-select+bulk-delete `2ae313b` (20 tests), export PNG+PDF `9de48fe` (25 tests), Lighthouse CI `e6b0537`. 179→234 client, 104→137 server. Zero open. | `e6b0537` |
| 2026-06-20 | Phase 2.2: timestamped answers + scrollytelling — responseShape normalizer, useMostVisible+useScrollytellingSeek, LensPanel tag button, AuditDetail click-to-seek pills + toggle (debounced 350ms, minJump 6s). 51 new tests. AuditDetail 47→51.8 KB. | `05a5dc6` |
| 2026-06-20 | fix(audit): Grouped-by-template branch key mismatch — `lens-${lens}-${idx}` read/write alignment; 4 regression tests. | `0988f3b` |
| 2026-06-20 | Phase 2.3: per-bookmark CLAP analysis — Python `analyze_segment` + `analyze_features_from_array` + POST /analyze-segment (GPU sem 2) + bookmarkSchema.analysis + IBookmarkAnalysisService + CLAPSegmentAdapter + BookmarkAnalysisService (queue 32, in-flight 8) + routes + BookmarkAnalysisTags component. 22 new tests. AuditDetail 51.8→58.1 KB. | `7c93e15` |
| 2026-06-20 | Phase 2.4: liked-by-artist TF-IDF discovery — IRecommendationService + TFIDFAdapter + RecommendationService + GET /:id/similar + useRecommendations + SimilarTechniquesSection. 50 new tests (17+9+5+9+14). TechniqueNotebook 65→74 KB. | `fb75fd8` |
| 2026-06-20 | HOTFIX: analysis webhook 401 — analyzer.py missing Bearer header. Stdlib `_load_repo_dotenv` + `_callback_headers`, all 4 callback sites updated. Unstuck song `6a3683c1a5b03c11405b4b09`. | `fbfb892` |
| 2026-06-20 | feat(analysis): idle-evict CLAP model — singleton reaper (60s, gc+malloc_trim+cuda.empty_cache), env `CLAP_IDLE_EVICT_SECONDS`. GPU fully releases; RSS -26 MB. Fixed orphan return in `analyze_segment`. | `fbfb892` |
| 2026-06-20 | feat(analysis): ship `laion/larger_clap_music` on sm_61 — transformers-format ClapModel (no laion-clap dep). cuDNN disable + FP32 workarounds for Pascal. ~0.4s/10s clip. | `166b147` |
| 2026-06-20 | Phase 2.1 promote-to-technique: lensGuess + splitSentences + useTechniques.addFromSentence + PromoteToTechniqueModal + ResearchSummaryRenderer sentence-hover. 34 new tests. Main 1047→1069 KB. | `3f3102f` |
| 2026-06-20 | Carry-over sweep #1: sigmap post-commit hook removed `2be1dd2` (+ `npm run sigmap`), lazy TechniqueDetailModal `073cab0` (-25 KB), AC-06 playhead live-region `7a2ed5f` (11 tests). 168→179 client. | `7a2ed5f` |
| 2026-06-20 | perf: code-split App.jsx routes — main 1069→613 KB (-43%), 11 lazy page chunks, PageFallback. 91/91 client. | `2f991ae` |
| 2026-06-20 | Phase 1 v2 sweep (15 fixes across 4 commits): player-ready poll, click analytics, PDF polish, sample-level delta, yt-dlp fallback harness, Playwright e2e, MIME anchor, sketch cascade, duration probe, AnalyserNode cache, drift polling, playback rate. 67→104 server, 25→54 client. | `9715e6f`+`1667686`+`61025f2`+`156efac` |
| 2026-06-19 | Phase 1.1/1.2/1.3 shipped: deep-link bookmarks `a0080cb`, A/B compare `af34984`, PDF export `c322c95`. Phase 1 complete. | `a0080cb`+`af34984`+`c322c95` |
| 2026-06-19 | P0-P4 Phase 0 refactor: IUserRepository split, ICompletionService port, 7 client data hooks, AuditForm 1040→461 lines. 44/44 server. | `3a1e936` |
| 2026-06-19 | Audit Panel Phase 2+3+4: LensPanel/SourcesPanel/CaptureTechnique, visual polish, a11y (ErrorBoundary, prefers-contrast, AC_AUDIT.md), perf (lazy 8 audit chunks, main 1082→999 KB), Tailwind CDN removal, responsive. | `88df2c3`+`b6bb792`+`e19adb6` |
| 2026-06-14 | Architecture audit: runtime fixes, security hardening (Bearer webhook, CORS, JWT fail-closed, rate limits, express-validator), repository abstraction, soft-delete standardization, SigMap config. 44/44 server. | `2cc8bf1` |
| 2026-06-10 | Full rebrand Sonic DNA → Arra + redeployment: PM2 ecosystem, MongoDB 7.0.35 (kernel 6.19 fix), live at arra.homma.casa. | `66249ec`+`8c35682` |
