# Arra Audit App - Dependency Assessment

## Dependency Classification & Seam Strategy

Using the framework: In-process → Local-substitutable → Remote but owned → True external (Mock)

---

## 1. IN-PROCESS Dependencies ✅ (Deepenable Now)

### 1.1 Authentication & Hashing
**Current:** `server/routes/auth.js` + `server/models/User.js`  
**Dependencies:** bcryptjs, jsonwebtoken (both pure computation)

**Assessment:**
- Pure computation, no I/O or side effects
- ✅ **Deepenable:** Merge into single `AuthService` module
- No adapter needed

**Recommendation:**
```
Create: server/services/authService.js
- Exports: registerUser(), loginUser(), verifyToken()
- Tests: Direct unit tests on functions, no seam
- Internal: No adapter needed (no dependencies on externals)
```

**Current Structure (Shallow):**
```
routes/auth.js → calls → models/User.js → calls → bcryptjs
```

**Recommended Structure (Deep):**
```
services/authService.js (single deep module)
├─ imports User model directly
├─ exports port: IAuthService
└─ tests: Direct calls, no adapter needed
```

---

### 1.2 Audit Template Generation Logic
**Current:** `server/services/auditGenerator.js`  
**Dependencies:** OpenAI API (external), fallback templates (pure computation)

**Assessment:**
- The **fallback template logic** is pure computation → in-process
- The **GPT-4 call** is external (see section 4)
- The **merge of research data + templates** is pure computation

**Current Problem:**
- Logic and external call are tangled in same function
- Can't test template-generation logic without mocking OpenAI

**Recommendation:**
```
Split into two modules:

1. server/services/templateComposer.js (IN-PROCESS)
   - Pure: mergeResearchWithTemplate(research, lens)
   - Pure: buildFallbackTemplate(song, lenses)
   - Tests: Direct calls, no mocks

2. server/services/aiModelAdapter.js (TRUE EXTERNAL)
   - Handles: OpenAI API calls
   - Injected dependency: template composer
   - Tests: Mock OpenAI responses
```

---

### 1.3 Technique Capture & Organization
**Current:** `server/routes/techniques.js` + `server/models/TechniqueEntry.js`  
**Dependencies:** MongoDB (Local-substitutable, see 2.1)

**Assessment:**
- Logic (filtering, categorizing, searching) is pure computation
- Persistence (MongoDB) is the dependency

**Recommendation:**
```
Create: server/services/techniqueService.js
- Exports: logTechnique(), searchByCategory(), filterByArtist()
- Takes injected: ITechniqueRepository (port)
- Tests:
  ├─ Real MongoDB tests (local instance)
  └─ OR in-memory repository adapter for unit tests
```

---

## 2. LOCAL-SUBSTITUTABLE Dependencies 🗄️

### 2.1 MongoDB
**Current:** Direct Mongoose connections in routes + models  
**Dependencies:** MongoDB server (production), need test stand-in

**Assessment:**
- ✅ Test stand-in exists: mongod local, or in-memory (for unit tests)
- Currently: Coupled directly, hard to test without DB running
- Seam: None exposed at interface; internal only

**Recommendation:**
```
Create: server/repositories/songRepository.js (port interface)
         server/repositories/auditRepository.js
         server/repositories/techniqueRepository.js

Define port:
  interface IRepository {
    create(doc): Promise<doc>
    findById(id): Promise<doc>
    update(id, data): Promise<doc>
    delete(id): Promise<void>
  }

Two adapters:
  1. MongooseRepository (production)
     └─ Uses real MongoDB via Mongoose

  2. InMemoryRepository (tests)
     └─ Stores in Map<id, doc>
     └─ No network call, instant

Test strategy:
  ✓ Unit tests: Use InMemoryRepository
  ✓ Integration tests: Use local mongod
  ✓ Production: Use MongooseRepository
```

**Why this works:**
- The deepened module owns the business logic
- The repository is injected at seam
- Tests don't need MongoDB running for fast feedback
- Integration tests verify against real MongoDB

**Current Problem:**
```
routes/songs.js → directly calls Song.findOne()
└─ Hard to test without MongoDB
└─ Can't run tests in parallel (DB state shared)
```

**Recommended Structure:**
```
services/songService.js (deep module)
├─ imports: IRepository (port)
├─ exports: importSong(), getSongs(), deleteSong()
└─ Tests inject: InMemoryRepository adapter

Production bootstrap:
├─ Instantiate: MongooseRepository()
└─ Inject into: songService.js

Test bootstrap:
├─ Instantiate: InMemoryRepository()
└─ Inject into: songService.js
```

---

## 3. REMOTE BUT OWNED Dependencies 🌐

### 3.1 Frontend ↔ Backend API (Currently Missing Ports)
**Current:** Direct HTTP coupling, tightly bound

**Assessment:**
- If backend and frontend deploy separately: **Remote but owned**
- Currently: No port defined, no adapter abstraction
- Backend: No formal interface (just routes)
- Frontend: Directly calls `/api/...` endpoints

**Recommendation (If Scaling):**
```
Define port: IBackendService
  interface IBackendService {
    importSong(url: string): Promise<Song>
    generateAudit(songId, lenses): Promise<AuditTemplate>
    saveAudit(auditData): Promise<Audit>
  }

Two adapters:

1. HttpBackendAdapter (production)
   └─ Calls: POST /api/songs/import, etc.
   └─ Handles: serialization, error codes

2. InMemoryBackendAdapter (tests)
   └─ Direct function calls
   └─ No network delay
   └─ Deterministic

Backend (server/index.ts):
├─ Exports: IBackendService interface
└─ Used by: HttpBackendAdapter for production

Frontend test:
├─ Injects: InMemoryBackendAdapter
└─ Tests run in milliseconds

Frontend production:
├─ Injects: HttpBackendAdapter
└─ Calls real API
```

**Status:** Not critical for current single-server deployment. Relevant if you split backend/frontend services later.

---

## 4. TRUE EXTERNAL Dependencies 🔗 (Requires Mocking)

### 4.1 OpenAI GPT-4 API
**Current:** `server/services/auditGenerator.js` → direct fetch call  
**Classification:** True external (don't control API, subject to outages/changes)

**Current Problem:**
```
auditGenerator.js:
  - Calls: fetch('https://api.openai.com/v1/chat/completions')
  - Tests: Can't run without internet + API key
  - Cost: Every test run costs money
  - Brittleness: If API changes, integration breaks
```

**Recommendation:**
```
Create port:
  interface IAIModelService {
    generateTemplate(prompt: string): Promise<string>
  }

Two adapters:

1. OpenAIAdapter (production)
   ├─ Calls: real OpenAI API
   ├─ Implements: IAIModelService
   └─ Cost: ~$0.01 per call

2. MockAIAdapter (tests)
   ├─ Returns: hardcoded template
   ├─ Implements: IAIModelService
   └─ Cost: $0
   └─ Speed: instant

Deep module: templateComposer.js
  ├─ Takes: IAIModelService (injected)
  ├─ Logic: mergeResearchWithTemplate()
  └─ Tests: Use MockAIAdapter
  └─ Fallback: Built-in default templates (no API call)

Seam: At templateComposer's input
  - Internal: Can call _buildFallbackTemplate() directly
  - External: Clients inject the AI adapter
```

**Test strategy:**
```javascript
// Unit test: Mock adapter, instant
test('generateTemplate adapts research', async () => {
  const mockAI = new MockAIAdapter();
  const composer = new TemplateComposer(mockAI);
  
  const template = await composer.generate('song title', ['rhythm'], 'research text');
  
  expect(template.lenses).toContain('rhythm');
  // No API call, completes in <1ms
});

// Integration test: Real API (optional, expensive)
test('generateTemplate works with real OpenAI', async () => {
  const realAI = new OpenAIAdapter(process.env.OPENAI_API_KEY);
  const composer = new TemplateComposer(realAI);
  
  // ... only run in CI with budget, or manually
});
```

---

### 4.2 Tavily Search API
**Current:** `server/services/tavilySearch.js` → axios call  
**Classification:** True external

**Current Problem:**
- Every song import triggers API call (costs money)
- Tests are slow (network latency)
- Hard to test error cases (rate limits, outages)

**Recommendation:**
```
Create port:
  interface ISearchService {
    searchSongInfo(title: string, artist: string): Promise<ResearchData>
  }

Two adapters:

1. TavilyAdapter (production)
   └─ Calls: real Tavily API

2. MockSearchAdapter (tests)
   └─ Returns: fake research data
   └─ Configurable: Can inject errors to test resilience

Deep module: songService.js
  ├─ Takes: ISearchService (injected)
  ├─ Logic: importSong() orchestrates research
  └─ Tests: Use MockSearchAdapter

Test cases:
  ✓ Song import with research (mock adapter returns data)
  ✓ Song import without research (mock adapter returns null)
  ✓ Song import with search error (mock adapter throws)
  ✓ Song import with timeout (mock adapter delays)
  └─ All instant, no network
```

---

### 4.3 YouTube
**Current:** Two uses:
1. `routes/songs.js` - metadata extraction (oembed endpoint)
2. `client/components/AudioPlayer.jsx` - video embedding

**Classification:** True external (don't control YouTube)

**Assessment:**
- Metadata: Currently optional (nice-to-have)
- Embedding: Essential for app to work

**Recommendation:**

**Backend (metadata):**
```
Create port:
  interface IVideoMetadataService {
    getMetadata(videoId: string): Promise<Metadata>
  }

Two adapters:

1. YouTubeOembedAdapter (production)
   └─ Calls: https://www.youtube.com/oembed
   └─ Free, no auth needed

2. MockVideoAdapter (tests)
   └─ Returns: fake metadata
   
songService.js:
  ├─ Takes: IVideoMetadataService (injected)
  ├─ Logic: importSong() enriches with metadata
  └─ Tests: Use mock adapter (no network call)

Fallback:
  - If oembed fails, gracefully continue
  - Tests always inject mock (no dependency on YouTube)
```

**Frontend (embedding):**
```
AudioPlayer.jsx:
  - Uses: <YouTube videoId={id} />
  - No abstraction needed for tests (UI tests are separate)
  - Mock: <MockVideoPlayer /> in tests
```

---

## 5. Cross-Cutting: HTTP Requests

**Current:** Mixed approaches
- `server/services/tavilySearch.js` - axios
- `server/services/auditGenerator.js` - fetch
- `client/utils/api.js` - axios

**Recommendation:**
```
Create: server/utils/httpClient.js
  - Centralizes: fetch logic, retry, timeout, error handling
  - Exports: http.post(), http.get()
  - Simplifies: testing (can mock one place)

All external API calls use it:
  ├─ tavilySearch.js → http.post(...)
  ├─ auditGenerator.js → http.post(...)
  └─ Any future API calls

For testing:
  - Mock httpClient once
  - All tests use mock
```

---

## Summary Table

| Dependency | Category | Current | Issue | Recommendation |
|---|---|---|---|---|
| **Auth logic** | In-process | Scattered | No deep module | Consolidate in `AuthService` |
| **Template logic** | In-process + External | Mixed | GPT-4 call tangled with logic | Split: `TemplateComposer` (logic) + `AIAdapter` (external) |
| **Technique logic** | In-process + Local | Routes+models | Can't test without DB | `TechniqueService` + `IRepository` port |
| **MongoDB** | Local-substitutable | Direct Mongoose | Hard to test in isolation | `IRepository` port + `InMemoryRepository` adapter |
| **OpenAI** | True external | Direct fetch | Expensive tests, no fallback path testable | `IAIModelService` port + `MockAIAdapter` |
| **Tavily** | True external | Direct axios | Slow tests, network-dependent | `ISearchService` port + `MockSearchAdapter` |
| **YouTube** | True external | Direct embed+oembed | Optional metadata fragile | `IVideoMetadataService` port + mock |
| **Frontend-Backend** | Remote but owned | Direct HTTP | No abstraction | `IBackendService` port (future scaling) |

---

## Immediate Actions (Ranked by Impact)

### Priority 1: True External APIs (Tests are Expensive)
1. **OpenAI** - Implement `IAIModelService` port + `MockAIAdapter`
   - Benefit: Tests run offline, instant, free
   - Effort: 2 hours
   - Payoff: Immediate 10x faster test suite

2. **Tavily** - Implement `ISearchService` port + `MockSearchAdapter`
   - Benefit: Tests don't depend on internet
   - Effort: 1.5 hours
   - Payoff: Parallel tests, no rate-limit issues

### Priority 2: Local-Substitutable (Better Test Isolation)
3. **MongoDB** - Implement `IRepository` port + `InMemoryRepository`
   - Benefit: Fast unit tests without DB
   - Effort: 3 hours
   - Payoff: Tests run in parallel, instant feedback

### Priority 3: In-Process (Code Quality)
4. **Auth** - Deep `AuthService` module
   - Benefit: Cleaner code, testable
   - Effort: 1 hour
   - Payoff: Easier maintenance

### Priority 4: Optional (Future-Proofing)
5. **Frontend-Backend port** - Only if splitting services
   - Skip for now; defer to production readiness review

---

## Implementation Example: OpenAI Adapter

**Before (Current - Tangled):**
```javascript
// server/services/auditGenerator.js
export async function generateAuditTemplate(songTitle, artist, researchSummary, lenses) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({...})
  });
  // Can't test without real API
  // Can't test error cases
  // Expensive to run tests
}
```

**After (Separated - Deep + Adapter):**
```javascript
// server/ports/IAIModelService.ts (interface/port)
export interface IAIModelService {
  generateTemplate(prompt: string): Promise<string>;
}

// server/adapters/OpenAIAdapter.ts (production)
export class OpenAIAdapter implements IAIModelService {
  async generateTemplate(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({...})
    });
    return response.choices[0].message.content;
  }
}

// server/adapters/MockAIAdapter.ts (tests)
export class MockAIAdapter implements IAIModelService {
  async generateTemplate(prompt: string): Promise<string> {
    return JSON.stringify({
      title: "Arra Audit",
      lenses: { rhythm: { questions: [...] } }
    });
  }
}

// server/services/templateComposer.ts (deep module, owns logic)
export class TemplateComposer {
  constructor(private aiService: IAIModelService) {}

  async generate(songTitle: string, lenses: string[], research: string): Promise<Template> {
    const prompt = this.buildPrompt(songTitle, lenses, research);
    const json = await this.aiService.generateTemplate(prompt);
    return JSON.parse(json);
  }

  // Pure logic, testable without AI adapter
  private buildPrompt(title: string, lenses: string[], research: string): string {
    return `Generate audit template for ${title}...`;
  }
}

// Test: Instant, no network, no cost
test('template composer generates audit for all lenses', async () => {
  const mockAI = new MockAIAdapter();
  const composer = new TemplateComposer(mockAI);

  const template = await composer.generate('Song', ['rhythm', 'harmony'], 'research');

  expect(template.lenses).toHaveProperty('rhythm');
  expect(template.lenses).toHaveProperty('harmony');
  // Completes in <1ms
});
```

---

## Testing Implications

**Old approach (no seams):**
```
❌ Tests can't run without:
  - MongoDB running
  - Internet connection
  - OpenAI API key + credit
  - Tavily API key
❌ Tests are slow (30s+)
❌ Can't test error paths
❌ Tests interfere with each other (shared DB state)
```

**New approach (with ports + adapters):**
```
✅ Unit tests: Use mock adapters
  - No dependencies
  - Run in parallel
  - <1ms each

✅ Integration tests: Use real services
  - Verify contracts
  - Run in CI only (costs money)

✅ Pyramid:
  - 80% unit tests (mock adapters)
  - 15% integration tests (real services, selective)
  - 5% end-to-end (full app)
```

---

## Seam Discipline Checklist

- [ ] **One adapter = hypothetical.** Don't create port unless two adapters exist (production + test)
- [ ] **Internal vs external seams.** Don't expose `InMemoryRepository` through public interface; it's internal to tests
- [ ] **Replace, don't layer.** When tests exist at deep module, delete old shallow module tests
- [ ] **Test behavior, not state.** Assert through interface (what observable changes), not internal DB state
- [ ] **Tests survive refactors.** If test breaks on internal change, you're testing implementation, not interface

---

**Next: Implement Priority 1 (OpenAI + Tavily adapters) to unlock fast, reliable tests. Ready?**
