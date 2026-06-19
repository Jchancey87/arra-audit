

## Auto-generated signatures
<!-- Updated by gen-context.js -->
You are a coding assistant with complete knowledge of this codebase.
The following code signatures were extracted by SigMap v7.0.1 on 2026-06-19T22:17:31.564Z.
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
server/__tests__/unit/SketchService.test.js ← ../services/SketchService, ../adapters/InMemoryRepository
server/adapters/InMemoryRepository.js ← ports/IRepository, ports/IUserRepository
server/adapters/MockAIAdapter.js ← ports/ICompletionService
server/adapters/MongooseRepository.js ← ports/IRepository, ports/IUserRepository, models/Curriculum, models/StudyProgress, models/User
server/adapters/OpenAIAdapter.js ← ports/ICompletionService
server/ports/IAIModelService.js ← ICompletionService
server/ports/IUserRepository.js ← IRepository
server/services/auditService.js ← models/Audit
client/src/App.jsx ← styles/global, context/AuthContext, context/AudioContext, pages/Login, pages/Dashboard
client/src/adapters/HttpBackendAdapter.js ← ports/IBackendService
client/src/adapters/InMemoryBackendAdapter.js ← ports/IBackendService
client/src/components/ComparePlayer.jsx ← context/AudioContext
client/src/components/__tests__/ComparePlayer.test.jsx ← ComparePlayer, ../context/AudioContext, ../context/BackendContext, ../adapters/InMemoryBackendAdapter
client/src/context/AudioContext.jsx ← BackendContext
client/src/hooks/__tests__/useSketches.test.jsx ← useSketches, ../context/BackendContext, ../adapters/InMemoryBackendAdapter
client/src/hooks/useAudit.js ← context/BackendContext
client/src/hooks/useAudits.js ← context/BackendContext
client/src/hooks/useCompletionCheck.js ← components/audit/lensConstants
client/src/hooks/useCurricula.js ← context/BackendContext
client/src/hooks/useDeepLinkParams.js ← utils/deepLinks
client/src/hooks/useSketches.js ← context/BackendContext
client/src/hooks/useSong.js ← context/BackendContext
client/src/hooks/useStudyProgress.js ← context/BackendContext
client/src/hooks/useTasteProfiles.js ← context/BackendContext
client/src/hooks/useTechniques.js ← context/BackendContext
client/src/pages/SketchCompare.jsx ← context/BackendContext, context/AudioContext, hooks/useSketches, components/ComparePlayer
client/src/pdf/AuditReport.jsx ← theme, utils/pdfData
client/src/utils/pdfData.js ← pdf/theme
analysis_service/analyzer.py ← requests
analysis_service/app.py ← fastapi, pydantic, analyzer
```

## changes (last 5 commits — 0 seconds ago)
```
server/__tests__/unit/SketchService.test.js   +mockFile
server/routes/sketches.js                     +_sanitizeSketch  +createSketchRoutes
server/services/SketchService.js              +SketchService
client/src/adapters/HttpBackendAdapter.js     ~HttpBackendAdapter
client/src/adapters/InMemoryBackendAdapter.js ~InMemoryBackendAdapter
client/src/components/ComparePlayer.jsx       +formatTime  +readMeta  +MetaRow  +DeltaBar
client/src/components/__tests__/ComparePlayer.test.jsx +StubAudioProvider  +makeWrapper
client/src/hooks/__tests__/useSketches.test.jsx +makeWrapper  +makeFile
client/src/hooks/useSketches.js               +useSketches
client/src/pages/SketchCompare.jsx            +SketchCompare  +Centered
client/src/ports/IBackendService.js           ~IBackendService
analysis_service/analyzer.py                  +analyze_sketch_file  ~download_and_analyze
analysis_service/app.py                       +SketchAnalysisRequest  +trigger_sketch_analysis  ~AnalysisRequest  ~trigger_analysis
.github/context-cold.md                       +ErrorBoundary  ~ClapAnalyzer  ~__init__  ~analyze_features
.github/copilot-instructions.md               +ClapAnalyzer  +__init__  +analyze_features  +get_clap_analyzer
.github/gemini-context.md                     +ClapAnalyzer  +__init__  +analyze_features  +get_clap_analyzer
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
h3 client/src/components/ErrorBoundary.jsx
h3 client/src/components/ResearchSummaryRenderer.jsx
h3 client/src/context/AuthContext.jsx
h3 client/src/context/BackendContext.jsx
h2 server
h3 server/adapters/MockSearchAdapter.js
h3 server/adapters/TavilyAdapter.js
h3 server/bin/seedCurriculum.js
h3 server/middleware/auth.js
h3 server/ports/ISearchService.js
h3 server/routes/curricula.js
h3 server/services/auditGenerator.js
h3 server/services/authService.js
h3 server/services/tavilySearch.js
h3 server/services/techniqueService.js
h2 skills
h3 skills/handoff_runner.md
code-fence plain
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
h2 analysis_service
h3 analysis_service/analyzer.py
h3 analysis_service/app.py
h2 client
h3 client/src/App.jsx
h3 client/src/adapters/HttpBackendAdapter.js
h3 client/src/adapters/InMemoryBackendAdapter.js
h3 client/src/components/ComparePlayer.jsx
h3 client/src/components/__tests__/ComparePlayer.test.jsx
h3 client/src/context/AudioContext.jsx
h3 client/src/hooks/__tests__/useSketches.test.jsx
h3 client/src/hooks/useAudit.js
h3 client/src/hooks/useAuditAutosave.js
h3 client/src/hooks/useAuditShortcuts.js
h3 client/src/hooks/useAudits.js
h3 client/src/hooks/useCompletionCheck.js
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
h2 analysis_service
h3 analysis_service/analyzer.py
h3 analysis_service/app.py
h2 client
h3 client/src/App.jsx
h3 client/src/adapters/HttpBackendAdapter.js
h3 client/src/adapters/InMemoryBackendAdapter.js
h3 client/src/components/ComparePlayer.jsx
h3 client/src/components/__tests__/ComparePlayer.test.jsx
h3 client/src/context/AudioContext.jsx
h3 client/src/hooks/__tests__/useSketches.test.jsx
h3 client/src/hooks/useAudit.js
h3 client/src/hooks/useAuditAutosave.js
h3 client/src/hooks/useAuditShortcuts.js
h3 client/src/hooks/useAudits.js
h3 client/src/hooks/useCompletionCheck.js
```

## analysis_service

### analysis_service/analyzer.py
```
class ClapAnalyzer  :44-112
  def __init__(model_name)
  def analyze_features(file_path, tags)
def get_clap_analyzer()  :117-124
def analyze_audio_file(file_path, yt_id)  :127-337  # Runs the audio analysis on the downloaded file
def download_and_analyze(youtube_url, yt_id, callback_url)  :340-432  # Downloads audio via yt-dlp to a temporary directory, analyze
def analyze_sketch_file(file_path, sketch_id, callback_url)  :435-469  # Analyze a user-uploaded DAW sketch (local file path, no yt-d
```

### analysis_service/app.py
```
class AnalysisRequest(BaseModel) {song_id*, youtube_url*, yt_id*, callback_url?}  :33-37
class SketchAnalysisRequest(BaseModel) {sketch_id*, file_path*, callback_url?}  :39-42
def health()  :45-46
def trigger_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks)  :49-70  # Triggers an asynchronous audio analysis job
def trigger_sketch_analysis(request: SketchAnalysisRequest)  :73-100  # Synchronously analyze an uploaded DAW sketch from a local fi
GET /health  →  health()  :45-46
POST /analyze  →  trigger_analysis()  :49-70
POST /analyze-sketch  →  trigger_sketch_analysis()  :73-100
```

## client

### client/src/App.jsx
```
function App()  :736-748
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
export class InMemoryBackendAdapter  :7-32
  constructor()  :8-32
```

### client/src/components/ComparePlayer.jsx
```
function formatTime(seconds)  :15-21
function readMeta(analysis)  :23-31
function MetaRow({ label, ref, sk })  :33-43
function DeltaBar({ delta })  :45-66
function DeltaPanel({ refMeta, skMeta })  :68-91
function SketchEnergyCanvas({ audioRef })  :93-159
function PlayIcon()  :161-163
function PauseIcon()  :164-166
function Panel({ color, label, sublabel, time, duration, onScrub })  :343-367
```

### client/src/components/__tests__/ComparePlayer.test.jsx
```
function StubAudioProvider({ children })  :12-15
function makeWrapper(backend)  :17-25
```

### client/src/context/AudioContext.jsx
```
export const AudioProvider = ({ children }) =>  :8-150
export const useAudio = () =>  :375-381
```

### client/src/hooks/__tests__/useSketches.test.jsx
```
function makeWrapper(backend)  :8-12
function makeFile(name = 'sketch.wav', size = 2048, type = 'audio/wav')  :14-16
```

### client/src/hooks/useAudit.js
```
export function useAudit(auditId, { skip = false } = {})  :16-136
```

### client/src/hooks/useAuditAutosave.js
```
export function useAuditAutosave(auditId, responses, save, delay = 3000) → { saveStatus, markDirty  :15-52
export function useAnalysisPolling(song, refetchSong, intervalMs = 4000)  :61-71
export function useAnalysisProgressSim(song)  :87-112
```

### client/src/hooks/useAuditShortcuts.js
```
export function useAuditShortcuts({ togglePlay, hasArrangementLens, currentTime, onAddMarker })  :15-31
```

### client/src/hooks/useAudits.js
```
export function useAudits(filters = {})  :15-101
```

### client/src/hooks/useCompletionCheck.js
```
export function useCompletionCheck(audit, responses, activeLens, sessionTechniques) → { canComplete: boolean, c  :14-48
```

### client/src/hooks/useCurricula.js
```
export function useCurricula()  :10-64
```

### client/src/hooks/useDeepLinkParams.js
```
export function useDeepLinkParams()  :13-19
```

### client/src/hooks/useSketches.js
```
export function useSketches(songId = null)  :15-99
```

### client/src/hooks/useSong.js
```
export function useSong(songId, { skip = false } = {})  :13-78
```

### client/src/hooks/useStudyProgress.js
```
export function useStudyProgress()  :14-131
```

### client/src/hooks/useTasteProfiles.js
```
export function useTasteProfiles()  :12-58
```

### client/src/hooks/useTechniques.js
```
export function useTechniques(filters = {}, { skip = false } = {})  :14-87
```

### client/src/pages/SketchCompare.jsx
```
function Centered({ children })  :202-208
```

### client/src/pdf/AuditReport.jsx
```
function CoverPage({ data })  :280-351
function LensPages({ data })  :353-408
function BookmarksPage({ data })  :410-436
function TechniquesPage({ data })  :438-466
function PageFooter({ pageNumber, totalPages })  :468-480
```

### client/src/pdf/theme.js
```
export function registerArraFonts()  :18-48
```

### client/src/ports/IBackendService.js
```
export class IBackendService  :7-70
  async login(email, password)  :9-9
  async register(email, password, name)  :10-10
  async getUserProfile()  :11-11
  async updatePreferences(preferences)  :12-12
  async updateProfile(profileData)  :13-13
  async changePassword(oldPassword, newPassword)  :14-14
  async deleteAccount()  :15-15
  async getSongs(filters)  :18-18
```

### client/src/utils/deepLinks.js
```
export const buildAuditLink = (auditId, { timestampSeconds, bookmarkId } = {}) =>  :22-33
export const parseDeepLinkParams = (searchString) =>  :35-44
```

### client/src/utils/pdfData.js
```
export function prepareReportData(audit, song)  :116-156
function formatTimestamp(seconds)  :11-17
function formatDuration(seconds)  :19-25
function firstDefined(obj, keys)  :27-33
function pickLensAudio(song)  :35-45
function normalizeResponseEntry(raw)  :47-62
function lensEntriesFor(responses, lens)  :64-85
function normalizeBookmark(bm)  :87-100
function normalizeTechnique(t)  :102-114
```

### client/src/utils/pdfExport.jsx
```
export async function loadPdfRenderer()  :6-20
export async function renderAuditToBlob(audit, song)  :22-37
export function downloadBlob(blob, filename)  :39-50
export function buildAuditFilename(audit, song)  :52-57
```

## server

### server/__tests__/unit/SketchService.test.js
```
function mockFile({ originalname = 'sketch.wav', mimetype = 'audio/wav', size = 1024, filename = 'sketch-1.wav', path: filePath = '/tmp/sketch-1.wav' } = {})  :5-7
```

### server/adapters/InMemoryRepository.js
```
export class InMemoryRepository  :21-189
  constructor()  :22-26
  if(op === '$ne')  :55-61
  if(opVal === null)  :56-58
  if(opVal === null)  :62-64
  if(docVal !== null && docVal !== undefined)  :71-73
  if(docVal !== value)  :76-78
  async create(data)  :84-94
  async findById(id)  :96-99
export class InMemoryUserRepository  :261-328
  constructor()  :262-265
  async create(data)  :267-269
  async findById(id)  :271-273
  async findOne(query)  :275-277
  async updateById(id, data)  :279-281
  async deleteById(id)  :283-285
  async exists(query)  :287-289
  async find(query, options)  :291-293
```

### server/adapters/MockAIAdapter.js
```
export class MockAIAdapter  :59-82
  constructor(responseOverride = null)  :60-63
  async completeJson(prompt)  :65-72
  if(this.responseOverride != null)  :66-70
  async completeText(prompt)  :74-81
  if(this.responseOverride != null)  :75-79
```

### server/adapters/MongooseRepository.js
```
export class MongooseRepository  :19-145
  constructor(model)  :20-26
  if(!model)  :22-24
  async create(data)  :28-35
  async findById(id)  :37-43
  async findByIdWithRelations(id, relations = [])  :45-58
  for(const relation of relations)  :49-52
  async find(query = {}, options = {})  :60-84
  if(options.sort)  :65-67
export class CurriculumRepository  :147-151
  constructor()  :148-150
export class StudyProgressRepository  :153-157
  constructor()  :154-156
export class UserRepository  :164-250
  constructor(model)  :165-171
  if(!model)  :167-169
  async create(data)  :173-180
  async findById(id)  :182-188
  async findOne(query)  :190-196
  async updateById(id, data)  :198-213
  if(!doc)  :205-207
  async deleteById(id)  :215-222
export class MongooseUserRepository  :252-256
  constructor()  :253-255
```

### server/adapters/OpenAIAdapter.js
```
export class OpenAIAdapter  :17-81
  constructor(apiKey = process.env.OPENAI_API_KEY)  :18-23
  if(!this.apiKey)  :26-28
  if(!response.ok)  :44-47
  async completeText(prompt)  :53-59
  async completeJson(prompt)  :61-80
  if(!jsonMatch)  :71-73
```

### server/ports/IAIModelService.js
```
export class IAIModelService  :14-33
  async generateCompletion(prompt) → Promise<string>  :20-22
  async generateTemplate(prompt) → Promise<string>  :29-32
```

### server/ports/ICompletionService.js
```
export class ICompletionService  :17-37
  async completeText(prompt) → Promise<string>  :24-26
  async completeJson(prompt) → Promise<Object>  :34-36
```

### server/ports/IRepository.js
```
export class IRepository  :11-114
  async create(data) → Promise<Object>  :18-20
  async findById(id) → Promise<Object|null>  :28-30
  async findByIdWithRelations(id, relations = []) → Promise<Object|null>  :39-41
  async find(query, options = {}) → Promise<Array>  :50-52
  async findOne(query) → Promise<Object|null>  :60-62
  async updateById(id, data) → Promise<Object>  :71-73
  async deleteById(id) → Promise<boolean>  :81-83
  async deleteMany(query) → Promise<number>  :91-93
```

### server/ports/IUserRepository.js
```
export class IUserRepository  :14-36
  async verifyPassword(entityId, candidatePassword) → Promise<Object>  :22-24
  async setPassword(entityId, newPassword) → Promise<Object>  :33-35
```

### server/routes/sketches.js
```
function _sanitizeSketch(s)  :37-58
```

### server/routes/songs.js
```
function extractYouTubeId(url)  :13-25
function _sanitizeSong(song)  :256-282
```

### server/services/SketchService.js
```
export class SketchService  :11-131
  constructor(sketchRepository, songRepository, { analysisServiceUrl, logger = console } = {})  :12-18
  async assertSongOwned(songId, userId)  :20-33
  if(!song)  :23-27
  async createSketch({ userId, songId, file, title = '', notes = '' })  :35-69
  if(file.size > DEFAULT_LIMITS.maxFileBytes)  :48-52
  async getSketchesForSong(songId, userId)  :71-78
  async getSketch(id, userId)  :80-93
  if(!sketch || sketch.deletedAt)  :82-86
```

### server/services/auditService.js
```
export class AuditService  :13-154
  constructor(auditRepository, techniqueRepository, songRepository)  :14-21
  if(!auditRepository)  :15-17
  async createAudit(auditData) → Promise<Object>  :33-91
  if(lensSelection.length === 0)  :49-51
  if(this.songRepository)  :54-57
  async getSongContext(songId, userId) → Promise<Object|null>  :104-112
  async getAudit(auditId, userId)  :114-120
  async getAuditsForSong(songId, userId)  :122-131
```

### server/services/curriculumService.js
```
export class CurriculumService  :1-101
  constructor(curriculumRepository, studyProgressRepository, songRepository, auditService, techniqueRepository, aiAdapter)  :2-9
  async generateAICurriculum(userId, focusArea, pastTechniques = []) → Promise<Object>  :19-74
  if(!this.aiAdapter)  :20-22
  async saveCustomCurriculum(userId, curriculumData)  :79-88
  async getPopulatedStudyProgress(id)  :93-98
```

### server/services/songService.js
```
export class SongService  :11-118
  constructor(songRepository, searchService, aiService)  :12-17
  async importSong(songData, research) → Promise<Object>  :31-118
  if(!title || !resolvedSourceId || !userId)  :55-57
  if(existing)  :67-72
  if(research && research.results?.length > 0 && this.aiService)  :75-116
  if(aiSummary && aiSummary.overview)  :100-112
```

### server/services/tasteService.js
```
export class TasteService  :1-92
  constructor(tasteProfileRepository, searchService, aiService)  :2-9
  if(!tasteProfileRepository)  :3-5
  async getProfilesForUser(userId) → Promise<Array>  :17-19
  async executeDeepDive(userId, lens, name) → Promise<Object>  :29-92
  if(!lens || !name)  :30-32
  if(this.searchService)  :39-47
  if(sources.length > 0)  :51-55
  if(this.aiService)  :75-83
```

### server/services/templateComposer.js
```
export class TemplateComposer  :24-121
  constructor(completionService)  :25-30
  if(!completionService)  :26-28
  async generateTemplate(songTitle, artist, lenses, researchSummary = '', tastes = null) → Promise<Object>  :42-66
  if(!songTitle || !artist || !lenses || lenses.length === 0)  :44-46
  if(invalidLenses.length > 0)  :50-52
  if(tastes)  :80-95
  if(taste && typeof taste === 'object')  :84-86
  if(entries)  :91-94
```
