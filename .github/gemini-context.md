

## Auto-generated signatures
<!-- Updated by gen-context.js -->
You are a coding assistant with complete knowledge of this codebase.
The following code signatures were extracted by SigMap v6.14.0 on 2026-06-13T11:41:07.350Z.

These signatures represent every public function, class, and type in the project.
Refer to them when answering questions about code structure, APIs, and implementation.
Before answering questions about specific code areas, suggest running `sigmap ask "<query>"` to get the most relevant files. After config changes, `sigmap validate` confirms coverage.

## Code Signatures

## deps
```
server/adapters/MongooseRepository.js ← ports/IRepository, models/Curriculum, models/StudyProgress
server/bin/seedCurriculum.js ← models/Curriculum
server/routes/curricula.js ← models/Curriculum
client/src/App.jsx ← styles/global, context/AuthContext, context/AudioContext, pages/Login, pages/Dashboard
client/src/adapters/HttpBackendAdapter.js ← ports/IBackendService
client/src/adapters/InMemoryBackendAdapter.js ← ports/IBackendService
client/src/pages/AuditForm.jsx ← context/BackendContext, context/AudioContext, components/ArrangementTimelineWidget
analysis_service/analyzer.py ← requests
```

## changes (last 5 commits — 0 seconds ago)
```
server/adapters/MongooseRepository.js         +CurriculumRepository  +StudyProgressRepository  ~MongooseRepository
server/bin/seedCurriculum.js                  +formatLabel  +seed
server/routes/curricula.js                    +formatLabel  +createCurriculumRoutes
server/services/curriculumService.js          +CurriculumService
client/src/adapters/HttpBackendAdapter.js     ~HttpBackendAdapter
client/src/adapters/InMemoryBackendAdapter.js ~InMemoryBackendAdapter
client/src/ports/IBackendService.js           ~IBackendService
analysis_service/analyzer.py                  ~ClapAnalyzer
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
```

## client

### client/src/App.jsx
```
function App()  :584-596
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

### client/src/pages/AuditForm.jsx
```
function useAutosave(auditId, data, backend, delay = 3000)  :8-45
function formatTime(seconds)  :48-51
```

### client/src/ports/IBackendService.js
```
export class IBackendService  :7-63
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

### server/adapters/MongooseRepository.js
```
export class MongooseRepository  :16-127
  constructor(model)  :17-23
  if(!model)  :19-21
  async create(data)  :25-32
  async findById(id)  :34-40
  async find(query = {}, options = {})  :42-66
  if(options.sort)  :47-49
  if(options.limit)  :50-52
  if(options.skip)  :53-55
export class CurriculumRepository  :129-133
  constructor()  :130-132
export class StudyProgressRepository  :135-139
  constructor()  :136-138
```

### server/bin/seedCurriculum.js
```
function formatLabel(key)  :14-24
async function seed()  :193-212
```

### server/routes/curricula.js
```
function formatLabel(key)  :4-14
```

### server/services/curriculumService.js
```
export class CurriculumService  :1-103
  constructor(curriculumRepository, studyProgressRepository, songRepository, auditService, techniqueRepository, aiAdapter)  :2-9
  async generateAICurriculum(userId, focusArea, pastTechniques = []) → Promise<Object>  :19-76
  if(!this.aiAdapter)  :20-22
  async saveCustomCurriculum(userId, curriculumData)  :81-90
  async startCurriculum(userId, curriculumId)  :95-103
  if(existing)  :97-99
  if(!curriculum)  :102-103
```
