

## Auto-generated signatures
<!-- Updated by gen-context.js -->
You are a coding assistant with complete knowledge of this codebase.
The following code signatures were extracted by SigMap v6.14.0 on 2026-06-10T17:32:20.039Z.

These signatures represent every public function, class, and type in the project.
Refer to them when answering questions about code structure, APIs, and implementation.
Before answering questions about specific code areas, suggest running `sigmap ask "<query>"` to get the most relevant files. After config changes, `sigmap validate` confirms coverage.

## Code Signatures

## deps
```
client/src/App.jsx ← styles/global, context/AuthContext, context/AudioContext, pages/Login, pages/Dashboard
client/src/context/AudioContext.jsx ← BackendContext
client/src/pages/AuditForm.jsx ← context/BackendContext, context/AudioContext, components/ArrangementTimelineWidget
```

## client

### client/src/App.jsx
```
function App()  :574-586
```

### client/src/context/AudioContext.jsx
```
export const AudioProvider = ({ children }) =>  :7-148
export const useAudio = () =>  :276-282
```

### client/src/pages/AuditForm.jsx
```
function useAutosave(auditId, data, backend, delay = 3000)  :8-45
function formatTime(seconds)  :48-51
```
