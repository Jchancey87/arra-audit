I used SigMap (npx sigmap --report, --analyze, --health, targeted queries, and direct file reads) to scan the architecture. Coverage is currently LOW (45%) because autoMaxTokens overrides your 10000 budget down to 4000, so I also read the hot-path files directly.
Here are the glaring issues I found, ranked by severity.
🔴 Critical — will break runtime
1. Undefined techniqueRepository in server/routes/audits.js
- createAuditRoutes(auditService, templateComposer) never receives techniqueRepository, but line 194 uses it in DELETE /trash/purge-all.
- Impact: Calling purge-all audits crashes the server with ReferenceError.
2. client/src/adapters/InMemoryBackendAdapter.js constructor references this.curricula before initialization
- this.curricula is never declared; line 36 calls this.curricula.push(...).
- Impact: Any code path that instantiates the in-memory adapter (Storybook, isolated UI tests) throws immediately.
3. Stale /tests directory is misleading and wrong
- agent_memory.md says tests live in root /tests, but Jest only runs server/__tests__ (default __tests__ pattern). The /tests files assert outdated field names:
- audit.status === 'completed' (service now defaults to 'draft')
- technique.category === 'rhythm' (service now stores lens)
- bookmark.timestamp (service stores timestampSeconds)
- Impact: Developers following the handoff will write failing tests.
🟠 High — security or architecture red flags
4. Analysis-service CORS is wide open with credentials
- analysis_service/app.py: allow_origins=["*"] + allow_credentials=True.
- Impact: CSRF/credential-leak risk.
5. Analysis callback webhook has no auth
- POST /api/public/songs/:id/analysis-completed in server/server.js accepts any payload.
- Impact: Anyone can inject fake analysis results.
6. JWT fallback secret is hardcoded
- server/middleware/auth.js and AuthService fall back to 'your-secret' if JWT_SECRET is missing.
- Impact: Production deployments with a missing env var are trivially forgeable.
7. authService.changePassword() leaks repository internals
- Checks this.userRepository.model to branch between Mongoose and in-memory paths. Services should not know whether the repo is Mongoose.
8. Curriculum allows lens 'form', but TechniqueEntry schema does not
- Curriculum.js day schema enum includes 'form'; TechniqueEntry.js and VALID_LENSES in techniqueService.js do not.
- Impact: Curriculum days tagged form will fail when synced to the technique notebook.
🟡 Medium — correctness, maintainability, config
9. SigMap config is self-defeating
- gen-context.config.json has "autoMaxTokens": true, which overrides your maxTokens: 10000 to 4000 and yields LOW-confidence context.
- Fix: set autoMaxTokens: false, or switch to "strategy": "per-module" for the monorepo.
10. Hardcoded localhost:5050 in Vite proxy
- client/vite.config.js hardcodes the backend target, contradicting the agent-memory rule to avoid hardcoded localhost strings.
11. .gitignore gaps
- Missing: .context/ (SigMap output), server/uploads/ (audio files), .venv/.
- Root already has a stray .HANDOFF.md.swp vim swap file.
12. No linting / formatting config
- No ESLint, Prettier, or Jest config file. Code style is inconsistent (e.g., mixed '/", trailing spaces, inline prompts).
13. server/routes/studyProgress.js bypasses repository port
- populateProgress() directly calls curriculumService.studyProgressRepository.model.findById(...).populate(...).lean(), leaking Mongoose into the route layer.
14. analyzer.py uses md5 and a legacy sonic_dna_temp prefix
- Minor rebrand residue and weak hashing for the deterministic fallback.
🟢 Low / polish
15. Soft-delete query patterns are inconsistent
- Some places use { deletedAt: null }, others { deletedAt: { $ne: null } }. Works because InMemoryRepository supports both, but fragile.
16. No rate limiting, input validation, or graceful MongoDB reconnection
- express-validator is installed but unused.
17. Server CORS is wide open
- app.use(cors()) with no origin restriction.
Suggested first pass (if you want me to fix)
1. Fix the two runtime crashes (audits.js scope bug + InMemoryBackendAdapter init).
2. Remove or repair the stale /tests directory and update agent_memory.md.
3. Lock down analysis-service CORS and add a shared-secret check to the analysis webhook.
4. Remove the JWT fallback secret (fail closed).
5. Reconcile the form lens across curriculum / technique schema.
6. Tune SigMap config and .gitignore.
Do you want me to proceed with these fixes, and should I prioritize the critical runtime bugs first?
▣  Plan · Kimi K2.7 Code · 7m 12s
can you create a high priority issue file so I can proceed with fixing these issues?
+ Thought: 3.6s
I’m still in read-only plan mode, so I can’t create files on disk right now. I can either:
1. Paste the issue content here so you can save it yourself, or  
2. Switch to implementation mode and create the file for you (plus fix the critical bugs if you want).
Here’s the content for HIGH_PRIORITY_ISSUES.md you can save in the repo root:
# High-Priority Issues — Arra Architecture Audit

> Generated from a SigMap-assisted architecture review.
> Severity: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 Critical — runtime crashes

### 1. `server/routes/audits.js` references undefined `techniqueRepository`
- **Location:** `server/routes/audits.js:194`
- **Problem:** `createAuditRoutes(auditService, templateComposer)` does not receive `techniqueRepository`, but `DELETE /trash/purge-all` uses it.
- **Fix:** Pass `techniqueRepository` into `createAuditRoutes` from `server.js`, or call `auditService.purgeAudit` without the extra arg.

### 2. `client/src/adapters/InMemoryBackendAdapter.js` uses `this.curricula` before initialization
- **Location:** `client/src/adapters/InMemoryBackendAdapter.js:36`
- **Problem:** `this.curricula` is never declared in the constructor.
- **Fix:** Add `this.curricula = [];` in the constructor before seeding the default curriculum.

### 3. Stale `/tests` directory is misleading and outdated
- **Location:** `/tests/**/*.test.js`
- **Problem:** Jest only runs `server/__tests__` by default. The root `/tests` files assert outdated field names (`status: 'completed'`, `technique.category`, `bookmark.timestamp`).
- **Fix:** Either delete `/tests` and update `agent_memory.md`, or update the tests to match current service behavior and configure Jest to run them.

---

## 🟠 High — security / architecture

### 4. Analysis-service CORS is wide open with credentials
- **Location:** `analysis_service/app.py:20-26`
- **Problem:** `allow_origins=["*"]` combined with `allow_credentials=True`.
- **Fix:** Restrict origins to the deployed backend URL.

### 5. Analysis callback webhook has no authentication
- **Location:** `server/server.js:87-113`
- **Problem:** `POST /api/public/songs/:id/analysis-completed` accepts any request.
- **Fix:** Add a shared-secret header/token check.

### 6. JWT fallback secret is hardcoded
- **Location:** `server/middleware/auth.js:11`, `server/services/authService.js:7`
- **Problem:** Falls back to `'your-secret'` if `JWT_SECRET` is missing.
- **Fix:** Fail closed (throw error) when `JWT_SECRET` is not set.

### 7. `authService.changePassword()` leaks repository abstraction
- **Location:** `server/services/authService.js:115-143`
- **Problem:** Service checks `this.userRepository.model` to branch between Mongoose and in-memory paths.
- **Fix:** Move password hashing to the repository adapter or add a `verifyPassword` / `setPassword` port method.

### 8. Curriculum allows lens `'form'` but `TechniqueEntry` does not
- **Location:** `server/models/Curriculum.js:7`, `server/models/TechniqueEntry.js:31`, `server/services/techniqueService.js:12`
- **Problem:** AI-generated or default curriculum days may use `form`, causing technique creation to fail validation.
- **Fix:** Add `'form'` to `TechniqueEntry` enum and `VALID_LENSES`, or remove it from `Curriculum`.

---

## 🟡 Medium — correctness / maintainability / config

### 9. SigMap config produces low-confidence context
- **Location:** `gen-context.config.json`
- **Problem:** `autoMaxTokens: true` overrides `maxTokens: 10000` down to `4000`.
- **Fix:** Set `autoMaxTokens: false` or switch to `"strategy": "per-module"`.

### 10. Hardcoded `localhost:5050` in Vite proxy
- **Location:** `client/vite.config.js:12`
- **Problem:** Contradicts the project rule to avoid hardcoded localhost strings.
- **Fix:** Read backend target from env var or use relative proxy target.

### 11. `.gitignore` gaps
- **Problem:** Missing `.context/`, `server/uploads/`, `.venv/`.
- **Fix:** Add them.

### 12. No linting / formatting config
- **Problem:** No ESLint, Prettier, or Jest config file; style is inconsistent.
- **Fix:** Add shared configs and npm scripts.

### 13. `studyProgress` route bypasses repository port
- **Location:** `server/routes/studyProgress.js:53-57`
- **Problem:** Direct Mongoose `.populate().lean()` calls in the route layer.
- **Fix:** Move population logic into a repository adapter or service method.

### 14. `analyzer.py` uses legacy `sonic_dna_temp` prefix and `md5`
- **Location:** `analysis_service/analyzer.py:139, 349-350`
- **Problem:** Rebrand residue; weak hash for deterministic fallback.
- **Fix:** Rename prefix to `arra_temp_`; use `hashlib.sha256` or better.

---

## 🟢 Low

### 15. Soft-delete query patterns are inconsistent
- Mix of `{ deletedAt: null }` and `{ deletedAt: { $ne: null } }`.
- Standardize on one pattern.

### 16. No rate limiting or input validation
- `express-validator` is installed but unused.
- Add validation middleware and rate limiters for auth/import routes.

### 17. Server CORS is wide open
- `server/server.js:50` uses `app.use(cors())` with no origin restriction.
- Restrict to known origins in production.

---

## Recommended execution order

1. Fix critical runtime bugs (#1, #2).
2. Remove/repair stale tests (#3).
3. Lock down security (#4, #5, #6, #7).
4. Reconcile schema enums (#8).
5. Tune tooling/config (#9, #10, #11, #12).
6. Refactor route-layer leaks (#13) and polish (#14-#17).
If you want me to create this file and start fixing the critical bugs, just say “switch to implementation mode” and I’ll proceed.
