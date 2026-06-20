

## Auto-generated signatures
<!-- Updated by gen-context.js -->
You are a coding assistant with complete knowledge of this codebase.
The following code signatures were extracted by SigMap v7.0.1 on 2026-06-20T03:39:51.058Z.
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
client/src/App.jsx ← styles/global, context/AuthContext, context/AudioContext, pages/Login, components/ResearchSummaryRenderer
client/src/components/ResearchSummaryRenderer.jsx ← utils/splitSentences, utils/lensGuess, PromoteToTechniqueModal
client/src/hooks/__tests__/useTechniques.test.jsx ← useTechniques, ../context/BackendContext, ../adapters/InMemoryBackendAdapter
client/src/hooks/useTechniques.js ← context/BackendContext, utils/lensGuess
client/src/utils/__tests__/lensGuess.test.js ← lensGuess
```

## changes (last 5 commits — 1 second ago)
```
.github/context-cold.md                       +useSketches  +probeAudioDuration  +CoverPage  +LensPages
.github/copilot-instructions.md               +App  ~App  ~useSketches  ~probeAudioDuration
.github/gemini-context.md                     +App  ~App  ~useSketches  ~probeAudioDuration
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
h3 client/UI/AC_AUDIT.md
h3 client/index.html
h3 client/public/index.html
h3 client/src/components/ErrorBoundary.jsx
h3 client/src/context/AuthContext.jsx
h3 client/src/context/BackendContext.jsx
h3 client/src/hooks/__tests__/useSketches.test.jsx
h3 client/src/hooks/useAudit.js
h3 client/src/hooks/useAuditAutosave.js
h3 client/src/hooks/useAuditShortcuts.js
h3 client/src/hooks/useAudits.js
h3 client/src/hooks/useCompletionCheck.js
h3 client/src/hooks/useCurricula.js
h3 client/src/hooks/useDeepLinkParams.js
h3 client/src/hooks/useSketches.js
h3 client/src/hooks/useSong.js
h3 client/src/hooks/useStudyProgress.js
h3 client/src/hooks/useTasteProfiles.js
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
h3 client/src/App.jsx
h3 client/src/adapters/HttpBackendAdapter.js
h3 client/src/adapters/InMemoryBackendAdapter.js
h3 client/src/components/ComparePlayer.jsx
h3 client/src/components/ResearchSummaryRenderer.jsx
h3 client/src/components/__tests__/ComparePlayer.test.jsx
h3 client/src/context/AudioContext.jsx
h3 client/src/hooks/__tests__/useTechniques.test.jsx
h3 client/src/hooks/useTechniques.js
h3 client/src/ports/IBackendService.js
h3 client/src/utils/__tests__/lensGuess.test.js
h3 client/src/utils/audioDelta.js
h3 client/src/utils/lensGuess.js
h3 client/src/utils/splitSentences.js
h2 server
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
h3 client/src/App.jsx
h3 client/src/adapters/HttpBackendAdapter.js
h3 client/src/adapters/InMemoryBackendAdapter.js
h3 client/src/components/ComparePlayer.jsx
h3 client/src/components/ResearchSummaryRenderer.jsx
h3 client/src/components/__tests__/ComparePlayer.test.jsx
h3 client/src/context/AudioContext.jsx
h3 client/src/hooks/__tests__/useTechniques.test.jsx
h3 client/src/hooks/useTechniques.js
h3 client/src/ports/IBackendService.js
h3 client/src/utils/__tests__/lensGuess.test.js
h3 client/src/utils/audioDelta.js
h3 client/src/utils/lensGuess.js
h3 client/src/utils/splitSentences.js
h2 server
```

## client

### client/src/App.jsx
```
function App()  :865-877
```

### client/src/components/ResearchSummaryRenderer.jsx
```
export const parseSummaryText = (text) =>  :57-98
```

### client/src/hooks/__tests__/useTechniques.test.jsx
```
function makeWrapper(backend)  :8-12
```

### client/src/hooks/useTechniques.js
```
export function useTechniques(filters = {}, { skip = false } = {})  :15-110
```

### client/src/utils/__tests__/lensGuess.test.js
```
function countAll(text)  :50-62
```

### client/src/utils/lensGuess.js
```
export function guessLens(text, { minScore = 1 } = {})  :36-61
function escapeRegex(s)  :63-65
```

### client/src/utils/splitSentences.js
```
export function splitSentences(text)  :1-18
```
