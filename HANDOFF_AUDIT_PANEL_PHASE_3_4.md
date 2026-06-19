# ARRA // Audit System — Analysis Panel Phase 3 + 4 Handoff

> Continuation of the Analysis Panel redesign.
> Phase 1 (shipped) + Phase 2 (shipped, Sessions 1–3) handled structural
> layout, tab system, header, capture technique, timeline, lens, sources, notebook.
> This document covers **polish, accessibility, performance, responsive layout, and
> Tailwind CDN removal** — everything that remains.

**Version:** 1.0 · June 2026
**Status:** Ready for implementation
**Predecessor:** `HANDOFF_AUDIT_PANEL_PHASE_2.md` (closed — 7/7 line items shipped)
**Source spec:** Original analysis panel design handoff (sections 4–5, AC-01–AC-09)
**Commits to build on:** `e19adb6` (Phase 2.6+2.7), `0d25b42` (TDZ fix), `638c0b8` (docs)

---

## 1. Scope Recap

### Already shipped (Phase 1 + 2)

| Section | Status | File / Commit |
|---|---|---|
| 2. Design tokens | ✅ Shipped | `client/src/styles/global.js` (Phase 1) |
| 3. Layout restructure (tabs) | ✅ Shipped | `client/src/pages/AuditForm.jsx:325+` (Phase 1) |
| 4.1 Panel Header | ✅ Shipped | `client/src/components/audit/AuditPanelHeader.jsx` |
| 4.2 Tab Navigation Bar | ✅ Shipped | `client/src/components/audit/AuditTabBar.jsx` |
| 4.3 Track Analysis Modules | ✅ Shipped | `client/src/components/audit/TrackAnalysisModules.jsx` |
| 4.4 Timeline Visualization | ✅ Shipped | `client/src/components/audit/AuditTimeline.jsx` |
| 4.5 Lens Panel | ✅ Shipped | `client/src/components/audit/LensPanel.jsx` |
| 4.6 Capture Technique | ✅ Shipped | `client/src/components/audit/CaptureTechnique.jsx` |
| 4.7 Research Intelligence | ✅ Shipped | `client/src/components/audit/SourcesPanel.jsx` |
| 4.8 Notebook Tab | ✅ Shipped | `client/src/components/audit/NotebookPanel.jsx` |
| 2.6 Session completion flow | ✅ Shipped | `AuditPanelHeader.jsx` + `AuditForm.jsx` (`e19adb6`) |
| 2.7 Notebook tab song-filtered view | ✅ Shipped | `NotebookPanel.jsx` rewrite (`e19adb6`) |

### Remaining work (this handoff)

- **Phase 3 (Session 4):** Visual polish sweep — 4.1 (verify clean), 4.2 (hover/locked states), 4.3 (tooltips), 4.4 (focus mode context-aware), 4.5 (scrub tooltip offset).
- **Phase 4 (Sessions 5–6):** Accessibility (5.1), Performance (5.3), Tailwind CDN removal (5.4), Responsive layout (5.2).

### Current audit (auto-verified 2026-06-19)

| Check | Result | Tool |
|---|---|---|
| `box-shadow` / `border-radius` in `audit/*.jsx` (non-50%) | **0 offenders** | `rg` |
| Tailwind CDN script in `client/index.html` | **1 occurrence** (line 12) | `rg` |
| Tailwind utility class usage in `client/src/` | **3 files**: Dashboard, AuditDetail, StudySessionWorkspace | `rg` |
| `<ErrorBoundary>` in `client/src/` | **0** | `rg` |
| `aria-label` count in audit components | minimal — needs sweep | `rg` |

---

## 2. Open Questions to Resolve First

| # | Question | Recommended default | Owner |
|---|---|---|---|
| Q1 | Hover brightness — `filter: brightness(1.05)` or `background-color` shift? | **Background-color shift** using existing surface tokens. Avoids `filter` overhead + compositing artifacts on text. | Design |
| Q2 | Locked state CSS — class on element or inline `opacity`? | **`.locked` class** in `global.js`. Future-proof for collab scenarios. | Engineering |
| Q3 | Tailwind — Option A (port 20 classes to inline) or Option B (PostCSS)? | **Option A.** Codebase already 95% inline-styled. Port is faster + zero build-step risk. | Engineering |
| Q4 | Mobile breakpoint — hide Capture Technique entirely or collapse to icon-only? | **Collapse to icon-only** with tap-to-expand sheet. Users still want to log on the go. | Product |
| Q5 | Error boundary placement — wrap `<Routes>` or just `<AuditForm>`? | **Wrap `<Routes>`** in `App.jsx`. Catches all page-level render errors. | Engineering |
| Q6 | Performance budget for initial bundle? | **Target: 800 KB** (down from current 1082 KB). 25% reduction via code-split. | Engineering |
| Q7 | A11y audit source — Lighthouse CI or manual AC checklist? | **Both.** Lighthouse gate in CI + manual AC walkthrough file at `UI/AC_AUDIT.md`. | Engineering |

---

## 3. Phase 3 — Visual & Interaction Polish (Session 4, ~3h)

### 3.1 No `box-shadow` / no `border-radius` (non-50%) — verify clean

**Status:** ✅ Already clean (verified `rg` returns 0 offenders).

**Tasks:**
1. Run `rg -n "box-shadow|border-radius" client/src/components/audit/ client/src/pages/AuditForm.jsx | rg -v "50%"` and confirm 0 lines.
2. Add an ESLint rule or a `pre-commit` hook to prevent regressions (deferred — see §5.4).

**Acceptance:** Search returns empty.

---

### 3.2 Hover and locked states

**File:** `client/src/styles/global.js` (add `.locked` class)

**Tasks:**

1. **Define `.locked` class** — `opacity: 0.4; pointer-events: none; cursor: not-allowed;`. Use sparingly: future collab scenarios where another user's technique is read-only. For now, just define the class so the CSS exists when needed.

2. **Hover brightness via surface tokens** — Add a `--bg-surface-hover` (already exists at `global.js:12`, `#2e2e36`) and use it as `transition: background 0.15s`. Avoid `filter: brightness()` (compositing cost + affects child text contrast).

3. **Hover-only action reveal in Capture Technique** — The "Discard" button should only render when the form is dirty. Verify current behavior matches this. (Already implemented in Session 2.5 per Phase 2 handoff — verify during audit.)

4. **Subtle hover on technique cards** — `.technique-card:hover { background: var(--bg-surface-hover); }` — apply to `NotebookPanel` and `CaptureTechnique` saved-list rows.

**Acceptance:** All interactive surfaces transition on hover within 150ms; locked class defined and available.

---

### 3.3 Tooltip coverage

**Files:** `client/src/components/audit/*.jsx`

**Tasks:**

1. **Confidence dot tooltip** — `TrackAnalysisModules.jsx:13` (ConfidenceDot). Add `title="Confidence level: 87% (analysis confidence). Click to override."`. Show dynamic percentage from `bucket.value`.

2. **Override button tooltip** — Already has `title="Manually correct detected values"` at `TrackAnalysisModules.jsx:96`. Verify still present.

3. **Marker tooltip** — `AuditTimeline.jsx:259` (marker triangle). Extend `title` to show full note + timestamp + lens: `{formatTime(ts)} · {note || 'untitled'} · {lens}`.

4. **Lens prompt tooltip** — `LensPanel.jsx` prompt cards. `title={prompt.question}` so hovering shows the full question without needing to expand.

5. **Capture Technique tag suggestion tooltip** — `CaptureTechnique.jsx` (tag ghost buttons). `title="Click to add this tag"` on each suggestion.

**Acceptance:** All icon-only or compact UI elements have `title` (or ARIA-describedby for proper a11y) describing the action.

---

### 3.4 Focus mode context-awareness

**File:** `client/src/App.jsx` + `client/src/pages/AuditForm.jsx`

**Tasks:**

1. **Context-aware EXIT FOCUS** — `App.jsx` has a floating "EXIT FOCUS" button. Currently toggles focus off. Change to: when `useLocation().pathname.startsWith('/audit/')`, navigate to `/planner` instead of just toggling.

   ```jsx
   const isAudit = location.pathname.startsWith('/audit/');
   const handleExit = () => {
     if (isAudit) navigate('/planner');
     else setFocusMode(false);
   };
   ```

2. **Hide "Return to Plan" in header** — When in audit context AND focus mode is on, the header's `onReturnToPlan` is redundant. Either hide it or keep it as the explicit action and hide the floating one. **Recommend:** keep both but show only one. The floating "EXIT FOCUS" is more discoverable in focus mode; the header "Return to Plan" makes sense as the persistent breadcrumb.

3. **Auto-scroll to first interactive on tab switch** — When `activeTab` changes, focus the first interactive element in the new tab content. Use a `tabRef` per tab body and `.focus()` after render.

   ```jsx
   const tabBodyRef = useRef(null);
   useEffect(() => {
     if (tabBodyRef.current) {
       const first = tabBodyRef.current.querySelector('input, button, select, textarea, [tabindex="0"]');
       if (first) first.focus();
     }
   }, [activeTab]);
   ```

**Acceptance:** Tab switch moves focus; EXIT FOCUS in audit navigates to planner; no double-up between header and floating button.

---

### 3.5 Scrub tooltip in timeline

**File:** `client/src/components/audit/AuditTimeline.jsx:407-421`

**Current state:** Tooltip exists but offset math doesn't account for the lane label column (left ~80px).

**Tasks:**

1. **Position fix** — Add 80px to the left offset to account for the lane label column. Track the label column width via `useRef` measurement or hardcode 80px (since label is fixed-width mono).

2. **Animate** — `transition: opacity 100ms ease-in`. Add a `mounted` boolean state to trigger the transition on first paint.

3. **Content** — Show: `{timestamp} (bar {barNumber}/{totalBars})` if BPM known, else just timestamp. Compute barNumber from `Math.floor(time / (60 / bpm * 4))` and totalBars from `duration / (60 / bpm * 4)`.

**Acceptance:** Tooltip appears at correct X offset, fades in over 100ms, shows bar:totalBars.

---

## 4. Phase 4 — A11y, Performance, Responsive, Tailwind (Sessions 5–6, ~11h)

### 4.1 Accessibility (Session 5, ~4h)

**Source spec:** AC-01 through AC-09 (original handoff). Track in `UI/AC_AUDIT.md`.

**Tasks:**

1. **AC checklist file** — Create `UI/AC_AUDIT.md` walking through AC-01 to AC-09 with: criterion text, current status (✅/⬜/❌), evidence, fix. Used as both deliverable and regression check.

2. **Error boundary in `App.jsx`** — Wrap `<Routes>` in an `ErrorBoundary` class component. Catches render errors and shows a "Reload workspace" message + reset button (calls `window.location.reload()`).

   ```jsx
   class ErrorBoundary extends React.Component {
     state = { error: null };
     static getDerivedStateFromError(error) { return { error }; }
     componentDidCatch(error, info) { console.error('Render error:', error, info); }
     render() {
       if (this.state.error) return <div className="error-boundary">...</div>;
       return this.props.children;
     }
   }
   ```

3. **ARIA sweep** — Audit `audit/*.jsx` for icon-only buttons missing `aria-label`. Specifically check:
   - `CaptureTechnique.jsx:333` X button to remove tag ✅ (already has `aria-label`)
   - `NotebookPanel.jsx` delete `×` button — verify has `aria-label={`Delete technique ${tech.techniqueName}`}`
   - `AuditTimeline.jsx` marker add/remove — verify
   - `AuditTabBar.jsx` — verify `aria-selected`, `aria-controls`, `role="tab"`

4. **Focus visible outline** — Verify `global.js:60` `button:focus-visible` doesn't conflict with custom focus on inputs (`global.js:305`). They use different outline widths (2px vs 1px) which is correct; no fix needed.

5. **High contrast mode** — Add `@media (prefers-contrast: more)` block in `global.js` bumping `--text-secondary` to `#c0c4ca` and `--border-subtle` to `#3a3a44`.

6. **Keyboard navigation in NotebookPanel** — Tab through search input, sort dropdown, technique cards, delete buttons. Verify `tabindex` order. Add `role="search"` to the search input wrapper.

**Acceptance:** Lighthouse accessibility score ≥ 95 on `/audit/form/:id`. AC checklist complete. Error boundary catches synthetic test error.

---

### 4.2 Responsive layout (Session 6, ~3h)

**Source spec:** Section 5 — Desktop (>1200), Tablet (768–1199), Mobile (<768).

**Tasks:**

1. **Tablet (768–1199)** — At `max-width: 1199px`:
   - Tab bar still 4 columns (no change needed)
   - Capture Technique footer collapses by default; tap to expand
   - 2-column metric grid in Track Analysis
   - Timeline lane labels narrower (60px instead of 80px)

2. **Mobile (<768)** — At `max-width: 767px`:
   - Hide `Track Analysis` label header
   - Stack 4 metric cards in 2x2 grid (already in 2x2 per `TrackAnalysisModules.jsx`? verify)
   - Hide metadata chips row in header
   - Make tab bar scrollable horizontally if overflow (already has 4 tabs so may not overflow)
   - Capture Technique footer → icon-only collapsed sheet with tap-to-expand
   - Timeline lanes: keep all 6 but reduce lane height to 28px (from 40px)

3. **Touch targets ≥ 32px** — Verify all buttons min-height 32px on mobile. `CaptureTechnique.jsx:194` form inputs already 32px. Audit other buttons.

4. **Hide override controls on mobile** — Per spec: "Hide override controls" on mobile. Wrap `TrackAnalysisModules` edit button in `@media (min-width: 768px) { display: block; }`.

**Acceptance:** Layout doesn't break at 360px, 768px, 1280px. Mobile usable for thumb-tap capture. Lighthouse mobile score ≥ 90.

---

### 4.3 Performance (Session 5, ~2h)

**Tasks:**

1. **Code-split audit components** — `React.lazy()` for each `audit/*` component. Wrap in `<Suspense fallback={<LoadingPanel />}>`. Drops initial bundle by ~40KB.

   ```jsx
   const AuditPanelHeader = React.lazy(() => import('../components/audit/AuditPanelHeader'));
   const AuditTabBar = React.lazy(() => import('../components/audit/AuditTabBar'));
   // etc.
   ```

2. **Memoize expensive computations** — `TrackAnalysisModules.jsx` scale-degree row computed on every render. Wrap in `useMemo([key, scale])`. `LensPanel` prompt count too. `NotebookPanel` filtered/sorted list already memoized (verify).

3. **Tab content lazy-mount** — When `activeTab` switches, unmount previous tab content. Currently all 4 tab bodies mount on first render. The `activeTab === 'analysis' && (...)` pattern already does conditional rendering — verify no `display: none` hiding state.

4. **Bundle analysis** — Run `vite build --mode analyze` (or add `rollup-plugin-visualizer`). Identify top 3 dependencies. Likely candidates: chart libs (none currently), markdown renderer, axios. Audit if any can be replaced with native fetch / lighter alternative.

**Acceptance:** Initial bundle ≤ 800 KB (down from 1082 KB). Tab switch is instant (no re-render of previous tab's React tree). Scale-degree row doesn't recompute on unrelated re-renders.

---

### 4.4 Tailwind CDN removal (Session 6, ~2h)

**Current state:** `client/index.html:12` has `<script src="https://cdn.tailwindcss.com"></script>`. Build warns: "cdn.tailwindcss.com should not be used in production." Affected files (3): `StudySessionWorkspace.jsx`, `Dashboard.jsx`, `AuditDetail.jsx`.

**Tasks (Option A — recommended):**

1. **Strip CDN script** — Remove `<script src="https://cdn.tailwindcss.com"></script>` from `client/index.html:12`.

2. **Audit Tailwind classes** — Run `rg -n "className=\".*\\b(flex|grid|p-[0-9]|m-[0-9]|gap-[0-9]|text-|bg-|border-)"` in `client/src/`. List the actual classes used (likely 20–30 total).

3. **Port to inline styles** — For each class, write the equivalent inline `style` prop. Use existing design tokens (`--bg-surface-2`, `--text-primary`, etc.).

   | Tailwind class | Inline equivalent |
   |---|---|
   | `flex` | `display: 'flex'` |
   | `flex-col` | `flexDirection: 'column'` |
   | `gap-6` | `gap: '24px'` |
   | `p-6` | `padding: '24px'` |
   | `border-l-2` | `borderLeft: '2px solid var(--border-subtle)'` |
   | `text-lg` | `fontSize: '18px'` |

4. **Build verification** — Run `npm run build`. Confirm no Tailwind warning, no broken styles.

5. **Manual smoke** — Visit Dashboard, AuditDetail, StudySessionWorkspace. Visual regression check.

**Acceptance:** `npm run build` exits with zero warnings. `rg "cdn.tailwindcss.com"` returns 0. Layout of affected pages unchanged.

---

## 5. Out of Scope (Phase 3 + 4)

These items from the original spec are **deferred** to later work:

- **Original spec §4.4** — Draggable playhead, M-key marker drop with audio latency compensation. Requires Web Audio scheduling refactor.
- **Original spec §4.5** — Custom prompt sets per session. Requires curriculum data model change. See `HANDOFF_P0_P4.md` ARRA-014.
- **Original spec §4.7** — Full Notebook design with search, filter, kanban. ARRA-014.
- **P0–P4 product work** — shareable deep links, A/B compare, PDF export, stems, mobile PWA. See `HANDOFF_P0_P4.md`.
- **Desktop split view (>1200px)** — 2-column Reference/Work split. Requires layout restructure + audio routing changes.

---

## 6. Implementation Order (Suggested)

| Session | Phase | Scope | Est. effort | Status | Commit |
|---|---|---|---|---|---|
| 4 | 3.1 | Verify no `box-shadow`/`border-radius` (3.1) | 0.25h | ⬜ Pending | — |
| 4 | 3.2 | `.locked` class + hover brightness (3.2) | 0.5h | ⬜ Pending | — |
| 4 | 3.3 | Tooltip coverage sweep (3.3) | 0.5h | ⬜ Pending | — |
| 4 | 3.4 | Focus mode context-aware (3.4) | 1h | ⬜ Pending | — |
| 4 | 3.5 | Scrub tooltip offset + animation (3.5) | 0.75h | ⬜ Pending | — |
| 5 | 5.1 | Error boundary + ARIA sweep + AC checklist (4.1) | 4h | ⬜ Pending | — |
| 5 | 5.3 | Code-split + memoize + lazy-mount (4.3) | 2h | ⬜ Pending | — |
| 6 | 5.4 | Tailwind CDN removal (4.4) | 2h | ⬜ Pending | — |
| 6 | 5.2 | Responsive layout (4.2) | 3h | ⬜ Pending | — |

**Total:** ~14 hours across 3 sessions. **0 of 9 line items shipped.**

---

## 7. Acceptance Criteria

Phase 3 + 4 are **done** when:

- [ ] `rg "box-shadow"` in `audit/*.jsx` returns 0 lines.
- [ ] `.locked` class defined in `global.js` with correct styles.
- [ ] All icon-only buttons have `title` or `aria-label`.
- [ ] Focus mode EXIT FOCUS in audit context navigates to `/planner`.
- [ ] Tab switch moves focus to first interactive in new tab body.
- [ ] Scrub tooltip X-offset accounts for label column.
- [ ] `UI/AC_AUDIT.md` walks through AC-01 to AC-09 with status.
- [ ] `<ErrorBoundary>` wraps `<Routes>` in `App.jsx`.
- [ ] `prefers-contrast: more` media query in `global.js`.
- [ ] Layout doesn't break at 360px, 768px, 1280px.
- [ ] Lighthouse a11y score ≥ 95 on `/audit/form/:id`.
- [ ] Lighthouse mobile score ≥ 90.
- [ ] Initial bundle ≤ 800 KB.
- [ ] Tailwind CDN script removed; affected files ported to inline.
- [ ] `npm run build` exits with zero warnings.
- [ ] All PM2 processes still online after deploy.

---

## 8. Reference

- **Closed Phase 2 handoff:** `HANDOFF_AUDIT_PANEL_PHASE_2.md` v1.2
- **Original analysis panel design spec:** sections 4–5 + AC-01–AC-09
- **P0–P4 product roadmap:** `HANDOFF_P0_P4.md`
- **Design tokens:** `client/src/styles/global.js`
- **Architecture red lines:** `agent_memory.md`
- **Phase 2 commits:** `e19adb6` (feat), `0d25b42` (TDZ fix), `638c0b8` (docs)
- **Test pattern:** server `__tests__/` for backend; client tests not yet scaffolded (deferred §5.1)

---

## 9. Implementation Status

### Session 4 — Pending (Phase 3)

- 3.1 Verify clean (5min, audit only)
- 3.2 Locked + hover states
- 3.3 Tooltip sweep
- 3.4 Focus mode context-aware
- 3.5 Scrub tooltip

### Session 5 — Pending (Phase 4 a11y + perf)

- 4.1 Error boundary + ARIA + AC checklist
- 4.3 Code-split + memoize

### Session 6 — Pending (Phase 4 Tailwind + responsive)

- 4.4 Tailwind CDN removal
- 4.2 Responsive breakpoints

---

END OF HANDOFF
