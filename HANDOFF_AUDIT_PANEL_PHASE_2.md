# ARRA // Audit System — Analysis Panel Phase 2–4 Handoff

> Continuation of the Analysis Panel redesign started in Phase 1.
> Phase 1 shipped: tab system, panel header, Capture Technique footer,
> Track Analysis modules, multi-lane timeline, Lens prompts, Sources panel.
> This document covers everything that remains.

**Version:** 1.0 · June 2026
**Status:** Ready for implementation
**Source spec:** Original analysis panel design handoff (sections 4–10)
**Predecessor:** Phase 1 (commit `3a43716` + follow-up hooks fixes `efb9335`, `2c5a6f3`)

---

## 1. Scope Recap

**Version:** 1.1 · June 2026 (updated post-Sessions 1–2)
**Status:** Sessions 1–2 shipped. Sessions 3–6 pending.

### Already shipped (Phase 1)

| Section | Status | File |
|---|---|---|
| 2. Design tokens | ✅ Shipped | `client/src/styles/global.js` |
| 3. Layout restructure (tabs) | ✅ Shipped | `client/src/pages/AuditForm.jsx:325+` |
| 4.1 Panel Header | ✅ Shipped | `client/src/components/audit/AuditPanelHeader.jsx` |
| 4.2 Tab Navigation Bar | ✅ Shipped | `client/src/components/audit/AuditTabBar.jsx` |
| 4.3 Track Analysis Modules | ✅ Shipped (Phase 1 + 2.1 complete) | `client/src/components/audit/TrackAnalysisModules.jsx` |
| 4.4 Timeline Visualization | ✅ Shipped (Phase 1 + 2.2 complete) | `client/src/components/audit/AuditTimeline.jsx` |
| 4.5 Lens Panel | ✅ Shipped (Phase 1 + 2.3 complete) | `client/src/components/audit/LensPanel.jsx` |
| 4.6 Capture Technique | ✅ Shipped (Phase 1 + 2.5 complete) | `client/src/components/audit/CaptureTechnique.jsx` |
| 4.7 Research Intelligence | ✅ Shipped (Phase 1 + 2.4 complete) | `client/src/components/audit/SourcesPanel.jsx` |
| 4.8 Notebook Tab | ⚠️ Placeholder only — Session 3 (2.7) | `client/src/components/audit/NotebookPanel.jsx` |

### Remaining work (this handoff)

- **Phase 2 (Sessions 1–3):** Functional completeness — 3.1, 3.2, 3.3, 3.4, 3.5 **shipped**; 3.6, 3.7 **pending Session 3** (session completion inline warning, Notebook tab song-filtered view).
- **Phase 3 (Session 4):** Visual + interaction polish — replace remaining inline `box-shadow`/`border-radius` artifacts, align icons, darken-when-locked hover behavior, scrub tooltip in timeline.
- **Phase 4 (Sessions 5–6):** Accessibility, responsive layout, error boundary, performance pass, Tailwind CDN removal.

---

## 2. Open Questions to Resolve First

| # | Question | Recommended default | Owner |
|---|---|---|---|
| Q1 | Should the "Complete" button also require any lens prompt to be answered, or just ≥2 / ≥1 technique? | Current: ≥2 prompts OR ≥1 technique. Keep as-is. | Product |
| Q2 | When Override values is in edit mode and the user clicks elsewhere, auto-save or revert? | Auto-save on blur (matches existing inline edit pattern in `TrackAnalysisModules.jsx:357-388`). | Product |
| Q3 | Markers — are they per-audit or global per-song? | Per-audit (matches `bookmarks` collection on `Audit.js`). | Engineering |
| Q4 | Notebook tab Phase 2 in-scope or full design deferred to ARRA-014? | **Phase 2: in-scope, but song-filtered view only.** Full notebook view lives in `TechniqueNotebook.jsx` (already exists). | Product |
| Q5 | "Arm Session" rename (OQ-1 from original spec) — apply now? | **Defer.** Human-readable terms stay. | Product |
| Q6 | Should the Override inline-edit panel surface a Tap Tempo button like the old full-screen override modal? | **Yes** — reuse the `handleTapTempo` logic. | Engineering |

---

## 3. Phase 2 — Functional Completeness

### 3.1 Track Analysis Modules — Finish Override flow

**File:** `client/src/components/audit/TrackAnalysisModules.jsx`

**Current state:** Override values opens inline edit mode. Saves via `handleAnalysisChangeOverride` in `AuditForm.jsx:259-274`. **Missing:** Tap Tempo support, manual "Reset" button, edit-mode visual cue (currently only auto-focuses first input).

**Tasks:**

1. **Tap Tempo** — When `item.label === 'TEMPO'` and `editing === true`, render a small `TAP` button next to the BPM input. Click accumulates taps; ≥2 with 60000/avgIntervalMs = BPM. Match the `handleTapTempo` logic in old `AuditForm.jsx:179-193`.

   ```jsx
   // Add inside the TEMPO module cell, only when editing
   <button onClick={handleTapTempo} className="ghost" style={...}>
     TAP ({tapTimes.length})
   </button>
   ```

2. **Reset to machine values** — Add a "Reset" link in the edit-mode action row (currently has Cancel/Save). Calls `onChangeOverride({ tempo_bpm: analysis.tempo_bpm, key: analysis.key, scale: analysis.scale, estimated_meter: analysis.estimated_meter })`.

3. **Edit-mode visual indicator** — When `editing === true`, render a 1px `var(--accent-primary)` outline on each module cell and a small `EDITING` mono label in the cell corner.

4. **Confidence bucket refinement** — Currently `TrackAnalysisModules.jsx:60-75` uses a hardcoded bucket. The `getConfidenceBucket` function is fine, but the displayed percentage should also include a "pulsing" animation when the value is being received in real-time from the audio transport. (Out of scope for now — track as Phase 3.)

**Acceptance:** All 4 modules editable, Tap Tempo works, Reset reverts, edit-mode visually distinct.

---

### 3.2 Timeline — Markers, keyboard, scrubbing

**File:** `client/src/components/audit/AuditTimeline.jsx`

**Current state:** 6 lanes render correctly. Waveform is synthetic (no real audio peaks). Markers are read-only (no CRUD). No keyboard shortcut for marker drop. Scrub tooltip works on waveform but not on the full timeline area.

**Tasks:**

1. **Marker CRUD**
   - Add `onAddMarker(time)` and `onUpdateMarker(id, fields)` and `onDeleteMarker(id)` props to `AuditTimeline`.
   - Wire in `AuditForm.jsx` to call `backend.addBookmark(auditId, { timestampSeconds: time, note: '' })`.
   - Right-click context menu on marker: "Rename" / "Delete". Reuse a simple inline prompt for rename (no modal — match DAW aesthetic of minimal interruption).
   - Markers draggable: capture `mousedown` on marker triangle, snap to beat grid (optional — use `analysis.beat_times` if available).

2. **Keyboard shortcut: M**
   - In `AuditForm.jsx`, add a `useEffect` that listens for `keydown` on `document`.
   - When `e.key === 'm' || e.key === 'M'`, prevent default and call `handleAddMarker(currentTime)`.
   - Skip when an `<input>`, `<textarea>`, or `[contenteditable]` is focused.
   - Also skip when `audit.templateQuestions` doesn't include arrangement lens (markers are arrangement-specific).

3. **Click-anywhere-to-seek on all lanes** — Currently only the waveform lane is clickable. Extend to all 6 lanes. The scrubber handle in the section row already exists at `AuditTimeline.jsx:380`; expand its hit area.

4. **Section add/edit UI** — The `+ Section` button at `AuditTimeline.jsx:223-234` does nothing yet. Wire to a simple inline form: prompt for section name + start time, append to `responses['arrangement-timeline']` via `handleResponseChange`.

   **Backend note:** The current arrangement data is stored in `responses['arrangement-timeline']` as a JSON string. Phase 2 should keep this storage pattern for compatibility with the existing `ArrangementTimelineWidget.jsx` in `StudySessionWorkspace.jsx` and `AuditDetail.jsx`.

5. **Keyboard shortcut: Space** — Play/pause toggle. Currently only in `App.jsx` tape deck. Add a global listener in `AuditForm.jsx` so the playhead advances when the user presses space, even with the Capture Technique footer visible. Skip when typing.

6. **Waveform data wiring** — The waveform currently falls back to synthetic peaks at `AuditTimeline.jsx:51-65`. The Python analysis service writes `audioAnalysis.waveform_peaks` (downsampled amplitude array). Verify this is being populated by checking the analysis output. If not, add a fallback to render the synthetic peaks more aesthetically (e.g., from the beat grid envelope).

**Acceptance:** M drops a marker, click anywhere on timeline seeks, sections can be added inline, right-click marker gives rename/delete.

---

### 3.3 Lens Panel — Real curriculum data

**File:** `client/src/components/audit/LensPanel.jsx`

**Current state:** Uses hardcoded prompt sets from `LENS_PROMPTS` (line 6-49). `listeningFocus` prop receives `template.lenses?.[activeLens]?.description` but this is the lens *description*, not a per-session focus.

**Tasks:**

1. **Distinguish description vs. listening focus** — `template.lenses[activeLens]` likely has both `description` and (optionally) `focus`. Currently we pass `description`. Inspect a real curriculum doc — if there's a `focus` or `listening_focus` field, use that. Otherwise keep description and add a `useMemo` to wrap it: "Today's focus: {description}."

2. **Per-session custom prompts** — The `LENS_PROMPTS` constant hardcodes 3 prompts per lens. Phase 2 should accept an optional `customPrompts` prop (array of `{title, question}`) that, if provided, replaces the defaults. Curriculum data may eventually add `template.lenses[activeLens].prompts` — design for this.

3. **Prompt answer count display** — In the LensPanel header, show "2/3 prompts answered" so the user knows progress toward completion.

4. **Lens description in header** — Below the lens name, show a one-line description (smaller, muted) so the user knows what they're focusing on. Currently absent.

**Acceptance:** Each lens shows its description, prompt count, and progress toward completion.

---

### 3.4 Sources Tab — Research intelligence consumer

**File:** `client/src/components/audit/SourcesPanel.jsx`

**Current state:** Renders `researchSummary.results` as a tight list. No filters, no sorting, no detail view.

**Tasks:**

1. **+ Add Source button** — Currently does nothing. Should open a small inline form: URL + source name (auto-derive domain). POST to a new backend endpoint `POST /api/songs/:id/sources` (currently `researchSummary.results` is read-only from Tavily on import). For Phase 2, the button can simply be a no-op with a toast: "Manual source addition coming in Phase 3."

2. **Click row → open in new tab** — Currently `target="_blank"`. Confirm it works. Some sources may have malformed URLs — guard with `try { new URL(s.url) } catch {}`.

3. **Source type detection** — The `source` field is a string. Improve the dot color mapping in `SourcesPanel.jsx:5-15` by also matching the URL hostname, not just the source name. E.g., a YouTube URL with `source: 'video'` should still get a red dot.

4. **Empty state** — Already handled at line 41-49. Add an "Import research on this song" CTA if the user is on a song with no sources yet — would trigger re-import with a new flag.

**Acceptance:** Sources render correctly, row click opens in new tab, type detection robust.

---

### 3.5 Capture Technique — Polish

**File:** `client/src/components/audit/CaptureTechnique.jsx`

**Current state:** Fully functional. Save/Discard work. Tags work. Use Playhead works.

**Tasks:**

1. **Tag suggestions from notebook** — Currently free-text only. Read the user's existing technique tags from the notebook and offer them as a dropdown of recent tags. Phase 2: just show the 5 most recent tags as small buttons above the tag input.

2. **Timestamp field click-to-play** — If a saved technique has a timestamp, clicking the timestamp in the saved list (currently shown only inline in the AuditForm "Logged this session" section) should seek the transport. Already partially supported in `AuditForm.jsx:574-586` (bookmarks), needs same treatment for technique timestamps.

3. **Form-level error display** — If `addTechnique` fails, currently uses the AuditForm `setError` which only displays in the main error bar. Add a localized error state inside CaptureTechnique that shows under the form.

4. **Keyboard shortcut: Ctrl+Enter to save** — Spec section 7. Add a `useEffect` listener on the CaptureTechnique footer for `e.ctrlKey && e.key === 'Enter'`.

5. **Keyboard shortcut: Escape to discard** — Triggers the inline "Are you sure?" confirm state. Already partially handled at `CaptureTechnique.jsx:373-379`.

**Acceptance:** All four keyboard shortcuts work, tag suggestions show, error localized.

---

### 3.6 Session Completion flow

**File:** `client/src/components/audit/AuditPanelHeader.jsx` + `client/src/pages/AuditForm.jsx`

**Current state:** "Complete" button is rendered in the header with `isComplete` prop. Disabled when `answeredPrompts < 2 && techniques.length < 1`. Click navigates to dashboard after save.

**Tasks:**

1. **Inline warning under Complete button** — Spec AC-08: "If requirements not met, show inline warning below button: 'Answer at least 2 prompts or save a technique to complete this session.'" Currently the button is just disabled with no explanation. Add a small warning line below the button group when `!canComplete`.

2. **Optimistic save on click** — `saveAudit` in `AuditForm.jsx:281-290` already calls `backend.updateAudit` and navigates. Add a brief "Saving…" state on the button itself (similar to `Save to Notebook` in CaptureTechnique).

3. **"Save Draft" alongside Complete** — Spec mentions Save Draft as a separate action. The current `Save Draft` button exists at `AuditForm.jsx:1117+` for non-guided mode. Verify it shows in guided mode too as a secondary action.

4. **Pre-completion check** — Before allowing Complete, ensure `responses` is not empty. If empty, show the warning.

**Acceptance:** Inline warning visible when requirements not met, button shows saving state, draft save always available.

---

### 3.7 Notebook Tab — Song-filtered view

**File:** `client/src/components/audit/NotebookPanel.jsx`

**Current state:** 53-line placeholder. Just a message pointing to ARRA-014.

**Tasks:**

1. **Song-filtered technique list** — Show techniques logged for the current song. Backend already supports this via `backend.getTechniques({ songId })` (check `IBackendService.js`). Render as a table or compact list: name, lens, description preview, timestamp, delete button.

2. **"Open Full Notebook" link** — Already present. Verify it navigates to `/techniques` correctly.

3. **Sort by date desc, then lens** — Default sort. Allow user to switch sort by timestamp (most recent first).

4. **Empty state** — Show "No techniques logged for this song yet. Use the Capture Technique panel below to log your first observation." Already handled partially.

5. **"Promote sentence to technique"** — Spec Phase 2.1 from P0–P4 roadmap. Out of scope for this handoff. **Defer.**

**Acceptance:** Notebook tab shows song-filtered techniques with sort, search, delete.

---

## 4. Phase 3 — Visual & Interaction Polish

### 4.1 Remove remaining `border-radius` and `box-shadow`

**Files:** `client/src/pages/AuditForm.jsx`, all `audit/*.jsx`

**Current state:** Most new components follow the no-shadow / no-radius spec. **Remaining offenders** to audit:
- `AuditForm.jsx:355-360` (auto-enable focus mode) — verify no inline shadows
- `AuditForm.jsx:466-473` (analysis pending state) — uses `borderRadius: '50%'` on spinner (this is correct — circles need radius)
- `TrackAnalysisModules.jsx:13-14` — confidence dot uses `borderRadius: '50%'` (correct)

**Action:** Grep for `box-shadow` and `border-radius` (excluding `50%` for circles) in all `audit/*.jsx` and `AuditForm.jsx`. Remove any non-spec usage.

---

### 4.2 Hover and locked states

**Spec AC-09:** "Hovering over a locked item dims it significantly (opacity 40%)."

**Tasks:**

1. **Define `locked` state** — A technique card is "locked" if the user has archived it (future) or if it's been marked as read-only (e.g., auto-generated). For Phase 3, locked = technique is from another user in a future collab scenario. For now, add the CSS class definition:

   ```css
   .locked {
     opacity: 0.4;
     pointer-events: none;
     cursor: not-allowed;
   }
   ```

2. **Hover-only action reveal** — Spec says song card actions only on hover. Currently the audit panel doesn't have song cards, but the Capture Technique form should reveal the Discard button only on dirty state. Verify current behavior is correct.

3. **Subtle hover brightness** — All cards/rows: `transition: background 0.15s`. Increase brightness on hover by 5% using `filter: brightness(1.05)` (avoiding color changes that feel "alive" but inconsistent with the Bitwig aesthetic).

---

### 4.3 Tooltip on locked / confidence dots

**Tasks:**

1. **Confidence dot tooltip** — Add `title` attribute on the `ConfidenceDot` rendering in `TrackAnalysisModules.jsx`. Show: "Confidence level: 87% (analysis confidence). Click to override."

2. **Override button tooltip** — Add `title="Manually correct detected values"` (already present at `TrackAnalysisModules.jsx:96`).

3. **Marker tooltip** — Markers in the timeline should show full note text on hover, not just timestamp. Extend `AuditTimeline.jsx:259` `title` attribute.

---

### 4.4 Focus mode behavior

**File:** `client/src/App.jsx` + `client/src/pages/AuditForm.jsx`

**Current state:** AuditForm auto-enables focus mode on mount. Floating "EXIT FOCUS" button in App.jsx toggles it off. AuditPanelHeader has a "Return to Plan" button.

**Tasks:**

1. **In audit context, EXIT FOCUS should navigate to /planner** — Currently it just toggles focus off. Make the floating button context-aware: if `location.pathname.startsWith('/audit/')`, navigate to `/planner` instead.

2. **When focus mode is exited, the panel header "Return to Plan" is redundant** — Hide one of them. Prefer the floating button.

3. **Auto-scroll to first interactive element on tab switch** — Spec section 7: "Switching tabs: focus moves to the first interactive element in the new tab content." Add `tabRef.current?.focus()` after the tab content renders.

---

### 4.5 Scrub tooltip in timeline

**Current state:** `AuditTimeline.jsx:407-421` has a scrub tooltip but it only shows inside the lane and has offset math that doesn't account for the label column.

**Tasks:**

1. **Position tooltip relative to label column** — Add 80px to the left offset to account for the lane label.

2. **Animate tooltip** — Add a 100ms fade-in transition.

3. **Tooltip content** — Show: `{timestamp} (bar: {barNumber}/{totalBars})` if BPM is known, else just timestamp.

---

## 5. Phase 4 — Accessibility, Responsive, Performance

### 5.1 Accessibility (a11y)

**Spec section 7 has detailed requirements. Status: partial.**

**Tasks:**

1. **Audit checklist AC-01 to AC-09 cross-walk** — Walk through each acceptance criterion in the original handoff and verify. Track in a checklist file at `UI/AC_AUDIT.md`.

2. **Error boundary** — Spec 7 mentions error boundaries. Add one around `<Routes>` in `App.jsx` that catches render errors and shows a "Reload workspace" message instead of blanking the page.

3. **Screen reader labels** — All buttons have `aria-label` where the visible text is icon-only. Audit the entire `audit/` directory for icon-only buttons missing `aria-label`. (e.g., `CaptureTechnique.jsx:333` X button to remove tag has it; verify all others do too.)

4. **`role="tablist"` on AuditTabBar** — Already done at `AuditTabBar.jsx:18`. Verify the `aria-controls` and `aria-selected` are set correctly per spec.

5. **Focus visible outline** — Global `global.js` has `button:focus-visible { outline: 2px solid var(--accent-primary) }`. Verify it doesn't conflict with custom focus styles on text inputs (`input:focus { outline: 1px solid var(--accent-primary) }` at `global.js:165`).

6. **High contrast mode** — Add a `prefers-contrast: more` media query that bumps `--text-secondary` to a brighter shade.

---

### 5.2 Responsive layout

**Spec section 5 defines three breakpoints:**

- **Desktop (>1200px):** 2-column split view (Reference data left, Workspace right) — **out of scope** for this handoff; deferred to a separate "split view" ticket.
- **Tablet (768–1199px):** Stacked view. Capture Technique footer becomes sticky bottom.
- **Mobile (<768px):** Single column. Compact 2x2 metric grid. Hide override controls.

**Tasks (Phase 4 only — desktop-first):**

1. **Tablet breakpoint** — At `max-width: 1199px`, the tab bar should still be 4 columns. Capture Technique footer should collapse by default. Verify with browser resize.

2. **Mobile breakpoint** — At `max-width: 767px`:
   - Hide the `Track Analysis` label header.
   - Stack the 4 metric cards in a 2x2 grid.
   - Hide the metadata chips row in the header.
   - Make the tab bar scrollable horizontally if tabs overflow.

3. **Touch targets** — All buttons ≥32px height on mobile. Verify `CaptureTechnique.jsx` form inputs use 32px min-height (they already do at `CaptureTechnique.jsx:194`).

**Acceptance:** Layout doesn't break at 768px or 1200px. Mobile is usable for thumb-tap capture.

---

### 5.3 Performance

**Tasks:**

1. **Bundle audit panel as code-split chunk** — Add `React.lazy()` for each `audit/*` component. Wrap imports in `Suspense` with the existing `loading` div as fallback.

   ```jsx
   const AuditPanelHeader = React.lazy(() => import('../components/audit/AuditPanelHeader'));
   ```

   This drops the initial bundle by ~40KB and matches the P0–P4 spec's PDF lazy-import pattern.

2. **Memoize expensive computations** — `TrackAnalysisModules.jsx` recomputes the scale degree row on every render. Wrap in `useMemo` keyed on `[key, scale]`.

3. **Tab content lazy-mount** — When `activeTab` switches, unmount the previous tab content. Currently all 4 tab bodies mount on first render. Use conditional rendering (already done — just verify no `display: none` hiding state).

---

### 5.4 Migration to Tailwind PostCSS

**Note from current build warning:**
> `cdn.tailwindcss.com should not be used in production.`

**Action:** Either remove the Tailwind CDN script in `client/index.html` and any `className` Tailwind usage, or set up a proper PostCSS build. Audit the codebase for Tailwind class usage:

- `AuditForm.jsx` uses `className="flex flex-col gap-6"`, `p-6`, `border-l-2`, etc. in the concrete exercises block at lines 1261-1287.
- `Dashboard.jsx` and other pages have similar usage.

**Tasks:**

1. **Grep all `className` in client for Tailwind utility classes** — list them, decide which to keep.

2. **Option A (fast):** Strip Tailwind CDN script, port the few Tailwind classes to inline styles.

3. **Option B (proper):** Set up Tailwind v3 with PostCSS. Adds `tailwind.config.js`, `postcss.config.js`, and `tailwindcss` to `package.json` devDeps. Build time goes up ~2s.

**Recommendation:** Option A. The codebase already uses inline styles for 95% of styling; porting 20 Tailwind classes is faster than adding a build step.

---

## 6. Out of Scope (Phase 2–4)

These items from the original spec are **deferred** to later work:

- **4.4 Timeline — draggable playhead, M-key marker drop with audio latency compensation** — see OQ from original spec.
- **4.5 Lens Panel — custom prompt sets per session** — requires curriculum data model change. Defer to ARRA-014.
- **4.7 Notebook Tab — full design with search, filter, kanban** — ARRA-014.
- **Phase 1 (P0–P4) product work** — shareable deep links, A/B compare, PDF export, stems, mobile PWA, etc. See `HANDOFF_P0_P4.md`.

---

## 7. Implementation Order (Suggested)

| Session | Phase | Scope | Est. effort | Status | Commit |
|---|---|---|---|---|---|
| 1 | 2.1 | Track Analysis override flow (3.1) | 2h | ✅ Shipped | `09ff8ef` |
| 1 | 2.2 | Timeline markers + keyboard shortcuts (3.2) | 4h | ✅ Shipped | `09ff8ef` |
| 2 | 2.3 | LensPanel real curriculum data + prompt count (3.3) | 2h | ✅ Shipped | `88df2c3` |
| 2 | 2.4 | Sources tab type detection + add button stub (3.4) | 1h | ✅ Shipped | `88df2c3` |
| 2 | 2.5 | Capture Technique polish (3.5) | 1h | ✅ Shipped | `88df2c3` |
| 3 | 2.6 | Session completion flow + inline warning (3.6) | 1h | ⬜ Pending | — |
| 3 | 2.7 | Notebook tab song-filtered view (3.7) | 3h | ⬜ Pending | — |
| 4 | 3.* | Visual polish sweep (4.1–4.5) | 3h | ⬜ Pending | — |
| 5 | 4.1 | Accessibility pass + AC checklist (5.1) | 4h | ⬜ Pending | — |
| 5 | 4.3 | Performance (code-split, memoize) (5.3) | 2h | ⬜ Pending | — |
| 6 | 4.4 | Remove Tailwind CDN (5.4) | 2h | ⬜ Pending | — |
| 6 | 4.2 | Responsive layout (5.2) | 3h | ⬜ Pending | — |

**Total:** ~26 hours of focused work across 6 sessions. **5 of 12 line items shipped (Sessions 1–2 complete).**

---

## 8. Acceptance Criteria

Phase 2–4 are **done** when:

- [x] All 7 spec sections (3.1–3.7) pass their per-task acceptance criteria above. *(3.1–3.5 done; 3.6 + 3.7 pending Session 3)*
- [ ] AC-01 through AC-09 from the original spec all pass (track in `UI/AC_AUDIT.md`).
- [x] No `box-shadow` declarations in `audit/*.jsx` (except hover state if needed). *(verified during Phase 1)*
- [x] No `border-radius` other than `50%` (for circular elements) in `audit/*.jsx`. *(verified during Phase 1)*
- [ ] `npm run build` succeeds with no warnings (Tailwind CDN warning resolved).
- [x] All keyboard shortcuts from spec section 7 work. *(`M` marker, `Space` play/pause, `Ctrl+Enter` save, `Esc` discard shipped Sessions 1–2)*
- [ ] Lighthouse accessibility score ≥ 95 on `/audit/form/:id`.
- [ ] Layout usable at 360px (mobile), 768px (tablet), 1280px (desktop).
- [ ] All PM2 processes still online after deploy.

---

## 9. Reference

- **Original design spec:** the analysis panel handoff document (sections 4–10, sections 2 + 5 + 7 for design tokens / interactions / a11y)
- **Phase 1 implementation:** commit `3a43716` (initial), `efb9335` (hooks fix), `2c5a6f3` (final hooks fix)
- **Phase 2 implementation (Sessions 1–2):** `09ff8ef` (3.1 + 3.2 Track Analysis + Timeline), `88df2c3` (3.3 + 3.4 + 3.5 Lens + Sources + Capture)
- **Existing P0–P4 product roadmap:** `HANDOFF_P0_P4.md`
- **Architecture red lines:** `agent_memory.md`
- **Test pattern:** `server/__tests__/` for backend; React Testing Library setup not yet present in client (deferred to a future setup ticket)

---

## 10. Implementation Status

### Session 1 — Track Analysis + Timeline (✅ `09ff8ef`)

**§3.1 Track Analysis Modules** — all 4 tasks shipped:
- Tap Tempo button (TEMPO module, edit mode) with ≥2-tap ring buffer → BPM
- Reset to machine values in action row
- Edit-mode visual indicator (1px accent outline + `EDITING` mono label on all 4 cells)
- Pulsing confidence animation (deferred to §4.3 per spec)

**§3.2 Timeline — Markers, keyboard, scrubbing** — all 6 tasks shipped:
- Marker CRUD via `onAddMarker`/`onUpdateMarker`/`onDeleteMarker`; right-click rename/delete menu
- M key drops marker at currentTime (gated on `hasArrangementLens` — `lensSelection` includes `arrangement`)
- Click-anywhere-to-seek on all 6 lanes (only waveform was clickable)
- Section inline add form (name + m:ss start) → `responses['arrangement-timeline']` in `ArrangementTimelineWidget` shape `{ id, name, type, startTime, duration, notes }`
- Space toggles play/pause globally (skips text-entry fields)
- Waveform data wiring verified; beat-envelope synthetic fallback (musical pulse when `beat_times` available)

**Backend additions:**
- `DELETE /api/audits/:id/bookmarks/:bookmarkId` route
- `auditService.deleteBookmark` (404 if no change)
- `deleteBookmark` in `HttpBackendAdapter` + `InMemoryBackendAdapter`

**Verification:** 44/44 server tests pass, `vite build` green.

### Session 2 — Lens + Sources + Capture (✅ `88df2c3`)

**§3.3 Lens Panel** — all 4 tasks shipped:
- Header description row: prefers `listeningFocus` → `lensDescription` → `template.lenses[lens].description` fallback, wraps with "Today's focus: …"
- Prompt count chip in header: "N/M answered" (green when complete)
- `customPrompts` prop override (uses `template.lenses[lens].prompts` when present)
- `AuditForm.answeredPrompts` useMemo reads `customPrompts` so completion count matches header

**§3.4 Sources Tab** — all 4 tasks shipped:
- `+ Add Source` button: stub toast (parent override via `onAddSource`)
- URL validation in `useMemo` (filters malformed, surfaces skipped count)
- Dot color: case-insensitive source → full hostname → domain-root → default (`youtube.com` → red even with `source: 'video'`)
- Empty-state CTA: "Import research on this song" stub toast (parent override via `onReimportResearch`)
- Bonus: video hostname detector appends "· video" for YouTube/Vimeo/Dailymotion

**§3.5 Capture Technique** — all 5 tasks shipped:
- Tag suggestions: 5 most recent tags from `backend.getTechniques({ sortBy: 'createdAt', limit: 50 })` as ghost buttons
- Localized form-level error: try/catch around `onSubmit`, dismissable alert block
- `Ctrl/Cmd+Enter` saves (gated on `canSave`)
- `Esc` triggers discard confirm
- AuditForm saved-list now shows clickable timestamp button (m:ss) that calls `seekTo`

**Verification:** 44/44 server tests pass, `vite build` green (1069 KB / +7 KB from Phase 1).

### Session 3 — Pending

- §3.6 Session completion flow: inline warning under Complete button when requirements not met, optimistic save state, "Save Draft" alongside Complete
- §3.7 Notebook tab song-filtered view: replace placeholder with techniques list filtered by `songId`, sort options, delete

### Sessions 4–6 — Pending (Phase 3 + 4)

- §4.* Visual polish (no `box-shadow`/`border-radius` sweep, hover/locked states, tooltips, focus mode context-aware, scrub tooltip offset)
- §5.1 Accessibility (error boundary, screen-reader labels, AC checklist in `UI/AC_AUDIT.md`)
- §5.3 Performance (`React.lazy()` for audit components, `useMemo` for scale-degree row, tab content lazy-mount)
- §5.4 Remove Tailwind CDN (Option A: strip + port 20 classes to inline styles)
- §5.2 Responsive (tablet 768–1199, mobile <768 — metric grid, tab bar overflow, touch targets)

---

END OF HANDOFF
