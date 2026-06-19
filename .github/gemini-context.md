

## Auto-generated signatures
<!-- Updated by gen-context.js -->
You are a coding assistant with complete knowledge of this codebase.
The following code signatures were extracted by SigMap v7.0.1 on 2026-06-19T14:56:11.616Z.
<!-- sigmap: version=7.0.1 -->

These signatures represent every public function, class, and type in the project.
Refer to them when answering questions about code structure, APIs, and implementation.
## Code Signatures

## SigMap commands

| When | Command |
|------|---------|
| Before answering a question about code | `sigmap ask "<your question>"` |
| To rank files by topic | `sigmap --query "<topic>"` |
| After changing config or source dirs | `sigmap validate` |
| To verify an AI answer is grounded | `sigmap judge --response <file>` |

Always run `sigmap ask` (or `sigmap --query`) before searching for files relevant to a task.

## deps
```
client/src/App.jsx ← styles/global, context/AuthContext, context/AudioContext, pages/Login, pages/Dashboard
client/src/adapters/InMemoryBackendAdapter.js ← ports/IBackendService
client/src/pages/AuditForm.jsx ← context/BackendContext, context/AudioContext, components/audit/lensConstants
```

## changes (last 5 commits — 0 seconds ago)
```
client/src/components/ErrorBoundary.jsx       +ErrorBoundary
client/src/pages/AuditForm.jsx                ~formatTime  ~useAutosave
.github/context-cold.md                       +App
.github/copilot-instructions.md               ~App  ~InMemoryBackendAdapter  ~HttpBackendAdapter  ~useAutosave
.github/gemini-context.md                     ~App  ~InMemoryBackendAdapter  ~HttpBackendAdapter  ~useAutosave
```

## .github

### .github/context-cold.md
```
h1 Code signatures
h2 SigMap commands
h2 deps
h2 analysis_service
h3 analysis_service/analyzer.py
h3 analysis_service/app.py
h2 client
h3 client/public/index.html
h3 client/src/adapters/HttpBackendAdapter.js
h3 client/src/components/ResearchSummaryRenderer.jsx
h3 client/src/context/AudioContext.jsx
h3 client/src/context/AuthContext.jsx
h3 client/src/context/BackendContext.jsx
h3 client/src/ports/IBackendService.js
h2 server
h3 server/adapters/InMemoryRepository.js
h3 server/adapters/MockAIAdapter.js
h3 server/adapters/MockSearchAdapter.js
h3 server/adapters/MongooseRepository.js
h3 server/adapters/OpenAIAdapter.js
h3 server/adapters/TavilyAdapter.js
h3 server/bin/seedCurriculum.js
h3 server/middleware/auth.js
h3 server/ports/IAIModelService.js
h3 server/ports/IRepository.js
```

### .github/copilot-instructions.md
```
h2 Auto-generated signatures
h1 Code signatures
h2 SigMap commands
h2 deps
h2 changes (last 5 commits — 0 seconds ago)
h2 .github
h3 .github/context-cold.md
h3 .github/copilot-instructions.md
h3 .github/gemini-context.md
h2 client
h3 client/UI/AC_AUDIT.md
h3 client/index.html
h3 client/src/App.jsx
h3 client/src/adapters/InMemoryBackendAdapter.js
h3 client/src/components/ErrorBoundary.jsx
h3 client/src/pages/AuditForm.jsx
code-fence plain
```

### .github/gemini-context.md
```
h2 Auto-generated signatures
h2 Code Signatures
h2 SigMap commands
h2 deps
h2 changes (last 5 commits — 0 seconds ago)
h2 .github
h3 .github/context-cold.md
h3 .github/copilot-instructions.md
h3 .github/gemini-context.md
h2 client
h3 client/UI/AC_AUDIT.md
h3 client/index.html
h3 client/src/App.jsx
h3 client/src/adapters/InMemoryBackendAdapter.js
h3 client/src/components/ErrorBoundary.jsx
h3 client/src/pages/AuditForm.jsx
code-fence plain
```

## client

### client/UI/AC_AUDIT.md
```
h1 ARRA — Analysis Panel Accessibility (AC) Audit
h2 AC-01 — Tab navigation is keyboard accessible (arrow keys cycle, Home/End jump to ends)
h2 AC-02 — All form inputs have associated `<label>` elements
h2 AC-03 — Icon-only buttons have `aria-label` or visible text
h2 AC-04 — Color is never the sole conveyor of meaning
h2 AC-05 — Focus visible on all interactive elements
h2 AC-06 — Audio context (playhead) is exposed to assistive tech
h2 AC-07 — Error and success states are announced
h2 AC-08 — High contrast mode is supported
h2 AC-09 — Page is operable at 200% zoom and on small viewports
h2 Summary
h2 Regression Check (run after every audit panel change)
h1 1. AC-03: no unlabeled icon-only buttons in audit/*
h1 2. AC-05: focus-visible still universal
h1 3. AC-07: alerts/roles present
code-fence bash
code-fence ---
```

### client/index.html
```
title: Arra Audit
div#root
```

### client/src/App.jsx
```
function App()  :733-745
```

### client/src/adapters/InMemoryBackendAdapter.js
```
export class InMemoryBackendAdapter  :7-31
  constructor()  :8-31
```

### client/src/components/ErrorBoundary.jsx
```
class ErrorBoundary  :3-106
  constructor(props)  :4-8
  static getDerivedStateFromError(error)  :10-12
  componentDidCatch(error, info)  :14-17
  handleReset()  :19-24
  if(typeof window !== 'undefined')  :21-23
  render()  :26-105
  if(this.state.error)  :27-103
```

### client/src/pages/AuditForm.jsx
```
function useAutosave(auditId, data, backend, delay = 3000)  :17-54
function formatTime(seconds)  :57-60
```
