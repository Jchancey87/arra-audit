# 🧠 Agent Memory — Sonic DNA Audit System
> Machine-readable quick-reference. Updated at the end of every session.
> Start every session by reading this file first. Then check `devlogs.md` for architectural rationale.

---

## Project At A Glance
- **What it is**: A music production study tool. Users import songs from YouTube, run structured "audits" through musical lenses (Rhythm, Texture, Harmony, Arrangement), log techniques to a notebook, and review their history.
- **Stack**: React + Vite (client, port 3050) · Express + Mongoose (server, port 5050) · FastAPI Python microservice (audio analysis) · MongoDB · YouTube IFrame API · Tavily web search · OpenRouter LLM
- **Repo**: `https://github.com/Jchancey87/Sonic_DNA` — branch `main` is production
- **Dev command**: `npm run dev` from project root (runs client + server concurrently via concurrently package)
- **Deploy**: PM2 on Proxmox VM — user runs `deploy.sh` manually in the production folder after pulling

---

## Key File Map

### Client (`client/src/`)
| File | Purpose |
|---|---|
| `App.jsx` | Root layout: global AudioContext, triple-pane (Navigator / Workspace / Inspector), routing |
| `styles/global.js` | Design tokens — shared inline style objects used across all pages |
| `context/AudioContext.jsx` | Global audio state: `activeSong`, `currentTime`, `play/pause/seekTo/loadSong` — wraps react-youtube |
| `adapters/HttpBackendAdapter.js` | All API calls to Express server (prod) |
| `adapters/InMemoryBackendAdapter.js` | Mock adapter for local dev/testing without a server |
| `pages/AuditForm.jsx` | Main audit editing page — lens widgets, technique logger, guided steps, signal analysis |
| `pages/AuditDetail.jsx` | Read-only audit review page |
| `pages/Dashboard.jsx` | Song library cards with collapsible audit history, Load/Import controls |
| `pages/TechniqueNotebook.jsx` | 3-tab center: Library grid · Practice Room (Kanban) · Quick Log |
| `pages/ImportSong.jsx` | YouTube URL import with live 5-step progress animation |
| `pages/Settings.jsx` | Profile, password, account, timezone |
| `pages/Trash.jsx` | Soft-delete archive with restore/purge/bulk empty |
| `components/ArrangementTimelineWidget.jsx` | ⭐ DAW-style arrangement editor — bars/secs ruler, multi-track instrument lanes |
| `components/AudioPlayer.jsx` | Tape deck UI (transport controls, scrubber, bookmarks) |
| `components/TechniqueDetailModal.jsx` | Full technique detail modal |

### Server (`server/`)
| File | Purpose |
|---|---|
| `server.js` | Express entry, mounts all routes, connects Mongoose |
| `models/Audit.js` | Audit schema (see Data Models below) |
| `models/Song.js` | Song schema (see Data Models below) |
| `models/TechniqueEntry.js` | Notebook technique entries |
| `models/User.js` | User (bcrypt passwords, timezone) |
| `routes/audits.js` | CRUD + LLM template generation + analysis webhook |
| `routes/songs.js` | CRUD + import + analysis trigger + override |
| `routes/techniques.js` | CRUD for TechniqueEntry collection |
| `routes/auth.js` | Login, profile, password, delete account |
| `adapters/TavilyAdapter.js` | Web search (6 results, text-only domains, 600 char/result) |
| `services/` | Business logic layer (SongService, AuditService, TechniqueService, tavilySearch) |

### Analysis Microservice (`analysis_service/`)
| File | Purpose |
|---|---|
| `app.py` | FastAPI app, BackgroundTasks, webhook callback to Node server |
| `analyzer.py` | yt-dlp download → Essentia/madmom/librosa analysis (with deterministic fallback) |

---

## Data Models (key fields only)

### Song
```js
{
  _id, userId,
  sourceType: 'youtube',  sourceId,  youtubeId,  originalUrl,
  title,  artistName,  artist,  channelTitle,  thumbnailUrl,  thumbnail,
  durationSeconds,  publishedAt,
  metadataFetchStatus: 'pending|success|failed',
  researchStatus: 'pending|success|failed|skipped',
  researchSummary: Mixed,   // { summary, results: [{title, url, content, score}] }
  audioAnalysisStatus: 'not_started|pending|success|failed',
  audioAnalysis: Mixed,     // BPM, key, scale, meter, loudness curves etc.
  audioOverrides: { tempo_bpm, key, scale, estimated_meter },  // user manual edits
  deletedAt: Date|null      // soft delete
}
```

### Audit
```js
{
  _id, songId, userId,
  title,
  lensSelection: ['rhythm','texture','harmony','arrangement'],
  workflowType: 'quick|guided',
  templateQuestions: Mixed,   // LLM-generated per-lens questions
  templateVersion,  modelUsed,  promptVersion,
  responses: Mixed,           // free-form key/value bag — see Response Keys below
  bookmarks: [{ timestampSeconds, label, note, lens }],
  techniques: [{ description, lens, exampleTimestamp }],  // lightweight inline copy
  guidedSteps: [{ stepNumber, name, status, notes, skipped, startedAt, completedAt }],
  status: 'draft|completed|archived',
  completedAt,  deletedAt
}
```

### TechniqueEntry
```js
{
  _id, auditId, songId, userId,
  description, lens, exampleTimestamp,
  artist, title,           // denormalized from song for quick display
  tags: [String],
  nextAction: 'Backlog|Study|Practice|Transcribe|Apply|Revisit',
  confidenceRating: 1-5,
  practiceNotes: String
}
```

---

## Audit `responses` Key Reference
The `responses` field is a freeform `Mixed` map. These are the known keys written by widgets:

| Key | Written by | Format |
|---|---|---|
| `arrangement-timeline` | `ArrangementTimelineWidget` | JSON string — array of section block objects |
| `arrangement-bpm` | `ArrangementTimelineWidget` | String (number, e.g. `"128"`) |
| `arrangement-view-mode` | `ArrangementTimelineWidget` | `"bars"` or `"seconds"` |
| `arrangement-tracks` | `ArrangementTimelineWidget` | JSON string — array of track objects |
| `arrangement-q0` … `arrangement-qN` | `ArrangementTimelineWidget` | Free text answers to lens questions |
| `rhythm-q0` … etc. | Other lens widgets | Free text |

### `arrangement-timeline` block shape
```js
{
  id: 'block-<timestamp><random>',
  name: 'Verse 1',
  type: 'intro|verse|chorus|bridge|outro|pre-chorus|solo|custom',
  startTime: Number,   // seconds (source of truth)
  duration: Number,    // seconds (source of truth)
  notes: String        // production cues / observations
}
```

### `arrangement-tracks` track shape
```js
{
  id: 'track-<timestamp><random>',
  name: 'Lead Vocals',
  category: 'vocals|rhythm|bass|synth|guitar|brass|strings|fx',
  color: '#a78bfa',    // from TRACK_CATEGORIES defaults
  emoji: '🎤',
  blocks: [
    {
      id: 'tb-<timestamp><random>',
      startTime: Number,  // seconds
      duration: Number    // seconds
    }
  ]
}
```

---

## Design System

### Colors
```
Background canvas:     #0a0a0c
Panel / chrome:        #141418
Surface:               #111114
Input / control bg:    #161619
Deep inset:            #0c0c0f, #070709, #08080b

Primary accent:        #d08f60  (amber/orange — active states, CTAs)
Destructive:           #f43f5e  (rose red — delete actions only)
Playhead:              #f43f5e  (same red)

Section type colors:
  intro:        #fbbf24  (amber)
  verse:        #34d399  (emerald)
  chorus:       #a78bfa  (violet)
  bridge:       #fb7185  (rose)
  outro:        #9ca3af  (gray)
  pre-chorus:   #22d3ee  (cyan)
  solo:         #f97316  (orange)
  custom:       #f472b6  (pink)

Track category colors:
  vocals:   #a78bfa   rhythm:  #34d399   bass:    #fbbf24   synth:   #22d3ee
  guitar:   #fb7185   brass:   #f97316   strings: #f472b6   fx:      #9ca3af

Border:   1px solid rgba(255,255,255,0.08)  (standard)
          1px solid rgba(255,255,255,0.05)  (subtle)
```

### Typography
```
Interface labels:   system-ui, -apple-system, sans-serif  (Inter via Google Fonts in index.html)
Monospace / codes:  "Roboto Mono", monospace
Heading size:       13–14px  (this is a dense, information-heavy UI — not a marketing site)
```

### ArrangementTimelineWidget constants
```js
PX_PER_SEC    = 6     // horizontal zoom: pixels per second
GUTTER_W      = 140   // left label column width
SECTION_ROW_H = 114   // height of sections row
TRACK_ROW_H   = 46    // height of each instrument track lane
```
Bar math (4/4 assumed):
```js
barDurSecs(bpm)  = (60 / bpm) * 4
secToBar(s, bpm) = Math.floor(s / barDurSecs(bpm)) + 1
barToSec(b, bpm) = (b - 1) * barDurSecs(bpm)
```

---

## Architecture Patterns to Know

1. **Port/Adapter (Hexagonal)**: All server business logic lives in `services/`. Routes call services. Services call adapter interfaces defined in `ports/`. Never put DB queries in routes.
2. **InMemory swappable**: `InMemoryBackendAdapter` mirrors `HttpBackendAdapter` exactly — used for offline dev and tests. Do not break this parity when adding new HTTP calls.
3. **Audio context is global**: Everything audio-related goes through `useAudio()` hook from `AudioContext.jsx`. Never instantiate a player locally.
4. **responses is a free bag**: The `Audit.responses` field is `Mixed` in Mongoose — you can add new response keys from the frontend without any schema migration. Just document them above.
5. **Soft deletes everywhere**: Songs and Audits use `deletedAt: null` for active records. Always filter `deletedAt: null` in queries.

---

## Ports (server) — key interfaces
- `server/ports/ISongRepository.js` — interface contract for song persistence
- `server/ports/IAuditRepository.js` — interface contract for audit persistence
- `server/adapters/MongoSongRepository.js` / `InMemoryRepository.js` — implementations

---

## Known Gotchas / Lessons Learned

- **YouTube `controls: 0`** blocks embedding on many videos. Always use `controls: 1`.
- **YouTube error 101/150** = "embedding blocked by owner." Show fallback link, not broken player.
- **`pointerEvents: none` on iframes** breaks browser autoplay unlock gesture. Never do this.
- **Tavily `topic` param** causes 400 if set to `'music'`. Omit it.
- **InMemoryRepository `$ne` operator**: Mock must explicitly handle `$ne`, `$eq`, and `null` matching (null matches undefined/missing fields in Mongo).
- **PM2 + venv path**: Resolve `yt-dlp` relative to `sys.executable` in `analyzer.py` — PM2 doesn't inherit shell PATH.
- **Vite proxy**: Set `VITE_API_URL=/api` (relative) and `host: true` in vite.config. Never hardcode `localhost` in the env.

---

## Open TODOs / Feature Ideas (as of 2026-06-06)
- [ ] Time signature selector (3/4, 6/8) in ArrangementTimelineWidget — currently hardcoded 4/4
- [ ] Horizontal zoom control (PX_PER_SEC slider) in timeline
- [ ] Multi-select and bulk-delete track blocks
- [ ] Track block label editing (right now name is track name; could allow per-block labels)
- [ ] Export arrangement as image/PDF
- [ ] Arrangement read-only view in AuditDetail needs track lanes too (currently only shows sections)

---

## Session Log
| Date | Summary | Commit |
|---|---|---|
| 2026-05-22 | DAW theme, global AudioContext, YouTube persistent player, route sync | — |
| 2026-05-22 | Trash/archive, soft-delete cascade, InMemoryRepo operator fixes, Vite network exposure | — |
| 2026-05-22 | Critical bug fixes: audit review nav, YouTube controls, technique persistence, Tavily quality, audio unlock | — |
| 2026-05-22 | Technique Notebook overhaul: 3-tab layout, Kanban Practice Room, inline auto-save | — |
| 2026-05-24 | Branding cleanup, dynamic footer, profile mutations, compact Kanban cards, bulk trash purge | — |
| 2026-05-25 | ArrangementTimelineWidget v1: flex-based section blocks, drag-resize, playhead, keyboard shortcuts | — |
| 2026-05-25 | Tavily domain exclusion (streaming/social), removed invalid `topic` param | — |
| 2026-05-31 | Python FastAPI audio analysis service (Essentia/madmom/librosa + deterministic fallback), Node webhook, Tap Tempo UI | — |
| 2026-06-06 | ArrangementTimelineWidget v2: BPM autofill, BARS/SECS ruler toggle (4/4), multi-track instrument lanes, drag-move/resize track blocks, shared scroll, track block inspector | `b6f3e75` |
