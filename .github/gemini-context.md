

## Auto-generated signatures
<!-- Updated by gen-context.js -->
You are a coding assistant with complete knowledge of this codebase.
The following code signatures were extracted by SigMap v6.14.0 on 2026-06-07T20:42:22.905Z.

These signatures represent every public function, class, and type in the project.
Refer to them when answering questions about code structure, APIs, and implementation.
Before answering questions about specific code areas, suggest running `sigmap ask "<query>"` to get the most relevant files. After config changes, `sigmap validate` confirms coverage.

## Code Signatures

## deps
```
client/src/adapters/HttpBackendAdapter.js ← ports/IBackendService
client/src/adapters/InMemoryBackendAdapter.js ← ports/IBackendService
client/src/pages/AuditForm.jsx ← context/BackendContext, context/AudioContext, components/ArrangementTimelineWidget
analysis_service/analyzer.py ← requests
analysis_service/app.py ← fastapi, pydantic, analyzer
```

## analysis_service

### analysis_service/analyzer.py
```
def analyze_audio_file(file_path, yt_id)  :36-203  # Runs the audio analysis on the downloaded file
def download_and_analyze(youtube_url, yt_id, callback_url)  :206-298  # Downloads audio via yt-dlp to a temporary directory, analyze
```

### analysis_service/app.py
```
class AnalysisRequest(BaseModel) {song_id*, youtube_url*, yt_id*, callback_url?}  :28-32
def health()  :35-36
def trigger_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks)  :39-60  # Triggers an asynchronous audio analysis job
GET /health  →  health()  :35-36
POST /analyze  →  trigger_analysis()  :39-60
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
export class InMemoryBackendAdapter  :7-150
  constructor()  :8-15
  async login(email, password)  :18-27
  async register(email, password, name)  :29-38
  async getUserProfile()  :40-43
  async updatePreferences(preferences)  :45-52
  async updateProfile(profileData)  :54-63
  async changePassword(oldPassword, newPassword)  :65-68
  async deleteAccount()  :70-73
```

### client/src/pages/AuditForm.jsx
```
function useAutosave(auditId, data, backend, delay = 3000)  :8-45
function formatTime(seconds)  :48-51
```

### client/src/ports/IBackendService.js
```
export class IBackendService  :7-51
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

### server/routes/songs.js
```
function extractYouTubeId(url)  :12-24
function _sanitizeSong(song)  :252-278
```

### server/services/songService.js
```
export class SongService  :11-116
  constructor(songRepository, searchService, aiService)  :12-17
  async importSong(songData, research) → Promise<Object>  :31-116
  if(!title || !resolvedSourceId || !userId)  :55-57
  if(existing)  :67-72
  if(research && research.results?.length > 0 && this.aiService)  :75-116
  if(aiSummary && aiSummary.overview)  :100-112
```
