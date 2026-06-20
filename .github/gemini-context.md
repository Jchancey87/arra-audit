

## Auto-generated signatures
<!-- Updated by gen-context.js -->
You are a coding assistant with complete knowledge of this codebase.
The following code signatures were extracted by SigMap v7.0.1 on 2026-06-20T12:18:12.989Z.
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
client/src/adapters/HttpBackendAdapter.js ← ports/IBackendService
client/src/adapters/InMemoryBackendAdapter.js ← ports/IBackendService
client/src/hooks/useRecommendations.js ← context/BackendContext
analysis_service/analyzer.py ← requests
analysis_service/app.py ← fastapi, pydantic, analyzer
```

## changes (last 5 commits — 0 seconds ago)
```
server/adapters/MockRecommendationAdapter.js  +MockRecommendationAdapter
server/adapters/TFIDFAdapter.js               +TFIDFAdapter
server/ports/IRecommendationService.js        +IRecommendationService
server/services/RecommendationService.js      +RecommendationService
client/src/adapters/HttpBackendAdapter.js     ~HttpBackendAdapter
client/src/adapters/InMemoryBackendAdapter.js ~InMemoryBackendAdapter
client/src/hooks/useRecommendations.js        +useRecommendations
client/src/ports/IBackendService.js           ~IBackendService
.github/context-cold.md                       +useCompletionCheck  +MockIntersectionObserver  ~useAuditShortcuts  ~mergeFonts
.github/copilot-instructions.md               +useRecommendations  +IBackendService  +MockRecommendationAdapter  +TFIDFAdapter
.github/gemini-context.md                     +useRecommendations  +IBackendService  +MockRecommendationAdapter  +TFIDFAdapter
```

## .github

### .github/context-cold.md
```
h1 Code signatures
h2 SigMap commands
h2 deps
h2 client
h3 client/UI/AC_AUDIT.md
h3 client/index.html
h3 client/public/index.html
h3 client/src/App.jsx
h3 client/src/components/ComparePlayer.jsx
h3 client/src/components/ErrorBoundary.jsx
h3 client/src/components/ResearchSummaryRenderer.jsx
h3 client/src/components/__tests__/ComparePlayer.test.jsx
h3 client/src/context/AudioContext.jsx
h3 client/src/context/AuthContext.jsx
h3 client/src/context/BackendContext.jsx
h3 client/src/hooks/__tests__/useSketches.test.jsx
h3 client/src/hooks/__tests__/useTechniques.test.jsx
h3 client/src/hooks/useAudit.js
h3 client/src/hooks/useAuditAutosave.js
h3 client/src/hooks/useAuditShortcuts.js
h3 client/src/hooks/useAudits.js
h3 client/src/hooks/useCompletionCheck.js
h3 client/src/hooks/useCurricula.js
h3 client/src/hooks/useDeepLinkParams.js
h3 client/src/hooks/useSketches.js
```

### .github/copilot-instructions.md
```
h2 Auto-generated signatures
h1 Code signatures
h2 SigMap commands
h2 deps
h2 changes (last 5 commits — 1 second ago)
h2 .github
h3 .github/context-cold.md
h3 .github/copilot-instructions.md
h3 .github/gemini-context.md
h2 analysis_service
h3 analysis_service/analyzer.py
h3 analysis_service/app.py
h2 client
h3 client/src/adapters/HttpBackendAdapter.js
h3 client/src/adapters/InMemoryBackendAdapter.js
h3 client/src/hooks/useRecommendations.js
h3 client/src/ports/IBackendService.js
h2 server
h3 server/adapters/CLAPSegmentAdapter.js
h3 server/adapters/MockBookmarkAnalysisAdapter.js
h3 server/adapters/MockRecommendationAdapter.js
h3 server/adapters/TFIDFAdapter.js
h3 server/ports/IBookmarkAnalysisService.js
h3 server/ports/IRecommendationService.js
h3 server/services/BookmarkAnalysisService.js
```

### .github/gemini-context.md
```
h2 Auto-generated signatures
h2 Code Signatures
h2 SigMap commands
h2 deps
h2 changes (last 5 commits — 1 second ago)
h2 .github
h3 .github/context-cold.md
h3 .github/copilot-instructions.md
h3 .github/gemini-context.md
h2 analysis_service
h3 analysis_service/analyzer.py
h3 analysis_service/app.py
h2 client
h3 client/src/adapters/HttpBackendAdapter.js
h3 client/src/adapters/InMemoryBackendAdapter.js
h3 client/src/hooks/useRecommendations.js
h3 client/src/ports/IBackendService.js
h2 server
h3 server/adapters/CLAPSegmentAdapter.js
h3 server/adapters/MockBookmarkAnalysisAdapter.js
h3 server/adapters/MockRecommendationAdapter.js
h3 server/adapters/TFIDFAdapter.js
h3 server/ports/IBookmarkAnalysisService.js
h3 server/ports/IRecommendationService.js
h3 server/services/BookmarkAnalysisService.js
```

## analysis_service

### analysis_service/analyzer.py
```
class ClapAnalyzer  :44-149
  def __init__(model_name)
  def analyze_features(file_path, tags)
  def analyze_features_from_array(audio_array, sample_rate, tags)
def get_clap_analyzer()  :154-160
def analyze_segment(file_path, start_s, end_s, audio_id, pad_seconds)  :332-365  # Phase 2
def analyze_audio_file(file_path, yt_id)  :368-578  # Runs the audio analysis on the downloaded file
def download_and_analyze(youtube_url, yt_id, callback_url)  :581-673  # Downloads audio via yt-dlp to a temporary directory, analyze
def analyze_sketch_file(file_path, sketch_id, callback_url)  :676-710  # Analyze a user-uploaded DAW sketch (local file path, no yt-d
```

### analysis_service/app.py
```
class AnalysisRequest(BaseModel) {song_id*, youtube_url*, yt_id*, callback_url?}  :44-48
class SketchAnalysisRequest(BaseModel) {sketch_id*, file_path*, callback_url?}  :50-53
class SegmentAnalysisRequest(BaseModel) {audio_id?, file_path?, youtube_url?, yt_id?, start_seconds*, end_seconds*}  :55-64
def health()  :107-108
def trigger_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks)  :111-132  # Triggers an asynchronous audio analysis job
def trigger_sketch_analysis(request: SketchAnalysisRequest)  :135-162  # Synchronously analyze an uploaded DAW sketch from a local fi
async def trigger_segment_analysis(request: SegmentAnalysisRequest)  :165-213  # Phase 2
GET /health  →  health()  :107-108
POST /analyze  →  trigger_analysis()  :111-132
POST /analyze-sketch  →  trigger_sketch_analysis()  :135-162
POST /analyze-segment  →  trigger_segment_analysis()  :165-213
```

## client

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
export class InMemoryBackendAdapter  :7-32
  constructor()  :8-32
```

### client/src/hooks/useRecommendations.js
```
export function useRecommendations(techniqueId, { limit = 10, skip = false } = {})  :19-64
```

### client/src/ports/IBackendService.js
```
export class IBackendService  :7-76
  async login(email, password)  :9-9
  async register(email, password, name)  :10-10
  async getUserProfile()  :11-11
  async updatePreferences(preferences)  :12-12
  async updateProfile(profileData)  :13-13
  async changePassword(oldPassword, newPassword)  :14-14
  async deleteAccount()  :15-15
  async getSongs(filters)  :18-18
```

## server

### server/adapters/CLAPSegmentAdapter.js
```
export class CLAPSegmentAdapter  :69-118
  async analyzeSegment({ audioId, filePath, youtubeUrl, ytId, startSeconds, endSeconds, padSeconds = 5, })  :78-117
  if(endSeconds <= startSeconds)  :90-92
  if(!result || !result.analysis)  :113-115
```

### server/adapters/MockBookmarkAnalysisAdapter.js
```
export class MockBookmarkAnalysisAdapter  :65-98
  constructor({ model = 'deterministic-v1', version = '2.3.0', latencyMs = 0, failureRate = 0 } = {})  :66-71
  async analyzeSegment({ audioId, startSeconds, endSeconds })  :73-97
  if(this.latencyMs > 0)  :74-76
  if(endSeconds <= startSeconds)  :83-85
```

### server/adapters/MockRecommendationAdapter.js
```
export class MockRecommendationAdapter  :31-66
  constructor({ mode = 'tag-jaccard' } = {})  :32-34
  async rank({ targetId, targetText, corpus, limit = 10 } = {})  :36-65
  for(const item of corpus)  :55-62
```

### server/adapters/TFIDFAdapter.js
```
export class TFIDFAdapter  :105-138
  async rank({ targetId, targetText, corpus, limit = 10 })  :106-137
  if(typeof targetId !== 'string' || !targetId)  :108-110
  if(typeof targetText !== 'string')  :111-113
  for(const item of corpus)  :118-120
  for(const item of corpus)  :124-128
export const tokenize = (text) =>  :31-41
```

### server/ports/IBookmarkAnalysisService.js
```
export class IBookmarkAnalysisService  :44-54
  async analyzeSegment(req) → Promise<SegmentAnalysis>  :51-53
```

### server/ports/IRecommendationService.js
```
export class IRecommendationService  :32-44
  async rank(req) → Promise<SimilarityScore[]  :41-43
```

### server/services/BookmarkAnalysisService.js
```
export class BookmarkAnalysisService  :48-185
  constructor({ adapter, auditRepository, songRepository, padSeconds = DEFAULT_PAD_SECONDS, queueLimit = DEFAULT_QUEUE_LIMIT, } = {})  :49-66
  size()  :70-72
  isFull()  :74-76
  inFlightCount()  :78-80
  enqueue({ auditId, bookmarkId, startSeconds, endSeconds, audioId, filePath, youtubeUrl, ytId, padSeconds })  :82-103
  while(this.queue.length > 0 && this.inFlight < MAX_BACKGROUND_JOBS)  :109-120
  if(this.queue.length > 0)  :116-118
  if(!resolved.audioId && !resolved.filePath)  :131-134
```

### server/services/RecommendationService.js
```
export class RecommendationService  :29-88
  constructor({ adapter, techniqueRepository })  :30-35
  async findSimilarTechniques({ userId, techniqueId, limit = DEFAULT_LIMIT })  :37-87
  if(!target || target.deletedAt)  :43-47
  for(const r of ranked)  :71-78
```
