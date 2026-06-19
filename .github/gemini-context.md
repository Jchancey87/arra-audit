

## Auto-generated signatures
<!-- Updated by gen-context.js -->
You are a coding assistant with complete knowledge of this codebase.
The following code signatures were extracted by SigMap v7.0.1 on 2026-06-19T12:16:32.716Z.
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
server/services/auditService.js ← models/Audit
client/src/App.jsx ← styles/global, context/AuthContext, context/AudioContext, pages/Login, pages/Dashboard
client/src/adapters/HttpBackendAdapter.js ← ports/IBackendService
client/src/adapters/InMemoryBackendAdapter.js ← ports/IBackendService
client/src/context/AudioContext.jsx ← BackendContext
client/src/pages/AuditForm.jsx ← context/BackendContext, context/AudioContext, components/audit/AuditPanelHeader, components/audit/AuditTabBar, components/audit/TrackAnalysisModules
```

## changes (last 5 commits — 0 seconds ago)
```
server/services/auditService.js               ~AuditService
client/src/adapters/HttpBackendAdapter.js     ~HttpBackendAdapter
client/src/adapters/InMemoryBackendAdapter.js ~InMemoryBackendAdapter
client/src/pages/AuditForm.jsx                ~formatTime
.github/context-cold.md                       +ClapAnalyzer  +__init__  +analyze_features  +get_clap_analyzer
.github/copilot-instructions.md               +HttpBackendAdapter  +useAutosave  +formatTime  ~ClapAnalyzer
.github/gemini-context.md                     +HttpBackendAdapter  +useAutosave  +formatTime  ~ClapAnalyzer
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
h3 client/index.html
h3 client/public/index.html
h3 client/src/components/ResearchSummaryRenderer.jsx
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
h3 server/ports/ISearchService.js
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
h3 client/src/context/AudioContext.jsx
h3 client/src/pages/AuditForm.jsx
h2 server
h3 server/services/auditService.js
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
h3 client/src/App.jsx
h3 client/src/adapters/HttpBackendAdapter.js
h3 client/src/adapters/InMemoryBackendAdapter.js
h3 client/src/context/AudioContext.jsx
h3 client/src/pages/AuditForm.jsx
h2 server
h3 server/services/auditService.js
code-fence plain
```

## client

### client/src/App.jsx
```
function App()  :721-733
```

### client/src/adapters/HttpBackendAdapter.js
```
export class HttpBackendAdapter  :8-172
  constructor(baseURL)  :9-22
  async login(email, password)  :25-28
  async register(email, password, name)  :30-33
  async getUserProfile()  :35-38
  async updatePreferences(preferences)  :40-43
  async updateProfile(profileData)  :45-48
  async changePassword(oldPassword, newPassword)  :50-53
  async deleteAccount()  :55-58
```

### client/src/adapters/InMemoryBackendAdapter.js
```
export class InMemoryBackendAdapter  :7-31
  constructor()  :8-31
```

### client/src/context/AudioContext.jsx
```
export const AudioProvider = ({ children }) =>  :8-150
export const useAudio = () =>  :354-360
```

### client/src/pages/AuditForm.jsx
```
function useAutosave(auditId, data, backend, delay = 3000)  :15-52
function formatTime(seconds)  :55-58
```

## server

### server/services/auditService.js
```
export class AuditService  :13-157
  constructor(auditRepository, techniqueRepository, songRepository)  :14-21
  if(!auditRepository)  :15-17
  async createAudit(auditData) → Promise<Object>  :33-91
  if(lensSelection.length === 0)  :49-51
  if(this.songRepository)  :54-57
  async getAudit(auditId, userId)  :95-101
  async getAuditsForSong(songId, userId)  :103-112
  if(this.songRepository)  :104-107
```
