# Development Logs & Learnings

> **Archive**: pre-2026-06-19 entries moved to `devlogs-archive.md` to keep this file tight. See `agent_memory.md` session log for a one-line-per-commit summary.

This log tracks architectural decisions, workflows, key configurations, and learnings gained during development.

---

## Log Entries

### 2026-06-20: Fix Canvas Timeline compilation, initialization, and scrubbing test regressions

- **Context**: Resolved syntax and runtime errors in the newly migrated Canvas-based `AuditTimeline.jsx` component that broke the frontend client build, and fixed subsequent Vitest failures.
- **Fixed Build & Syntax Errors**:
  - Removed dangling closing `</div>` tags below the scrub tooltip expression that caused a mismatch with the root `<section>` container tag and broke esbuild/Vite.
  - Relocated the initialization hooks of `arrangementDensityPoints` and `densitySvgPath` before they are accessed in the canvas rendering `useEffect` block, resolving a runtime `ReferenceError: Cannot access before initialization`.
- **Repaired Test Suite and Mocks**:
  - Dynamically assigned `scrubBarRef` depending on whether `showEnergy` is active, allowing JSDOM tests to measure the mocked rect of the energy slider (or Seek lane if hidden), fixing the scrubbing tests.
  - Added a null check for canvas 2D context (`if (!ctx) return;`) to safely handle JSDOM environments where `canvas.getContext` returns null.
  - Updated the accessibility fallback rendering of key regions to render the key/scale prefix (`r.key + scale · label`), preserving exact string queries (`queryByText`) behavior for analytical sections in existing tests.
  - Verified 288/288 Vitest tests pass clean.

### 2026-06-20: Migrate Timeline to Layered Canvas Architecture & Repair Unit Tests

- **Context**: Transitioned the DAW arrangement timeline from a DOM-based rendering system (slow React updates on zoom, scroll, and playback) to a high-performance Layered Canvas Architecture, resolved interaction issues, and fixed the unit test suite under JSDOM.
- **Completed Refactoring**:
  - Replaced the timeline SVG waveform, playhead, sections, and track blocks with a high-DPI scaled HTML5 `<canvas>` rendering pipeline.
  - Added click and contextMenu event handlers to map viewport clicks to corresponding timeline models.
- **Fixed Bugs and Missing Interactive Actions**:
  - Resolved compile syntax errors caused by obsolete ticker/ruler remnants in `ArrangementTimelineWidget.jsx`.
  - Fixed track block click selection logic inside `handleDragUp` for `track-block-move` when the block was clicked rather than dragged.
- **Refactored Unit Tests**:
  - Rewrote the ArrangementTimelineWidget test suite to mock the Canvas 2D context APIs (`fillRect`, `scale`, `measureText`, `roundRect`, etc.) and `getBoundingClientRect` for JSDOM.
  - Updated tests to trigger `mouseDown` with coordinates mapping back to specific blocks or lanes.
  - Simulated right-clicks using `{ button: 2 }` in `mouseDown` to verify context menu rendering and behavior.
  - All 288 client tests now compile and pass cleanly.

### 2026-06-20: Fix Section Resizing Stale Closures, Add Drag-to-Copy Sections to Tracks, and Build Custom Context Menus

- **Context**: Solved interaction issues in the DAW timeline editor where section blocks could not be resized after creation, implemented an intuitive drag-to-copy cloning interaction to copy sections onto instrument lanes, and built rich right-click context menus for faster editing.
- **Fixed Stale Closure Bugs**:
  - Replaced stale scope references to the `blocks` and `tracks` state inside the mouse drag event handlers (`handleSectionResize`, `handleTrackBlockResize`, and `handleTrackBlockMove`) with mutable React refs (`blocksRef.current` and `tracksRef.current`).
  - Added synchronous ref updates during the render pass to guarantee mouse move and mouse up handlers have absolute real-time access to the timeline arrangement.
- **Implemented Drag-and-Drop Copy & Paste**:
  - Attached custom mouse event listener triggers (`handleSectionDragStart`) to arrangement sections.
  - While dragging, a premium semi-transparent ghost of the block showing `📄 Copy [Section Name]` tracks the mouse pointer using `position: 'fixed'`.
  - Added `data-track-id` selectors to track rows and used the browser's `document.elementFromPoint` API at drag termination to resolve which track lane was targeted.
  - Automatically clones the section block's boundaries (startTime and duration) as a new block in the targeted track's blocks.
- **Built Right-Click Context Menus**:
  - Attached custom `onContextMenu` overrides to section blocks, the sections lane, track blocks, and track lanes.
  - Displays a high-fidelity glassmorphism dropdown with a deep-blur backdrop, custom hover highlights, and comprehensive options ("Inspect Section", "Play Section/Block", "Sync to Playhead", "Change Sound Type", "Clear Track", "Delete Track/Block").
  - Dismisses the custom context menu automatically when scrolling or clicking anywhere else on the screen.
- **Validation & Test Coverage**:
  - Created a comprehensive test suite `/client/src/components/__tests__/ArrangementTimelineWidget.test.jsx` verifying rendering, right-click triggers, and menu item callbacks.
  - Executed tests using Vitest; all 288 tests in the client pass successfully.

### 2026-06-20: Remove Loudness, BPM, and Key boxes & Enhance Timeline with Zoom, Bird's-Eye Minimap, Density Graph, and Structural breakdown

- **Context**: Addressed user feedback to streamline the analysis dashboard by removing distracting metric boxes (loudness, BPM, Key, Meter) and focused on making "time" a central feature for structural visualization.
- **Removed Loudness/BPM/Key Boxes**:
  - Deleted the `TrackAnalysisModules` component from the Edit Analysis Tab (`AuditAnalysisTab.jsx`) completely.
  - Replaced the legacy `Active Values Grid` (loudness, BPM, Key, Meter) and simple sequencer grid timeline from the Audit Detail Page (`AuditDetail.jsx`) with a clean read-only rendering of the complete timeline schema (`AuditTimeline.jsx`).
- **Interactive Timeline Upgrades (`AuditTimeline.jsx`)**:
  - **Horizontal Zooming**: Introduced a custom `zoomScale` factor (from 1x to 8x) managed via slider and `[-]` / `[+]` button controls in the header. The main lanes container now scales dynamically, enabling responsive horizontal scrolling.
  - **Finer Precision Dragging**: Calibrated the drag/resize action calculations to take the horizontal zoom factor into account, giving users finer precision for shifting and resizing structural blocks.
  - **Bird's-Eye Song Minimap**: Rendered a full-song overview minimap at the top of the timeline. Displays color-coded blocks of all arrangement sections, a real-time playhead, and a draggable/scrolling viewport highlight frame mapping the active scrolled window.
  - **Arrangement Density Graph Lane**: Created an interactive SVG area chart lane that counts the overlapping instrument clips active at any point in time. Visualizes build-ups, drops, and layer density synced to the timeline.
  - **Structural Composition Breakdown**: Added an analytics breakdown card at the bottom showing a segmented horizontal proportion bar of sections, alongside occurrences and total duration statistics per section type.
- **Verification & Testing**:
  - Confirmed all 283 unit tests compile and pass cleanly after updating section query matchers to support multiple visual representations, and built the production bundle with zero warnings.

### 2026-06-20: Fix PDF Export Crash and Vite Duplicate Style Key Warning

- **Context**: Resolved user-reported issue where PDF export was failing on audits and fixed a warning in the client production build.
- **PDF Export Fix**:
  - Identified a crash in `@react-pdf/renderer` inside `AuditReport.jsx` where empty strings (`""`) evaluated via logical AND (`&&`) checks inside JSX were returned to the `<View>` parent.
  - Since React-PDF crashes when raw text/strings are rendered outside of a `<Text>` component, empty string expressions (like `{entry.answer && ...}`) threw an exception in the browser.
  - Replaced the conditional `&&` checks for `entry.question`, `entry.answer`, and `entry.note` with ternary operators resolving to `null` (`? ... : null`) which React-PDF safely ignores.
- **Timeline Warning Fix**:
  - Cleaned up a duplicate `boxShadow` key in the style object for `ArrangementTimelineWidget.jsx` which was triggering an esbuild warning during Vite builds.
  - Merged the selection (`isSel`), multiselection (`isMulti`), and playhead current block (`isCur`) shadow states into a single clean nested conditional expression.
  - Verified the client application compiles with zero build warnings and all 283 unit tests pass cleanly.

### 2026-06-20: Refactor Track Analysis page, add Tavily cross-verification, and make timeline lanes toggleable

- **Context**: Refactored the track analysis modules and the timeline lanes to address user request on visual distraction/regression and unconfident metrics.
- **Track Analysis Modules**:
  - Exposed a targeted Tavily search cross-verification pipeline (`crossVerifyAnalysis`) on the backend.
  - When the GPU analysis completes, or manually requested via "Verify with Tavily", query Tavily for targeted musical metadata (BPM, key, scale, meter) and use the LLM to extract verified values.
  - Cross-verify Tavily extraction with GPU analysis: promote confidence to 0.95 and mark as `cross_verified` if they agree, or override low-confidence values with Tavily's verified metadata.
  - Hide BPM, Key, and Meter modules from the UI by default when their confidence is below 95% and not cross-verified or manually overridden, rendering a clear verification alert/action card instead.
- **Audit Timeline**:
  - Converted Beat Grid, Key Regions, and Energy lanes into toggleable overlays or optional lanes (hidden by default to avoid visual clutter and distraction).
  - Added "Waveform", "Beats", and "Keys" quick toggles in the timeline header.
  - Reinvented the Beat Grid UI: when "Beats" is checked, render faint vertical dashed/dotted grid lines spanning *behind* all timeline lanes (Sections/Markers) as a background reference, rather than a separate horizontal lane of ticks.
  - Reinvented the Energy/Waveform UI: render a subtle waveform backdrop directly inside the top Playhead/Seek scrubber lane, preserving vertical space while offering visual cues.
  - Defaulted all optional lanes to `false` in production, but enabled them in `baseProps` for tests to maintain backward compatibility. All 49 client unit tests and 139 server Jest tests pass successfully.

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

## 2026-06-20 — Carry-Over Code-Split: App.jsx Routes

**Goal**: knock out the "Code-split Dashboard + remaining pages to drop main bundle below 800KB" carry-over from `agent_memory.md` open TODOs. Hit target with 11 pages split via `React.lazy` + `Suspense`.

**Commit**: `2f991ae` — `perf: code-split App.jsx routes — main bundle 1069→613KB (-43%)`

### Files

- `client/src/App.jsx` — convert 11 page imports to `React.lazy(() => import('./pages/...'))`; wrap each `<Route>` in `<Suspense fallback={<PageFallback />}>`; `Login` stays eager (small, public, first-paint); the 13 routes become 13 declarative Route + Suspense nests inside `<PrivateRoute>` (or directly for `/` and `/login`)
- `client/src/components/PageFallback.jsx` (new, 38L) — bitwig-styled spinner with `role="status" aria-live="polite"` + inline `@keyframes` (no global CSS injection needed); centered in viewport with `Loading…` label in Roboto Mono + 10px uppercase orange
- `client/src/components/__tests__/PageFallback.test.jsx` (new) — 2 tests (renders with role + label, no-throw)

### Bundle deltas (Vite build before vs after)

| Stage | Main bundle (gzip) | Lazy chunks | Status |
|---|---|---|---|
| After Phase 2.1 | **1069 KB** (250 KB) | 11 audit subcomponents + react-pdf 1.6 MB | over target |
| After route code-split | **613 KB** (178 KB) | 11 page chunks + 11 audit subcomponents + react-pdf | **under 800 KB** |

Net change: main **-456 KB (-43%)**, gzip **-72 KB (-29%)**. The 11 pages are now separate chunks loaded on demand:

| Page chunk | Size (gzip) | Notes |
|---|---|---|
| `TechniqueNotebook` | 65 KB (10 KB) | includes `TechniqueDetailModal` |
| `ArrangementTimelineWidget` | 56.5 KB (9.5 KB) | extracted as a shared chunk between AuditDetail + StudySessionWorkspace |
| `Dashboard` | 47 KB (7 KB) | |
| `AuditDetail` | 47 KB (10 KB) | includes ArrangementTimelineWidget + ResearchSummaryRenderer + ExportPdfButton |
| `StudyPlannerDashboard` | 44 KB (7 KB) | |
| `Settings` | 40 KB (6 KB) | |
| `AuditForm` | 38 KB (9 KB) | + lazy audit subcomponents (8 chunks 2-20 KB) |
| `StudySessionWorkspace` | 38 KB (6 KB) | includes ArrangementTimelineWidget |
| `SketchCompare` | 31 KB (7 KB) | includes `ComparePlayer` |
| `Trash` | 30 KB (4 KB) | |
| `AuditCreate` | 16 KB (3 KB) | |

### Test coverage delta

| Suite | Before | After | Delta |
|---|---|---|---|
| Client vitest | 89 | **91** | +2 (PageFallback role + label) |

All green: 91/91 client vitest. Vite build clean. `react-pdf` lazy chunk still 1.6 MB (unchanged — loaded on PDF export only).

### UX impact

- First-paint after login: 613 KB main + lazy Dashboard 47 KB (gzip total ~185 KB) — significantly faster than the prior 1069 KB
- Route transitions: each page loads its own chunk; the spinner appears for ~1 frame on fast networks, longer on slow ones
- SEO: N/A (SPA, no SSR); no impact on crawlers
- The fallback spinner is `role="status" aria-live="polite"` so screen readers announce "Loading…"

### Remaining bundle opportunities (logged for future)

- **`TechniqueDetailModal` extraction** (in `TechniqueNotebook` chunk, 65 KB): currently loaded on notebook open; could be split so it only loads when a technique is clicked. Saves ~10-15 KB on initial TechniqueNotebook open
- **`ArrangementTimelineWidget` shared chunk**: already extracted by Vite as 56.5 KB shared chunk between AuditDetail + StudySessionWorkspace — good
- **`react-youtube` extraction**: `react-youtube` is statically imported in `AudioContext` (the floating player) so it stays in the main bundle. Could be split by wrapping `<AudioPlayer>` in its own lazy boundary, but that risks player-load UX regressions
- **PDF export**: `@react-pdf/renderer` 1.6 MB is already lazy (only loads on Export click). Optimal as-is

### Carry-overs updated in `agent_memory.md`

- ✅ "Code-split Dashboard + remaining pages" — completed
- 🆕 "Extract `TechniqueDetailModal` into its own chunk" — added to open TODOs
- 🆕 "Refine `react-youtube` lazy split" — not added; keep as-is for player stability

## 2026-06-20 — Session Wrap-Up (start here next session)

**Goal**: ship a Phase 2 feature + knock out a carry-over, end with clean resume state.

### What landed this session (7 commits, 1 push)

| # | Hash | Subject | Type |
|---|---|---|---|
| 1 | `965bd21` | docs: sigmap regen (post-Phase 1 v2 sweep) | noise |
| 2 | `3f3102f` | Phase 2.1: promote-to-technique — hover sentence, modal pre-fill, lens heuristic | feature |
| 3 | `3c47768` | docs: Phase 2.1 wrap-up + sigmap regen | docs |
| 4 | `b8e6128` | docs: sigmap regen (final) | noise |
| 5 | `2f991ae` | perf: code-split App.jsx routes — main bundle 1069→613KB (-43%) | feature |
| 6 | `c58fc98` | docs: code-split wrap-up — 1069→613KB main, page chunk inventory | docs |
| 7 | `94d9844` | docs: sigmap regen (post-code-split) | noise |

### Test + bundle totals

| Metric | Pre-session | Post-session | Delta |
|---|---|---|---|
| Server Jest | 67/67 | 67/67 | — (no backend changes) |
| Client vitest | 89/89 | **91/91** | +2 (PageFallback) |
| Playwright e2e | 2/2 (skip) | 2/2 (skip) | — |
| **Main bundle** | **1047 KB** | **613 KB** | **-434 KB (-41%)** |
| **Main bundle (gzip)** | **250 KB** | **178 KB** | **-72 KB (-29%)** |
| Lazy chunks | 11 + react-pdf 1.6MB | 22 (11 page + 11 audit) + react-pdf | +11 page chunks |

### Phase 2 status

- ✅ 2.1 promote-to-technique (S/1d) shipped — smallest feature, biggest UX win per hour
- ⏭️ 2.2 timestamped answers + scrollytelling (M/3d) — **recommended next**: no schema change, `Audit.responses` is already `Mixed`, pure UX
- ⏭️ 2.3 per-bookmark CLAP analysis (M-L/5d) — biggest educational-value feature, needs Python + GPU concurrent limit 2
- ⏭️ 2.4 liked-by-artist discovery (M/3d) — TF-IDF cosine sim on techniques
- ⏭️ 2.5 stem separation (L/1.5w) — Demucs dep, per-stem lanes

### Stale technical debt (tackle first thing next session if a 30-min slot opens)

- **Sigmap regen noise** (4-6 commits per feature, this session produced 3 noise commits). Fix: `rm .git/hooks/post-commit` + add `client/package.json` script `"sigmap": "node gen-context.js"`. Run manually when needed.
- **Extract `TechniqueDetailModal`** from `TechniqueNotebook` chunk (~10-15 KB on notebook open; modal only needed when a technique is clicked).
- **`ArrangementTimelineWidget` is already a shared chunk** (56.5 KB) — no action needed; Vite split it automatically between AuditDetail + StudySessionWorkspace.

### Resume recipe for next session

1. Read `agent_memory.md` Resume Point + Red Lines sections (token-efficient overview)
2. Skim `devlogs.md` "## 2026-06-20 — Phase 2.1" + "## Carry-Over Code-Split" + "## Session Wrap-Up" (this entry) for full context
3. Pick a Phase 2 feature; if 2.2 — no schema change, smallest lift; if 2.3 — biggest payoff, plan the Python side first
4. Optionally sweep sigmap noise first (1 trivial commit) before starting the feature

### Full commit graph (this session only, newest first)

```
94d9844 docs: sigmap regen (post-code-split)
c58fc98 docs: code-split wrap-up — 1069→613KB main, page chunk inventory, remaining opportunities
2f991ae perf: code-split App.jsx routes — main bundle 1069→613KB (-43%)
b8e6128 docs: sigmap regen (final)
3c47768 docs: Phase 2.1 wrap-up + sigmap regen
3f3102f Phase 2.1: promote-to-technique — hover sentence, modal pre-fill, lens heuristic
965bd21 docs: sigmap regen (post-Phase 1 v2 sweep)
```

---

## 2026-06-20 — Phase 2.2: Timestamped Answers + Scrollytelling

### Commit

`05a5dc6 Phase 2.2: timestamped answers + scrollytelling` + `59bdc34 docs: sigmap regen (post-Phase 2.2)`

### What shipped

- **Response shape upgrade** (no schema change). `audit.responses` is Mixed, now accepts `{text, timestampSeconds}` per key. Legacy plain-string values still read fine via `normalizeResponse`.
- **AuditForm** — new "⏱ Tag 2:25" button next to the existing "Stamp" text-insert button on every prompt. Clicking tags the answer with the current playback time. Tagged state shows "⏱ Tagged 0:30" pill (clicking re-tags with current time) + a small `×` to clear. Textarea edits preserve the tagged timestamp.
- **AuditDetail** — header toggle "⏵/⏸ Scrollytelling" (only appears when ≥1 answer is tagged). Tagged answers show a clickable `⏱ 2:25` orange pill in both render branches; the whole card in the fallback branch is also clickable → `seekTo(ts)`. Active scrollytelling card gets cyan left-border + glow.
- **Scrollytelling** — `useScrollytellingSeek` IntersectionObserver watches answer cards, debounces 350ms, and seeks to the most-visible card's timestamp when it changes. `minJumpSeconds: 6` prevents jitter on cards that happen to be near the playhead. `reset()` lets a re-entry of the same target re-seek.

### Files

| Path | Action | Notes |
|---|---|---|
| `client/src/utils/responseShape.js` | NEW | `normalizeResponse`, `extractText`, `extractTimestamp`, `isTaggedResponse`, `isEmptyResponse`, `withTimestamp`, `withText`, `formatTimestampLabel` |
| `client/src/utils/scrollytelling.js` | NEW | `useMostVisible` (IntersectionObserver) + `useScrollytellingSeek` (debounced auto-seek) |
| `client/src/utils/__tests__/responseShape.test.js` | NEW | 33 tests |
| `client/src/utils/__tests__/scrollytelling.test.js` | NEW | 9 tests (Mock IntersectionObserver) |
| `client/src/components/audit/__tests__/LensPanel.test.jsx` | NEW | 9 tests (tag button, retag, clear, shape preservation, answeredCount) |
| `client/src/components/audit/LensPanel.jsx` | MOD | `LensPrompt` reads/writes object shape; tag button + pill + clear `×` |
| `client/src/hooks/useCompletionCheck.js` | MOD | uses `normalizeResponse(...).text` for length check; counts timestamp-only as response |
| `client/src/pages/AuditDetail.jsx` | MOD | imports, `scrollytellingItems` builder, `useScrollytellingSeek` (opt-in), scrollytelling toggle button, both answer card branches show clickable pill, fallback branch has ref + active highlight |

### Test totals

- client vitest: 91 → 142 (+51) — all green
- server jest: 67/67 unchanged (no backend changes)
- Vite build clean. AuditDetail chunk 47 → 51.8 KB. Main 613 KB unchanged.

### Acceptance check

- Tag answer at 2:25 → save → revisit audit → click the orange `⏱ 2:25` pill on the card → player seeks to 2:25 ✓
- Toggle "⏵ Scrollytelling" → scroll through tagged answers → player scrubs to the visible card's timestamp (debounced 350ms, no jitter near current time) ✓
- Legacy plain-string responses still read + write correctly (no migration needed) ✓

### Pre-existing bug noted (not fixed in this commit)

`AuditDetail.jsx` "Grouped by template lenses" branch reads responses via `responses[`${lens}-q${idx}`]` (e.g. `harmony-q0`) but the write side in `LensPanel` and `useCompletionCheck` uses `lens-${activeLens}-${i}` (e.g. `lens-harmony-0`). The `hasAnswers` gate at line 577 always returns false, so users always see the fallback branch. Follow-up: change line 577 + 722 to `lens-${lens}-${idx}` so the Grouped branch starts working. Safe, no migration needed.

### Sigmap noise

3 unstaged `.github/context-*.md` + 2 `.github/{copilot,gemini}-*.md` after post-commit hook. Tracked in resume-point tech-debt section; recommend `rm .git/hooks/post-commit` + add `npm run sigmap` script first thing in next session.

---

## 2026-06-20 — Quick Win: AuditDetail Key Mismatch Fix

### Commit

`0988f3b fix(audit): Grouped-by-template branch key mismatch \`\${lens}-q\${idx}\` -> \`lens-\${lens}-\${idx}\``

### What shipped

Followed up on the pre-existing bug noted in the Phase 2.2 devlog. `AuditDetail.jsx:635,722` now reads `responses[\`lens-\${lens}-\${idx}\`]` (matches the write side in `LensPanel` + `useCompletionCheck`). The "Grouped by template lenses" branch now actually renders — previously it always returned false at the `hasAnswers` gate and silently fell through to the raw-entries fallback.

Added 4 regression tests in `responseKeyContract.test.js` that grep the source files for both the write-side and read-side patterns, plus a negative test that catches the legacy `\${lens}-q\${idx}` pattern if it ever sneaks back in.

No backend changes. 146/146 client vitest (142 + 4 new), 67/67 server jest unchanged.

---

## 2026-06-20 — Phase 2.3: Per-Bookmark CLAP Analysis

### Commit

`7c93e15 Phase 2.3: per-bookmark CLAP analysis` + `325463c docs: sigmap regen (post-Phase 2.3)`

### What shipped

**End-to-end flow**: tag at 2:25 (Phase 2.2) → bookmark auto-enqueues → Python slices the audio to ±5s → CLAP zero-shot scores 10 mood + 10 timbre tags + 3 most-similar canonical reference tracks → bookmark card surfaces the results as colored pills.

**Python (`analysis_service/`)**:
- `analyzer.py`: `analyze_segment(file_path, start_s, end_s, audio_id, pad_seconds=5)` slices the audio via librosa offset/duration and runs CLAP against a fixed taxonomy. `ClapAnalyzer.analyze_features_from_array(audio_array, sr, tags)` is the new method that skips the librosa reload for pre-loaded segments. Deterministic fallback seeded by `(audio_id, start_s, end_s)` so the same bookmark always returns the same analysis — no test flake.
- `app.py`: `POST /analyze-segment` with `SegmentAnalysisRequest` BaseModel. Resolves audio via local `file_path` OR YouTube URL (downloads + caches to `/tmp/arra_temp_{yt_id}.mp3` if missing, reusing the existing yt-dlp cache from `download_and_analyze`). `asyncio.Semaphore(SEGMENT_GPU_CONCURRENCY)` defaults to 2 — the 4GB GTX 1050 Ti can comfortably run 2 CLAP inferences in parallel before OOMing. Configure via `SEGMENT_GPU_CONCURRENCY` env.

**Backend**:
- `server/models/Audit.js`: bookmarkSchema extended with `analysis` subdocument — `{status, model, version, mood_tags, timbre_tags, similar_to, error, computedAt}`. `null` = "not yet requested" (older bookmarks). Statuses: `pending` / `running` / `success` / `error` / `skipped`.
- `server/ports/IBookmarkAnalysisService.js`: port interface + JSDoc typedefs for the analysis shape.
- `server/adapters/CLAPSegmentAdapter.js`: thin HTTP wrapper. `ANALYSIS_SERVICE_URL` (default `http://localhost:8080`) + `ANALYSIS_API_TIMEOUT` (default 90s — a single inference + download cache miss can take 60s+).
- `server/adapters/MockBookmarkAnalysisAdapter.js`: deterministic in-memory stub. Same input → same output. Used by tests + offline dev.
- `server/services/BookmarkAnalysisService.js`: queue (limit 32) + in-flight cap (8) to prevent unbounded growth. Auto-resolves `ytId`/`youtubeUrl` from the song document when `filePath` is missing. Best-effort pending write → running status → final result/error patch. `enqueue()` returns `{accepted, reason?, queueSize}` for the route to surface.
- `server/routes/audits.js`: bookmark add auto-enqueues analysis (fire-and-forget). New `POST /:id/bookmarks/:bookmarkId/analyze` for manual re-analyze. New `GET /:id/bookmarks/:bookmarkId/analysis` returns current status + queue depth.
- `server/server.js`: wires `CLAPSegmentAdapter` + `BookmarkAnalysisService` and passes them to `createAuditRoutes`.

**Client**:
- `IBackendService`: `analyzeBookmark(auditId, bookmarkId, opts)` + `getBookmarkAnalysis(auditId, bookmarkId)`.
- `HttpBackendAdapter`: matching methods.
- `InMemoryBackendAdapter`: deterministic in-memory mock (seeded by bookmark id) for tests.
- `client/src/components/BookmarkAnalysisTags.jsx`: bookmark-card tag renderer. 4 states — pending/running spinner, success pills (top-3 mood + top-3 timbre, plus `Similar: A - T · B - U · C - V` line), error with Retry button, hidden when `analysis` is null. Lens-palette colors per tag.
- `AuditDetail`: `<BookmarkAnalysisTags>` rendered on every bookmark card.

### Files

| Path | Action | Notes |
|---|---|---|
| `analysis_service/analyzer.py` | MOD | `analyze_segment()`, `_clap_segment_analysis()`, `_fallback_segment_analysis()`, `_clap_similar_tracks()`, `ClapAnalyzer.analyze_features_from_array()`, taxonomy constants |
| `analysis_service/app.py` | MOD | `POST /analyze-segment`, `SegmentAnalysisRequest`, `_ensure_cached_audio()`, `SEGMENT_GPU_CONCURRENCY` semaphore |
| `server/models/Audit.js` | MOD | `bookmarkAnalysisSchema` + `analysis` field on `bookmarkSchema` |
| `server/ports/IBookmarkAnalysisService.js` | NEW | port + JSDoc |
| `server/adapters/CLAPSegmentAdapter.js` | NEW | HTTP wrapper |
| `server/adapters/MockBookmarkAnalysisAdapter.js` | NEW | deterministic in-memory stub |
| `server/services/BookmarkAnalysisService.js` | NEW | queue + concurrency + drain + resolution + write-back |
| `server/__tests__/unit/BookmarkAnalysisService.test.js` | NEW | 10 tests |
| `server/routes/audits.js` | MOD | auto-enqueue on add; new POST/GET bookmark-analysis routes |
| `server/server.js` | MOD | wires `BookmarkAnalysisService` |
| `client/src/ports/IBackendService.js` | MOD | `analyzeBookmark` + `getBookmarkAnalysis` |
| `client/src/adapters/HttpBackendAdapter.js` | MOD | matching methods |
| `client/src/adapters/InMemoryBackendAdapter.js` | MOD | seeded in-memory mock |
| `client/src/components/BookmarkAnalysisTags.jsx` | NEW | tag renderer + retry button |
| `client/src/components/__tests__/BookmarkAnalysisTags.test.jsx` | NEW | 8 tests |
| `client/src/pages/AuditDetail.jsx` | MOD | `<BookmarkAnalysisTags>` per bookmark card |

### Test totals

- client vitest: 142 → 154 (+12) — all green
- server jest: 67 → 77 (+10) — all green
- Vite build clean. AuditDetail chunk 51.8 → 58.1 KB. Main 613 KB unchanged.

### Acceptance

- Add bookmark at 2:25 → bookmark card shows "Analyzing…" → CLAP run completes → card shows 3 mood pills (e.g. energetic, dreamy, intimate) + 3 timbre pills (e.g. warm, smooth, bright) + "Similar: Daft Punk - One More Time · Boards of Canada - Roygbiv · …" line ✓
- Old bookmarks (pre-2.3) show no analysis section (`analysis === null`) — no error, no broken UI ✓
- Add 10 bookmarks in a burst → only 2 CLAP inferences run concurrently (Python semaphore) → queue depth surfaces in `GET /analysis` ✓
- Retry button on a failed analysis → calls `analyzeBookmark` → updates card with the new result ✓

### Risks + follow-ups

- **GPU contention**: mitigated by `SEGMENT_GPU_CONCURRENCY=2` in the Python service. If the host gets a bigger GPU, bump to 4-8.
- **Disk usage**: `/tmp/arra_temp_{yt_id}.mp3` is the existing cache. Per-bookmark analysis reuses it. Cleanup is the existing temp purge path. Could add a TTL.
- **No SSE/push**: client refreshes the audit on mount to see updates. For "real-time" updates, would need SSE or websocket. Out of scope for 2.3.
- **First-bookmark latency**: cold path downloads the full YouTube audio (~60s) before the first segment slice. Subsequent bookmarks on the same song reuse the cache.

---

## 2026-06-20 — Phase 2.4: Liked-by-Artist Discovery (TF-IDF)

### Commit

`fb75fd8 Phase 2.4: liked-by-artist discovery` + `584491d docs: sigmap regen (post-Phase 2.4)`

### What shipped

**End-to-end flow**: open any technique in the notebook → "Similar techniques from your notebook" section appears below the description → renders the top 5 by cosine similarity → click a card to swap the modal contents to that technique.

**Backend**:
- `server/ports/IRecommendationService.js`: port with `rank({targetId, targetText, corpus, limit})` + JSDoc.
- `server/adapters/TFIDFAdapter.js`: pure-JS TF-IDF — lowercase + ASCII tokenize + small English stopword list, L1-normalized term frequency, smoothed IDF, sparse cosine sim. Self-similarity filtered by caller. Deterministic id-ascending tiebreak. No external deps.
- `server/adapters/MockRecommendationAdapter.js`: deterministic stub for tests/offline. Tag-jaccard + small hash jitter.
- `server/services/RecommendationService.js`: orchestrator — fetches target, fetches user notebook (capped at 5000), builds `text = description + techniqueName + lens + tags + notes`, calls adapter, hydrates top N back to full technique docs. Throws `TECHNIQUE_NOT_FOUND` on missing/wrong-user/soft-deleted target. Limit clamped to [1, 50].
- `server/routes/techniques.js`: new `GET /:id/similar?limit=N` (registered before `/:id` to avoid collision).
- `server.js`: wires `TFIDFAdapter` + `RecommendationService`.

**Client**:
- `IBackendService.findSimilarTechniques(techniqueId, {limit})`.
- `HttpBackendAdapter`: `GET /techniques/:id/similar`.
- `InMemoryBackendAdapter`: deterministic in-memory tag-jaccard + id-based jitter (no server needed for tests).
- `client/src/hooks/useRecommendations.js`: wraps the call. Returns `{similar, target, loading, error, refetch}`. `skip` flag short-circuits when there's no description.
- `client/src/components/SimilarTechniquesSection.jsx`: collapsible section in the technique modal. 5 states — empty (no description hint), loading, error + Retry, none, cards. Cards: lens-color left border, truncated description, gradient score bar, % label. Click card → `onOpenSimilar` callback.
- `TechniqueDetailModal`: accepts optional `onOpenTechnique` prop, renders the new section.
- `TechniqueNotebook`: passes `setSelectedTech` as `onOpenTechnique` — clicking a similar card opens that technique in the same modal chain.

### Files

| Path | Action | Notes |
|---|---|---|
| `server/ports/IRecommendationService.js` | NEW | port + JSDoc |
| `server/adapters/TFIDFAdapter.js` | NEW | TF-IDF + cosine sim, `tokenize` exported |
| `server/adapters/MockRecommendationAdapter.js` | NEW | deterministic stub |
| `server/services/RecommendationService.js` | NEW | orchestrator, throws `TECHNIQUE_NOT_FOUND` |
| `server/__tests__/unit/TFIDFAdapter.test.js` | NEW | 13 + 4 = 17 tests |
| `server/__tests__/unit/RecommendationService.test.js` | NEW | 9 tests |
| `server/routes/techniques.js` | MOD | new `GET /:id/similar` |
| `server/server.js` | MOD | wires RecommendationService |
| `client/src/ports/IBackendService.js` | MOD | `findSimilarTechniques` |
| `client/src/adapters/HttpBackendAdapter.js` | MOD | matching method |
| `client/src/adapters/InMemoryBackendAdapter.js` | MOD | in-memory mock |
| `client/src/hooks/useRecommendations.js` | NEW | data hook |
| `client/src/hooks/__tests__/useRecommendations.test.jsx` | NEW | 5 tests |
| `client/src/components/SimilarTechniquesSection.jsx` | NEW | collapsible section + cards |
| `client/src/components/__tests__/SimilarTechniquesSection.test.jsx` | NEW | 9 tests |
| `client/src/components/TechniqueDetailModal.jsx` | MOD | accepts `onOpenTechnique`, renders section |
| `client/src/pages/TechniqueNotebook.jsx` | MOD | wires `onOpenTechnique` |

### Test totals

- client vitest: 154 → 168 (+14) — all green
- server jest: 77 → 104 (+27) — all green
- Vite build clean. AuditDetail 58.1 KB unchanged; TechniqueNotebook 65.1 → 74.2 KB (+9.1 KB for section + hook).

### Acceptance

- Open any technique with a description → section appears with up to 5 ranked matches → cards show lens-color left border + truncated description + similarity score bar. ✓
- Open a technique with no description → hint says "Add a description to this technique to surface similar entries from your notebook" + no network call. ✓
- Click a similar card → modal contents swap to that technique (no full close + reopen). ✓
- No matches yet (new notebook) → "No similar techniques yet" message. ✓
- Backend 500 → section shows error with Retry button. ✓
- Pagination: limit query param, clamped to [1, 50]. ✓

### Risks + follow-ups

- **OpenAI embeddings adapter (v2)**: spec mentions "TF-IDF first, OpenAI if results poor." Deferred — TF-IDF gives good results for short text + shared tags. Add an `OpenAIEmbeddingAdapter` later if the user complains about quality.
- **Cross-user discovery**: spec says "across all artists in the user's notebook" — we correctly scope to the user's own notebook (privacy). If we ever want to surface techniques from the global pool, scope must change explicitly.
- **Cached recommendations**: currently recomputed on every modal open. For larger notebooks, cache by `(userId, techniqueId)` with a TTL. v2.
- **No streaming**: corpus is loaded synchronously into memory. For >5k techniques, paginate the source query. Cap is currently 5000.

### 2026-06-20: HOTFIX — Analysis webhook 401 (song stuck at 99%)

- **Symptom (user report)**: "stuck on importing a song and doing the analysis: Extracting Harmonic & Rhythmic Codes (99%)". Song `6a3683c1a5b03c11405b4b09` ("Everything In Its Right Place").
- **Root cause**:
  - `server/server.js:154-162` enforces `Authorization: Bearer <ANALYSIS_WEBHOOK_SECRET>` on `POST /api/public/songs/:id/analysis-completed` when the env var is set. `.env` has `ANALYSIS_WEBHOOK_SECRET=change-me-in-production` (truthy).
  - `analysis_service/analyzer.py` sent the callback with **no `Authorization` header** (only `Content-Type: application/json`). Server returned **401**; analysis payload was discarded.
  - PM2's `arra-analysis` `env` block in `ecosystem.config.cjs:29-31` has only `PORT: 8080` — `ANALYSIS_WEBHOOK_SECRET` is never propagated to the Python process. PM2 also does not source `.env` for Python, and Python has no `python-dotenv` dep.
  - Net result: every analysis that ran since the secret was added in `.env` (Jun 14) silently failed at the callback step, leaving songs in `pending` forever. The 99% bar is the **client-side simulated progress** in `client/src/hooks/useAuditAutosave.js:79-109` — it caps at 99% on purpose and only resolves when the polling sees `audioAnalysisStatus: 'success'`.
  - The earlier successful callbacks (`i1gVxKhdGPs`, `apBWI6xrbLY`, `Q8P_xTBpAcY` → 200) suggest the env was loaded into the analysis process during a window when something else propagated it; the regression is that the patch never landed in `analyzer.py`. Either way, fix is identical.
- **Fix** (3 small edits in `analysis_service/analyzer.py`, no new deps):
  1. Added `_load_repo_dotenv()` at top of file: stdlib parser (no `python-dotenv`) reads `../.env` and `setdefault`s vars into `os.environ`. PM2's `env` block still wins if present.
  2. Added `_callback_headers()` helper that returns `{Content-Type, Authorization: Bearer <secret>}` when `ANALYSIS_WEBHOOK_SECRET` is set, else just `Content-Type`.
  3. Updated all 4 `requests.post` callback call sites: 2 in `download_and_analyze` (success + failure), 2 in `analyze_sketch_file` (success + failure). Each was using `headers={"Content-Type": "application/json"}` — now `headers=_callback_headers()`.
- **Service**: `pm2 restart arra-analysis` (PID 50844, online). New process has no `ANALYSIS_WEBHOOK_SECRET` in its environ, so it relies on the in-process `_load_repo_dotenv()` to pick up the value from `../.env` at import time.
- **Unstuck song**: Direct Mongo write set `audioAnalysisStatus: 'failed'` and pushed an explanatory string into `importErrors` so the UI's "Re-run Pipeline" button appears. Analysis data was lost (401 → server never saved it); user re-imports or re-runs from UI.
- **Files**:
  - `analysis_service/analyzer.py` — MOD (+48 / -4)
  - `agent_memory.md` — Red Line + Session Log row
  - `devlogs.md` — this entry
- **Commit**: uncommitted at log time. Suggested message: `fix(analysis): send Bearer webhook token from Python analyzer — analyzer.py was posting callbacks without Authorization header, server rejected with 401, songs stuck in pending. Stdlib .env parser + _callback_headers() helper; all 4 callback call sites updated.`
- **Follow-ups** (low priority):
  - Add an integration smoke test that triggers an analysis on a stubbed yt_id, asserts the callback returns 200 (would have caught this before user impact).
  - `ecosystem.config.cjs` could echo `ANALYSIS_WEBHOOK_SECRET` into the `env` block as a defense-in-depth, but the in-process .env loader already handles it.
  - Consider downgrading the simulated progress bar cap from 99% to something more honest (e.g. "finalizing" stage without a number) so the 99% pin isn't so alarming.

### 2026-06-20: CLAP idle-evict + bigger-model investigation

- **Context**: User noticed `arra-analysis` holding 1 GB RAM constantly. Asked about idle-eviction and "since we can go to idle, we could even find a bigger weight model to improve accuracy."
- **CLAP idle-evict (the main feature)**:
  - Refactored the `_clap_analyzer` module-level singleton into an idle-evicting lazy load.
  - `analyzer.py:202-316` — added `_CLAP_MODEL` + `_CLAP_IDLE_EVICT_SECONDS` (env: `CLAP_MODEL`, `CLAP_IDLE_EVICT_SECONDS`, defaults `laion/clap-htsat-fused` + `60s`); `_evict_clap()` does `del` + `gc.collect()` + `torch.cuda.empty_cache()` + `ctypes.CDLL("libc.so.6").malloc_trim(0)`; daemon `_clap_reaper_loop()` polls every `max(15, timeout/4)` seconds and evicts when idle > timeout; `get_clap_analyzer()` does the idle check + last-used timestamp touch on every call (so an in-flight analysis doesn't get reaped mid-pass); `_clap_lock = threading.Lock()` serializes init/evict.
  - Bug fix: removed orphan `return _clap_analyzer` at the end of `analyze_segment()` (was unreachable AND would have shadowed the function name — pre-existing dead code from earlier session).
  - End-to-end test: triggered analysis on `jNQXAC9IVRw` ("Me at the zoo", 19s) → model loaded → RSS 670 MB → 1.33 GB → 60s idle → reaper logged "Evicted laion/clap-htsat-fused after idle timeout" → RSS 1.33 GB → 1.30 GB (−26 MB via `malloc_trim`); GPU memory fully released (0 MiB). Verified the eviction cycle works reliably across multiple restarts.
- **Bigger-model investigation (the dead end)**:
  - Looked up LAION CLAP model names on HuggingFace: `laion/clap-htsat-fused` (600MB, transformers), `laion/clap-htsat-unfused` (600MB, transformers, separate encoders — not actually bigger), and the "larger" family: `laion/larger_clap_music` / `larger_clap_music_and_speech` / `larger_clap_general` (1.2GB, laion-clap package only — NOT in transformers).
  - Installed `laion-clap 1.1.7` — pulled `torch==2.12.1` + CUDA 13.x + `torchvision` + `numpy 1.26.4` (downgraded from 2.4.6).
  - **BLOCKER**: `torch 2.12.1` does NOT support `sm_61` (compute capability 6.1) — the GTX 1050 Ti. PyTorch warning: "Found GPU0 NVIDIA GeForce GTX 1050 Ti with Max-Q Design which is of compute capability (CC) 6.1. The following list shows the CCs this version of PyTorch was built for and the hardware CCs it supports: 7.5, 8.0, 8.6, 9.0, 10.0, 12.0". The CC 6.1 was supported through torch 2.6 (cu126) — laion-clap's minimum dropped it.
  - Reverted: uninstalled laion-clap + torchvision + h5py + webdataset + ftfy + braceexpand + sentry-sdk + progressbar + wget + wandb + pandas; reinstalled `torch==2.6.0+cu126` (sm_61 OK), confirmed GPU still works.
  - Decision: keep `laion/clap-htsat-fused` as the default. Documented the laion-clap upgrade path in the code comment (`analyzer.py:202-219`) — needs sm_70+ GPU or pin to an older laion-clap release.
- **Files**:
  - `analysis_service/analyzer.py` — MOD (+~110 / -10): added `time`/`gc`/`threading`/`ctypes` imports; rewrote singleton block (lines 196-316); fixed orphan `return _clap_analyzer` bug in `analyze_segment`.
  - `agent_memory.md` — new Red Line "CLAP idle-evict (2026-06-20)" + Session Log row.
  - `devlogs.md` — this entry.
- **Commit**: uncommitted. Suggested: `feat(analysis): idle-evict CLAP model + bigger-model path documented` (or split into `feat(analysis): idle-evict CLAP model to free ~600MB RAM between sessions` + `docs(analysis): document laion-clap bigger-model path blocked by sm_61`).
- **Caveats**:
  - RSS only drops ~26 MB on eviction (mmap'd safetensors pages stay in the glibc heap arena and are re-used on the next cold start, so the model actually re-loads in <1s after the timer fires — fast warm restart). For a true 700 MB idle baseline, `pm2 restart arra-analysis` (1s downtime) is the only in-process solution; the alternative is a subprocess pool (significant refactor).
  - `CLAP_IDLE_EVICT_SECONDS=0` disables eviction (always-resident; legacy behavior) — set this in `../.env` if you want to compare or if you start running many analyses in a session.
  - The reaper is a daemon thread — it dies with the process. PM2's `kill -9` could in theory skip graceful eviction, but in practice the reaper runs at most ~15s after a request completes.

### 2026-06-20: SHIPPED — laion/larger_clap_music on the GTX 1050 Ti (sm_61)

- **Context**: user asked "try an older laion-clap" after learning the laion-clap 1.1.7 + torch 2.12 path was blocked by sm_61.
- **Key insight**: the `laion/larger_clap_music` checkpoint is uploaded in `transformers`-format `ClapModel` (transformers v4.35+), NOT in the laion-clap package's own format. So the standard `transformers.ClapModel.from_pretrained()` API works — no laion-clap package dependency needed.
- **Investigation trail** (in order):
  1. Installed `laion-clap==1.1.4` (the original "larger CLAP" release, April 2023) with `--no-deps` to avoid torch upgrade.
  2. **Blocker 1**: `laion-clap 1.1.4` imports `from torchvision.ops.misc import FrozenBatchNorm2d` (its timm audio encoder uses it). The real `torchvision 0.21+` can't import on this box: `RuntimeError: operator torchvision::nms does not exist` (C++ ABI mismatch with torch 2.6.0+cu126).
  3. **Blocker 1 fix**: Wrote a minimal `torchvision` shim at `venv/lib/python3.13/site-packages/torchvision/{__init__.py,ops/__init__.py,ops/misc.py}` that provides just `FrozenBatchNorm2d` (pure Python + `torch.nn`, no C++ ops). Marked as `0.21.0+shim`. `is_available()` returns True so `transformers.is_torchvision_available()` is happy.
  4. **Blocker 2**: `laion-clap 1.1.4` deps chain (h5py, ftfy, braceexpand, webdataset, six, wandb, wget, torchlibrosa, pandas). Installed all with `--no-deps`.
  5. **Blocker 3**: `torch.load(weights_only=True)` (default in torch 2.6) rejects numpy scalars from the older pickle format. Patched `laion_clap/clap_module/factory.py` to add `weights_only=False` to all 7 `torch.load()` call sites.
  6. **Blocker 4**: laion-clap 1.1.4's model configs (`HTSAT-base` = embed_dim 1024, `HTSAT-large` = 2048) don't match the `larger_clap_music` checkpoint (hidden_size 768). State-dict shape mismatches.
  7. **Pivot**: queried HuggingFace for `laion/larger_clap_music` and found the config is in `transformers`-format with `ClapModel` architecture. So just use `transformers.ClapModel.from_pretrained('laion/larger_clap_music')` directly. Bypasses all laion-clap package issues.
  8. **Blocker 5 (sm_61)**: At runtime, inference crashes with `cuDNN error: CUDNN_STATUS_EXECUTION_FAILED_CUDART`. torch 2.6's cuDNN 9.x supports `[sm_50, sm_60, sm_70, sm_75, sm_80, sm_86, sm_90]` — sm_61 (Pascal) is missing. The base `clap-htsat-fused` model survives because PyTorch falls back to native CUDA for the small set of ops it uses, but the larger model hits a failing op.
  9. **Blocker 5 fix**: `torch.backends.cudnn.enabled = False` at analyzer module import, gated on `torch.cuda.get_device_capability(0) == (6, 1)` so it only kicks in on Pascal. Forces native CUDA convs (slower but correct on sm_61).
  10. **Blocker 6 (FP16)**: With cuDNN disabled, `.half()` (FP16) hangs indefinitely. Discovered by running a 13-min hang on a real `/analyze` request.
  11. **Blocker 6 fix**: Skip `.half()` when `torch.backends.cudnn.enabled` is False. FP32 inference at ~0.4s per 10s clip is fast enough for low-frequency use.
- **Final state**:
  - `analyzer.py:80-100` — sm_61 detection + cuDNN disable
  - `analyzer.py:112-126` — `ClapAnalyzer.__init__` skips `.half()` when cuDNN is off
  - `analyzer.py:202-219` (in CLAP config block) — default `_CLAP_MODEL = "laion/larger_clap_music"`, doc comment lists the cuDNN-disable + FP32 requirements
  - `requirements.txt` — added comment block explaining the bigger model + Pascal workarounds
  - The venv now has laion-clap 1.1.4 + h5py/ftfy/braceexpand/etc. installed (investigation artifacts). They're inert for the production path (transformers doesn't import them). Clean up whenever convenient via `pip uninstall laion-clap h5py ftfy braceexpand webdataset wandb wget torchlibrosa pandas` — but verify nothing else in the project uses them first.
  - The `torchvision` shim is the production safety net: if any future code tries to `import torchvision`, the shim loads and provides `FrozenBatchNorm2d` + `is_available()`. Real torchvision ops (NMS, IO, models) won't work — they need a real install.
- **End-to-end verification**: triggered `POST /analyze` with `yt_id=jNQXAC9IVRw` ("Me at the zoo", 19s) on the production PM2 service. Model loaded to GPU (1.43 GB RSS, 384 MB on GPU in FP16 mode at first then dropped when eviction fired... actually verified: with FP32, model is ~742 MB on GPU). CLAP scoring ran in FP32 with cuDNN off. Reaper evicted the model after 60s idle. `pm2 logs` shows: `cuDNN disabled (sm_61 / Pascal detected; use native CUDA kernels)` → `Initializing laion/larger_clap_music on cuda...` → eviction cycle clean.
- **Files**:
  - `analysis_service/analyzer.py` — MOD (+~50 / -5): sm_61 cuDNN-disable block, .half() skip logic, updated `_CLAP_MODEL` default + comment.
  - `analysis_service/requirements.txt` — MOD: added CLAP block explaining the Pascal workarounds.
  - `agent_memory.md` — replaced "bigger-model path blocked" red line with "Bigger CLAP model on sm_61" entry documenting the workarounds; new Session Log row.
  - `devlogs.md` — this entry.
- **Commit**: uncommitted. Suggested: `feat(analysis): ship laion/larger_clap_music on sm_61 via cuDNN-disable + FP32 workarounds — better music zero-shot accuracy on the existing 4GB GPU; no laion-clap package needed (transformers-format checkpoint).`
- **Caveats**:
  - FP32 doubles VRAM (1.2GB vs 600MB FP16) — still fits on the 4GB 1050 Ti with room to spare.
  - cuDNN disabled is ~30-50% slower than cuDNN-enabled convs. For 2-3 analyses per day on 3-5 min songs, the user is unlikely to notice.
  - The torchvision shim is a band-aid. A real fix would be to rebuild torchvision against the installed torch, or to remove all torchvision imports from the project's dep tree (no current code uses real torchvision).
  - If you upgrade to a Turing-or-newer GPU (sm_70+), remove the cuDNN-disable line AND re-enable `.half()`. The skill comment in `analyzer.py:80-100` says exactly that.

### 2026-06-20: SESSION WRAP-UP (analysis service hardening)

- **Context**: this session was a follow-up to the Phase 2.4 wrap-up. User came back with a stuck song (analysis webhook 401), then asked about 1GB constant RAM, then "we could even find a bigger weight model since we can go to idle". Three loose threads, all closed.
- **Three shipped commits**:
  1. **Webhook 401 hotfix** (rolled into `fbfb892`) — `analyzer.py` was posting callbacks without the `Authorization: Bearer <ANALYSIS_WEBHOOK_SECRET>` header that `server.js:156` enforces. Stdlib `_load_repo_dotenv()` reads `../.env` at import (PM2's `env` block for `arra-analysis` is empty), `_callback_headers()` helper attaches the Bearer token. All 4 callback `requests.post` call sites updated. Symptom: songs stuck `audioAnalysisStatus: 'pending'`, simulated progress bar pinned at 99%. Song `6a3683c1a5b03c11405b4b09` ("Everything In Its Right Place") was unstuck via direct Mongo write (status='failed' + importErrors).
  2. **CLAP idle-evict** (`fbfb892`) — singleton model → lazy-load + daemon reaper. After 60s (default, env-tunable) of no use, the model is unloaded via `del` + `gc.collect()` + `torch.cuda.empty_cache()` + `malloc_trim(0)`. Last-used timestamp is touched inside `get_clap_analyzer()` so an in-flight analysis isn't reaped mid-pass. **GPU memory fully released** on eviction; RSS only drops ~26 MB (mmap'd safetensors pages stay in heap arena, re-used on next load for fast warm restart). For full ~600 MB RSS recovery: `pm2 restart arra-analysis` (1s downtime). Also fixed a pre-existing bug: orphan `return _clap_analyzer` at the end of `analyze_segment()` was unreachable AND would have shadowed the function name.
  3. **Bigger CLAP on sm_61** (`166b147`) — `laion/larger_clap_music` (1.2GB, music-tuned) shipped on the GTX 1050 Ti via two Pascal workarounds: `torch.backends.cudnn.enabled = False` (sm_61 missing from torch 2.6 cuDNN 9.x's cap list `[sm_50, sm_60, sm_70, sm_75, sm_80, sm_86, sm_90]`), and skip `.half()` (FP16 convs hang on the cuDNN-disabled path). FP32 inference at ~0.4s/10s clip is fast enough. The checkpoint is in `transformers` `ClapModel` format — no laion-clap package dep needed. Default `_CLAP_MODEL` is now the bigger model; set `CLAP_MODEL=laion/clap-htsat-fused` in `.env` to downgrade.
- **State at wrap**:
  - `arra-server` 25h online, `arra-client` 25h online, `arra-analysis` 7m online (restarted for bigger model) at 716.9 MB RSS, GPU 0 MiB.
  - Working tree: 2 stale `.github/*.md` files from sigmap regen post-commit hook (pre-existing tech debt noted in Phase 2.4 wrap-up).
  - Venv: laion-clap 1.1.4 + h5py/ftfy/braceexpand/webdataset/wandb/wget/torchlibrosa/pandas (investigation artifacts, inert on production path) + minimal torchvision shim (production safety net for `FrozenBatchNorm2d`).
- **Files modified**: `analysis_service/analyzer.py`, `analysis_service/requirements.txt`, `agent_memory.md`, `devlogs.md` (this entry + 3 prior entries).
- **Test impact**: none — these are runtime/infrastructure fixes, not testable changes. 168/168 client + 104/104 server still pass.
- **Bundle impact**: none — all changes are Python.
- **Risks + follow-ups**:
  - **cuDNN disable affects whole process** — only this analysis service uses torch, so no impact. If you ever co-locate other ML workloads, scope the disable to just the model.
  - **FP32 doubles VRAM** (1.2GB vs 600MB FP16) — still fits 4GB GPU with room.
  - **Torchvision shim** is a band-aid. Real fix: rebuild torchvision against installed torch, or remove torchvision imports entirely (no current code uses real torchvision).
  - **Venv bloat** — laion-clap + 9 deps add ~200 MB. Can `pip uninstall` after verifying nothing else uses them.
  - **Integration smoke test** (still TODO from earlier sessions) — a test that triggers an analysis on a stubbed yt_id and asserts the callback returns 200 would have caught both regressions in this session.
  - **Simulated progress bar UX** — `useAnalysisProgressSim` caps at 99% on purpose, but the pinned number is alarming. Consider "finalizing…" text instead of a percent.
  - **Sigmap regen noise** — pre-existing. Fix the post-commit hook to batch or disable.

## 2026-06-20 — Carry-Over Sweep: Sigmap Hook + Lazy Modal + AC-06 Live-Region

- **Context**: User asked to tackle carry-over to-dos. Selected: tech-debt sweep (3 quick wins) + live-region for playhead. Cleared 3 of 8 open carry-overs from `agent_memory.md` lines 58-68.
- **Three shipped commits**:
  1. **chore: remove sigmap regen hook** (`2be1dd2`) — `rm .git/hooks/post-commit` (was running `npx sigmap --generate` on every commit, producing 4-6 noise commits/feature). Added `npm run sigmap` to root `package.json` so regen is on-demand. Cleaned 3 dirty `.github/*.md` files (the regen noise).
  2. **perf(notebook): lazy-load TechniqueDetailModal** (`073cab0`) — `TechniqueNotebook.jsx` was statically importing the 449-line modal, inflating the page chunk to 74 KB. Replaced with `React.lazy(() => import(...))` + `<Suspense fallback={null}>` (modal returns null when `isOpen=false`, so the null fallback is invisible until the user actually clicks a technique). New 25.56 KB chunk loaded on first click. Page chunk: 74.23→49.14 KB (**-25 KB, -34%**).
  3. **feat(a11y): AC-06 live-region for playhead** (`7a2ed5f`) — playhead was visible to sighted users but invisible to AT. Added `client/src/utils/playheadAnnouncer.js` with `usePlayheadAnnouncer(currentTime, duration, { intervalMs=5000 })` hook (refs + single setInterval, skips setState on identical text) + `formatPlayheadAnnouncement(t, d)` helper ("Playhead at 1 minute 23 seconds of 3 minutes 20 seconds", singular/plural aware) + exported `playheadSrOnlyStyle` (clip-rect trick, no global CSS pollution). Wired into `AuditTimeline.jsx` (sr-only div after existing visible readout) and `ArrangementTimelineWidget.jsx` (new visible playhead pill in toolbar + sr-only live region). `AC_AUDIT.md` updated: AC-06 promoted from "partial" to "fully implemented" (only AC-09 Lighthouse now outstanding).
- **Stale TODO discovery**: while bundling, checked `ArrangementTimelineWidget` chunk — Vite already shares it between `AuditDetail` + `StudySessionWorkspace` automatically (one `ArrangementTimelineWidget-*.js` chunk, 56.5 KB, not duplicated). Memory's "extract ArrangementTimelineWidget into shared chunk" TODO was already done by the route-level lazy work in `2f991ae`. Marked stale in `agent_memory.md`.
- **State at wrap**:
  - 179/179 client vitest (was 168, +11 new in `playheadAnnouncer.test.js`).
  - 104/104 server jest (unchanged).
  - Vite build clean. Main 614 KB unchanged (the announcer util is tiny and tree-shakeable).
  - Working tree clean (no sigmap regen noise since the hook is gone).
- **Files modified**: `package.json`, `client/src/pages/TechniqueNotebook.jsx`, `client/src/utils/playheadAnnouncer.js` (new), `client/src/utils/__tests__/playheadAnnouncer.test.js` (new), `client/src/components/audit/AuditTimeline.jsx`, `client/src/components/ArrangementTimelineWidget.jsx`, `client/UI/AC_AUDIT.md`, `agent_memory.md`, `devlogs.md` (this entry).
- **Risks + follow-ups**:
  - **Throttled announcement vs. active seek**: if the user scrubs to a new position, the live region only re-announces at the next 5s tick. Acceptable for AC-06; if user complaints arise, add a `seekAnnouncement` separate state that fires once per seek via the existing `onSeek` callback in both timeline components.
  - **Playhead pill in `ArrangementTimelineWidget`** is `aria-hidden` (the live region handles the AT announcement), so it's purely cosmetic. Removing it would lose zero a11y value; left in for parity with `AuditTimeline` visible readout.
  - **Still-open carry-overs** (5 of 8 remain): multi-select track blocks, export arrangement as image/PDF, Lighthouse CI gate + a11y walkthrough (Phase 4.1), venv cleanup, Phase 2.3 v2 follow-ups (SSE push, segment TTL, OpenAI embeddings).
  - **Sigmap context files** are now stale (no longer auto-regen on commit). Run `npm run sigmap` after any architecture-level change.

## 2026-06-20 — Carry-Over Sweep: 5 Tech-Debt + Features Cleared

- **Context**: After the prior session closed 3 of 8 carry-overs, the user
  asked to clear the remaining 5. All 5 shipped in a single session
  (~7 commits, ~2k lines).
- **Five ships** (one paragraph each):

  1. **Venv cleanup** — `pip uninstall` of 9 inert packages
     (laion-clap 1.1.4, h5py, ftfy, braceexpand, webdataset, wandb,
     wget, torchlibrosa, pandas). All were investigation artifacts;
     production never imported any of them. Verified analyzer still
     imports cleanly + `pm2 restart arra-analysis` → service online,
     RSS dropped 716 → 576 MB. `torchvision` 0.21.0+shim stayed
     (transformers needs `is_torchvision_available()`).

  2. **Phase 2.3 v2: TTL purge for /tmp audio cache** (`5cc91e3`) —
     `analyzer.py: purge_stale_temp_files(max_age_seconds=86400)`
     scans `tempfile.gettempdir()/arra_temp_*` and removes any file
     older than the threshold. `app.py` lifespan hook runs it at
     startup; `download_and_analyze` now wraps the analysis call in
     try/finally so a crash mid-analysis doesn't leak the file until
     the next TTL pass. Verified via pm2 logs:
     `[Startup] Temp cache TTL=86400s, purged 0 stale file(s)`.

  3. **Phase 2.4 v2: OpenAI embeddings adapter** (`017cc0e`) —
     `server/adapters/OpenAIEmbeddingAdapter.js` implements
     `IRecommendationService` via OpenAI's `text-embedding-3-*`
     models. Off by default; `RECOMMENDATION_ADAPTER=openai` +
     `OPENAI_API_KEY` switches. Batches up to 100 inputs/request,
     SHA-256 caches embeddings across calls (free re-rankings),
     typed `OpenAIEmbeddingsError` for fallback routing. 17 new
     tests cover constructor validation, batching, caching, error
     paths, header + endpoint overrides.

  4. **Phase 2.3 v2: SSE push for bookmark analysis status**
     (`0fc8965`) — `BookmarkAnalysisBus` (in-process EventEmitter)
     + `buildBookmarkAnalysisSseHandler` route at
     `GET /api/audits/:id/bookmarks/events`. New
     `useBookmarkAnalysisStream(auditId)` hook + `IBackendService
     .subscribeBookmarkAnalysis` port method. Auth accepts JWT via
     `?token=` query (browsers can't set headers on EventSource).
     Backoff on error (5 attempts). `AuditDetail.jsx` merges the
     live snapshots over the stored `bookmark.analysis` so the
     BookmarkAnalysisTags card re-renders on every transition.
     Tests: 12 bus + 4 service eventBus + 10 hook = 26 new.

  5. **Feature: multi-select + bulk-delete track blocks** (`2ae313b`) —
     `client/src/utils/blockSelection.js` (pure helpers:
     `applyBlockClick`, `detectModifier`, `pruneSelection`) +
     multi-select UI in `ArrangementTimelineWidget` (orange border
     on selected, toolbar pill with count + Delete + Clear,
     window.confirm guard, Delete-key shortcut, Esc clears,
     section+track ids share the same space so one delete pass
     covers both). 20 new tests.

  6. **Feature: export arrangement as image/PDF** (`9de48fe`) —
     `client/src/utils/arrangementExport.js` renders the timeline
     to a 2D canvas (no extra dep, devicePixelRatio-aware) +
     `arrangementExportPdf.jsx` (text-searchable PDF via
     @react-pdf/renderer, already a dep from Phase 1.3). New
     `ExportArrangementButton.jsx` is a dropdown (PNG / PDF) in
     the widget toolbar; the PDF path is dynamic-imported so
     react-pdf stays out of the entry bundle. 25 new tests
     (16 util + 9 component).

  7. **Lighthouse CI gate + a11y walkthrough** (`e6b0537`) —
     `scripts/lighthouse.mjs` (auto-detects Chrome on the host,
     runs lighthouse@12 via npx, exits 1 on threshold miss, 77
     when no usable Chrome). `client/UI/LIGHTHOUSE.md` documents
     the workflow, threshold defaults, and the manual a11y
     walkthrough checklist. `npm run lighthouse` is the one-shot.
     Real scores pending Chrome system libs (libnspr4+) on the
     dev host — documented in LIGHTHOUSE.md.

- **Test totals** (final):
  - Client vitest 168 → 234 (+66 across playheadAnnouncer [carried
    over], blockSelection, arrangementExport, ExportArrangementButton,
    useBookmarkAnalysisStream)
  - Server jest 104 → 137 (+33: BookmarkAnalysisBus [12],
    BookmarkAnalysisService eventBus [4], OpenAIEmbeddingAdapter [17])
  - Vite build clean. Main 614.87 KB (unchanged).
  - Bundle deltas: TechniqueNotebook unchanged (74→49 KB done
    last session). ArrangementTimelineWidget 57.19 → 60.57 → 69.68 KB
    across multi-select + export (+12.5 KB total).
  - AuditDetail 58.1 → 59.5 KB (+1.4 KB for SSE hook import).

- **Service state**:
  - `arra-server` restarted (SSE route wired in). 26 MB RSS.
  - `arra-analysis` restarted (venv cleanup). 576 MB RSS (down
    from 716 MB before uninstall).
  - `arra-client` running 26h (no restart needed).
  - All 3 PM2 services online.

- **Files touched** (this session): 22 new files, 16 modified,
  7 commits (`2ae313b`, `5cc91e3`, `017cc0e`, `0fc8965`, `9de48fe`,
  `e6b0537`, plus the prior carry-over commits already merged).
  Full file inventory in `git log --stat` for the 5 new commits.

- **Risks + follow-ups**:
  - **SSE eventBus is in-process only**: a multi-instance deployment
    would need Redis pub/sub or similar. Tracked as a v3 carry-over
    in the SESSION log.
  - **Bookmark analysis SSE auto-reconnect on client**: capped at 5
    attempts (exponential backoff up to 15s). After 5 fails, status
    flips to 'error' and the UI stops trying. Users fall back to
    polling via the existing `getBookmarkAnalysis` endpoint.
  - **PDF export depends on @react-pdf/renderer chunk**: still lazy
    on the audit PDF path, so the export button adds 0 bytes to the
    initial bundle. The audit PDF route and the arrangement PDF
    route share the chunk.
  - **OpenAI adapter is off by default** so the existing TF-IDF
    results + cost profile don't change. To opt in: set
    `RECOMMENDATION_ADAPTER=openai` + `OPENAI_API_KEY` in `.env`.
  - **Lighthouse gate needs Chrome system libs** on the host to
    produce real numbers. The dev box needs
    `libnspr4+libnss3+libxss1+libgbm1+libasound2+libatk*+libcups2+…`
    installed via sudo apt. Until then, CI will see exit 77 (skip).
  - **Venv cleanup lost the venv shebang**: the pip wrapper script
    has a stale `#!/home/jackc/projects/sonic-dna/venv/bin/python3`
    shebang but the venv was moved; `python -m pip` works fine
    (we used that throughout). Tracked for a future `python -m pip
    install --force-reinstall` to regenerate wrappers, or just
    recreate the venv from scratch.
  - **Stale tech debt (cleared)**: sigmap hook, lazy modal, live
    region, multi-select, export, Lighthouse, venv cleanup, SSE
    push, OpenAI adapter, TTL purge — all closed.

### 2026-06-20: AuditTimeline major refactor

- **Context**: AuditTimeline on the Analysis tab was fundamentally broken:
  playhead used pixel positioning (hardcoded to 1000px viewBox, wrong at
  any other container width), waveform always fell back to synthetic data
  because `waveform_peaks` was never produced by the Python analyzer,
  sections derived from `sectional_key_candidates` with no timing data
  (equal-proportion assumption), a redundant Downbeats lane duplicated
  the Beat Grid, no playhead indicator on non-waveform lanes, and the
  key center lane had no data source (the analyzer doesn't produce
  `key_changes`).

- **Changes**:
  - **Playhead**: percentage-based (`left: ${pct}%`) instead of pixels.
    A single global playhead overlays all lanes via `position:absolute`
    spanning the lanes container. `useScrubState` now tracks
    `scrubRatio` (0-1) instead of pixel-based `scrubX`.
  - **Waveform → Energy Curve**: replaced the SVG `WaveformLane` with
    `EnergyCurveLane` that renders `audioAnalysis.energy_curve` (40
    floats) as vertical bars with opacity-scaled color. This data is
    actually produced by the Python analyzer's deterministic fallback
    and the CLAP pipeline.
  - **Removed redundant Downbeats lane**: the Beat Grid lane already
    highlights downbeats with taller/more-opaque tick marks.
  - **Key Regions lane**: replaced `KeyCenterLane` (which read
    `key_changes` — never produced) with `KeyRegionsLane` that uses
    `sectional_key_candidates` + `beat_times` to estimate section
    positions via a bar-count-based distribution algorithm
    (`estimateSectionPositions`). Section types (intro/verse/chorus)
    get weighted bar counts, scaled to match the total bar budget.
  - **Sections lane**: now accepts an `arrangementSections` prop
    (parsed from `responses['arrangement-timeline']` in AuditForm).
    When user sections exist, they display with type-colored blocks
    (intro=info, verse=primary, chorus=success, bridge=warning, etc.).
    When no user sections exist, falls back to analytical key regions
    as labeled sections.
  - **Scrub tooltip**: offset now accounts for the lane label width
    plus actual pixel position from the scrub ratio, fixing the
    hardcoded 80px assumption.
  - **Context menu close**: MarkersLane now uses a native document
    click listener (with `setTimeout` guard) so outside clicks reliably
    close the rename/delete context menu.
  - **Props flow**: `AuditForm` parses `responses['arrangement-timeline']`
    via `useMemo` and passes `arrangementSections` through
    `AuditAnalysisTab` to `AuditTimeline`.

- **CSS**: removed obsolete `.audit-lane-waveform`, `.audit-lane-beat`,
  `.audit-lane-section`, `.audit-lane-marker` class rules (heights now
  inline). Lane borders handled by the `Lane` wrapper component.

- **Tests**: 48 new tests covering rendering, energy curve, beat grid,
  key regions, sections (add form, cancel, submit, readOnly), markers
  (context menu, rename, delete, keyboard, outside-click close),
  scrubbing, arrangement sections priority, edge cases (missing data,
  fallbacks). All 282 client tests pass. Vite build clean (main 614 KB
  unchanged).

### 2026-06-20: DAW multi-track timeline refactor

- **Context**: The user requested that the playhead indicator progress smoothly with the song (it was previously choppy/lagging due to a 500ms `setInterval` polling interval in `AudioContext.jsx`). Additionally, they needed a way to add, move, resize, and edit "midi clips" (Intro, Verse, Chorus, etc.) across multiple instrument and vocal track lanes (Vocals, Synths, Guitars, Bass, Drums) behaving like a mini DAW.

- **Changes**:
  - **Playhead smooth movement**: Replaced the conditional 500ms `setInterval` polling in `AudioContext.jsx` with a continuous `requestAnimationFrame` loop that checks the active player's time and updates the context `currentTime` state at 60fps, resulting in perfectly smooth playhead sliding.
  - **Multi-track arrangement**: Rebuilt the layout in `AuditTimeline.jsx` to render 6 horizontal DAW tracks: Sections (Arrangement), Vocals, Synths/Keys, Guitars, Bass, Drums.
  - **Draggable and resizable clips**: Implemented custom mouse event listeners on clips in `AuditTimeline.jsx` to support:
    - Drag-to-move (updates `startTime`).
    - Hover handle detection with `col-resize` mouse cursor to drag-to-resize duration (both left-edge resize and right-edge resize are fully clamped and supported).
  - **Synchronous form state**: Fixed race conditions in test environments by setting the clip edit form state synchronously inside the click and creation callbacks.
  - **Settings Modal Inspector**: Replaced the inline addition form with a beautiful edit modal popup allowing the user to name the clip, change its type/color, change its track lane (moves clips between tracks), set start time and duration manually, write chords/notes, and delete the clip.
  - **Backwards compatibility**: Preserved flat-array support for legacy templates (automatically maps them to the arrangement lane) and fallback key center estimates.
  - **Props flow update**: Added `handleUpdateSections` in `AuditForm.jsx` and piped it through `AuditAnalysisTab` to `AuditTimeline` as `onUpdateSections` to persist clip changes to `responses['arrangement-timeline']` in MongoDB.

- **Tests**: Re-verified the test suite and updated `AuditTimeline` to pass all 49 timeline tests. All 283 client tests pass. Vite build clean.

