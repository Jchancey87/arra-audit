# Arra Audit System — Icon Rebranding Handoff

This document details the plan and assets required to replace the remaining "cheesy" emojis and AI-style icons with clean, inline SVGs that match the DAW aesthetic (stroke `currentColor`, `strokeWidth="2.5"`, HSL tailored color rules) used in the left navigator sidebar.

---

## 📂 Target Files and Emojis to Replace

Here is the exact list of files and line numbers where emojis need to be replaced by theme-aligned inline SVGs:

### 1. `client/src/pages/Dashboard.jsx`
*   **Line 85**: `🎛️ Song Library Crate`
*   **Line 189**: `icon="🎧"` inside `<EmptyState>`
*   **Line 300**: `🗑️` inside delete button
*   **Line 381**: `Resume ⚡`

### 2. `client/src/pages/StudySessionWorkspace.jsx`
*   **Line 305**: `✓ A matching song...`
*   **Line 327**: `⚡ Import via YouTube URL`
*   **Line 364**: `🔎 Select Existing Song`
*   **Line 432**: `🎧 LISTENING PROMPT`
*   **Line 439**: `🎹 DAW SKETCH CHALLENGE`
*   **Line 449**: `📝 OBSERVED STUDY NOTES`
*   **Line 519**: `🔗 Reference Signal`
*   **Line 573**: `📤 DAW Sketch Uploader`
*   **Line 641**: `📊 Arrangement / Form Timeline`

### 3. `client/src/pages/Settings.jsx`
*   **Lines 6-9**: Emojis in `LENS_META` (`🥁`, `🎛️`, `🎹`, `🎼`)
*   **Line 137**: `🔬 DEEP DIVE (10 SOURCES)`
*   **Lines 341-342**: `⚡` (Quick workflow) and `🎓` (Guided workflow)
*   **Lines 431, 442, 453, 464**: Taste labels (`🥁 Rhythm Tastes`, `🎛️ Texture Tastes`, etc.)
*   **Line 624**: `⚠️ Critical: Delete System Account`

### 4. `client/src/pages/TechniqueNotebook.jsx`
*   **Line 348**: `🗑️` inside delete button
*   **Line 449**: `🎵 {songDisplay}`
*   **Lines 503-508**: Lane titles in Kanban board (`📋`, `📚`, `🏋️`, `✍️`, `🚀`, `🔄`)
*   **Line 516**: `📚 Technique Notebook`
*   **Line 653**: `icon="📓"` inside `<EmptyState>`
*   **Line 762**: `✍️ QUICK LOG NEW DISCOVERY`

### 5. `client/src/pages/StudyPlannerDashboard.jsx`
*   **Line 215**: `📅 Study Planner Dashboard`
*   **Lines 221, 584, 615**: `✨ AI Plan Generator` / `✨ AI Custom Plan Generator`
*   **Lines 324, 389**: `🔒 Locked` / `🔒 Review Locked & Saved`
*   **Line 371**: `📋 WEEK {weekNumber} REFLECTION`
*   **Line 445**: `📝 INTERACTIVE PLAN BUILDER`
*   **Line 577**: `🚀 Start Course (Default Planner)`
*   **Line 620**: `🧠 Synthesizing Curriculum...`

### 6. `client/src/pages/Trash.jsx`
*   **Line 145**: `🗑️ Archives & Trash`
*   **Line 162**: `⚠️ {error}`
*   **Line 163**: `✅ {successMessage}`
*   **Lines 197, 300**: Placeholders inside empty state blocks (`🎧`, `📝`)
*   **Line 239**: `⏱️ {formatDuration}`
*   **Lines 240, 334**: `📅 Deleted:`
*   **Lines 256, 350**: `🔄 Restore` buttons
*   **Lines 263, 357**: `🗑️ Purge` buttons
*   **Line 386**: `⚠️ CRITICAL: PERMANENT PURGE SEQUENCE`

---

## 🎨 Clean SVG Assets (DAW Theme-Aligned)

Use these inline SVG definitions across all components. They match the stroke width, round join caps, and alignment rules of the navigator system.

### 1. Faders & Channels (Replaces `🎛️`)
```jsx
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <line x1="4" y1="21" x2="4" y2="14"></line>
  <line x1="4" y1="10" x2="4" y2="3"></line>
  <line x1="12" y1="21" x2="12" y2="12"></line>
  <line x1="12" y1="8" x2="12" y2="3"></line>
  <line x1="20" y1="21" x2="20" y2="16"></line>
  <line x1="20" y1="12" x2="20" y2="3"></line>
  <line x1="2" y1="14" x2="6" y2="14"></line>
  <line x1="10" y1="8" x2="14" y2="8"></line>
  <line x1="18" y1="16" x2="22" y2="16"></line>
</svg>
```

### 2. Headphones (Replaces `🎧`)
```jsx
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
</svg>
```

### 3. Trash & Purge (Replaces `🗑️`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  <line x1="10" y1="11" x2="10" y2="17"></line>
  <line x1="14" y1="11" x2="14" y2="17"></line>
</svg>
```

### 4. Lightning Bolt / Quick Mode (Replaces `⚡`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
</svg>
```

### 5. Checkmark / Success (Replaces `✓` or `✅`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', color: '#4ade80' }}>
  <polyline points="20 6 9 17 4 12"></polyline>
</svg>
```

### 6. Magnifying Glass / Search (Replaces `🔎`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
</svg>
```

### 7. Keyboard / Synth (Replaces `🎹`)
```jsx
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <rect x="2" y="3" width="20" height="18" rx="2"></rect>
  <line x1="6" y1="3" x2="6" y2="13"></line>
  <line x1="10" y1="3" x2="10" y2="13"></line>
  <line x1="14" y1="3" x2="14" y2="13"></line>
  <line x1="18" y1="3" x2="18" y2="13"></line>
  <line x1="2" y1="13" x2="22" y2="13"></line>
  <line x1="6" y1="13" x2="6" y2="21"></line>
  <line x1="12" y1="13" x2="12" y2="21"></line>
  <line x1="18" y1="13" x2="18" y2="21"></line>
</svg>
```

### 8. Observed Study Notes / Notebook (Replaces `📝` or `📓`)
```jsx
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
  <polyline points="14 2 14 8 20 8"></polyline>
  <line x1="16" y1="13" x2="8" y2="13"></line>
  <line x1="16" y1="17" x2="8" y2="17"></line>
  <polyline points="10 9 9 9 8 9"></polyline>
</svg>
```

### 9. Signal Reference / Wave Link (Replaces `🔗`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
</svg>
```

### 10. Uploader (Replaces `📤`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
  <polyline points="17 8 12 3 7 8"></polyline>
  <line x1="12" y1="3" x2="12" y2="15"></line>
</svg>
```

### 11. Timeline Grid (Replaces `📊`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <rect x="3" y="3" width="18" height="18" rx="2"></rect>
  <line x1="3" y1="9" x2="21" y2="9"></line>
  <line x1="3" y1="15" x2="21" y2="15"></line>
  <line x1="9" y1="9" x2="9" y2="21"></line>
  <line x1="15" y1="9" x2="15" y2="21"></line>
</svg>
```

### 12. Warning / Caution (Replaces `⚠️`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }}>
  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
  <line x1="12" y1="9" x2="12" y2="13"></line>
  <line x1="12" y1="17" x2="12.01" y2="17"></line>
</svg>
```

### 13. Clock / Stopwatch (Replaces `⏱️`)
```jsx
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
  <circle cx="12" cy="12" r="10"></circle>
  <polyline points="12 6 12 12 16 14"></polyline>
</svg>
```

### 14. Calendar / Plan (Replaces `📅`)
```jsx
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
  <line x1="16" y1="2" x2="16" y2="6"></line>
  <line x1="8" y1="2" x2="8" y2="6"></line>
  <line x1="3" y1="10" x2="21" y2="10"></line>
</svg>
```

### 15. Lock status (Replaces `🔒`)
```jsx
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
</svg>
```

### 16. Clipboard / Backlog (Replaces `📋`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
</svg>
```

### 17. Books / Study (Replaces `📚`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
</svg>
```

### 18. Practice / Dumbbell (Replaces `🏋️`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <line x1="6" y1="12" x2="18" y2="12"></line>
  <rect x="2" y="7" width="4" height="10" rx="1"></rect>
  <rect x="18" y="7" width="4" height="10" rx="1"></rect>
</svg>
```

### 19. Rocket / Apply (Replaces `🚀`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <path d="M4.5 16.5c-1.5 1.25-2.5 3.5-2.5 3.5s2.25-1 3.5-2.5"></path>
  <path d="M12 2C6.5 2 2 6.5 2 12c0 2.1.6 4.1 1.7 5.7l12.6-12.6C14.7 2.6 13.5 2 12 2z"></path>
  <path d="M12 2c5.5 0 10 4.5 10 10 0 1.5-.6 2.7-1.7 4.3L7.7 3.7C9.3 2.6 10.5 2 12 2z"></path>
</svg>
```

### 20. Recycle / Revisit (Replaces `🔄`)
```jsx
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
  <polyline points="23 4 23 10 17 10"></polyline>
  <polyline points="1 20 1 14 7 14"></polyline>
  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
</svg>
```

### 21. Open Book / Graduation / Guided (Replaces `🎓`)
```jsx
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
  <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path>
</svg>
```

### 22. Brain / Synthesis (Replaces `🧠`)
```jsx
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2z"></path>
  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z"></path>
</svg>
```

---

## 🛠️ Verification Commands

To check that your updates compile correctly with no syntax or layout warnings:

```bash
# Clean client build to make sure everything compiles
npm --prefix /home/jackc/projects/arra/client run build
```
