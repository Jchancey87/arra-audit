# 🧠 Active Agent Memory — Arra

## 🎯 Active Session Focus (Intent)
- **Goal**: GTX 1050 Ti GPU setup for CLAP semantic audio analysis.
- **Status**: ✅ Complete — torch 2.6.0+cu126 (sm_61 compatible), transformers 5.11.0, CLAP model loaded on cuda, inference verified at 4.23GB VRAM.

## ⚠️ Critical Architectural Constraints (Red Lines)
- **YouTube Embedding**: Always set `controls: 1` and pass `origin` in `playerVars`. Removing `pointer-events: none` from iframe containers is mandatory to allow browser autoplay unlock gestures.
- **Service Layering**: Always write business logic in `services/`, not router files. Use swappable repository adapters (`MongoSongRepository.js` and `InMemoryRepository.js` for offline tests).
- **PM2 Python Paths**: Resolve `yt-dlp` relative to `sys.executable` in FastAPI scripts.
- **Mock Repo Querying**: `InMemoryRepository` must explicitly support null-matching and query operators (`$ne`, `$eq`) for parity with MongoDB.
- **Vite Proxying**: Set `VITE_API_URL=/api` and `host: true` in development to allow network exposure without hardcoded localhost strings.
- **MongoDB on Proxmox kernel 6.19+**: Only MongoDB 7.0.21+ works. v8.x crashes on startup. Use `mongodb-org` 7.0 repo (debian bookworm). After apt upgrade, `/etc/mongod.conf` resets `bindIp` to `127.0.0.1` — always re-set to `0.0.0.0`. Auth user `myAdmin` must be recreated in `admin` db after fresh installs (URI: `authSource=admin`).
- **Jest test paths**: Tests live in root `tests/` but import `../../services/`. Run from `server/` via symlink `server/tests -> ../tests`. Always run as `npm test` from `server/` dir.
- **Audit Lenses**: Keep auditing templates and questions strictly structured under the four core lenses: rhythm, texture, harmony, and arrangement.
- **Export Formats**: Prefer beautiful HTML files over markdown for generated reference documents, lessons, and exportable handoff sheets.
- **Token Optimization (Caveman Style)**: Write devlogs, session summaries, and agent logs in highly terse, compressed "caveman" style (omit articles, pleasantries, fluff) to maximize token efficiency. Skip backend testing on pure frontend/style changes to conserve context window tokens.

## 🛠️ Open Priority TODOs
- [x] Time signature selector (3/4, 6/8) in ArrangementTimelineWidget.
- [x] Horizontal zoom control (PX_PER_SEC slider) in timeline.
- [ ] Multi-select and bulk-delete track blocks.
- [ ] Export arrangement as image/PDF.

## 🔄 Pruned Session Log (Full history in devlogs.md)
| Date | Summary | Commit |
|---|---|---|
| 2026-06-13 | Implement daily study session workspace page, uploader, populates, and verify builds | `ebaae66` |
| 2026-06-13 | Implement client adapters, StudyPlannerDashboard, Router hooks, and dashboard widget | `ebaae66` |
| 2026-06-13 | Create CurriculumService, Multer configs, API routes, server hooks, and integration tests | `ebaae66` |
| 2026-06-13 | Create Curriculum/StudyProgress models, seed script, uploads dir, Mongoose repo mapping, unit tests | `ebaae66` |
| 2026-06-06 | ArrangementTimelineWidget v2: BPM autofill, BARS/SECS ruler toggle (4/4), multi-track lanes | `b6f3e75` |
| 2026-06-07 | Integrate SigMap and configure Antigravity MCP server | `0f0a791` |
| 2026-06-07 | Prune agent_memory.md to optimize token usage | `c4c348c` |
| 2026-06-07 | Scaffold CLAP GPU analysis pipeline & fallback simulation | `7151075` |
| 2026-06-10 | Rebrand: all Sonic DNA → Arra references in source, docs, deploy scripts | `66249ec` |
| 2026-06-10 | Full redeployment: PM2 ecosystem config, MongoDB 7.0.35 upgrade, live at arra.homma.casa | `8c35682` |
| 2026-06-10 | Clean YouTube metadata noise (e.g. Official Music Video) from Tavily research queries | `6ed42a3` |
| 2026-06-10 | Integrate python audio analysis microservice into PM2 and deploy script | `67f3148` |
| 2026-06-10 | Add simulated progress bar displaying extraction stages to Phase 1 Audit loading state | `1b6d53a` |
| 2026-06-10 | Allow resuming guided audits from Dashboard history list and AuditDetail review views | `9a95351` |
| 2026-06-10 | Implement UI/UX design handoff: Bitwig dark studio theme, playheads, dynamic zoom, and meter signature dropdown | `e167637` |
| 2026-06-10 | Resolve workspace black hole theme issue by aligning card/panel backgrounds with perfect dark grey (#282828) | `97fa1a7` |
| 2026-06-10 | Research teach/caveman. Add token/lens rules. | `-` |
| 2026-06-11 | Refactor active feed song card badges/actions to Tailwind flex rows | `d3d52c1` |
| 2026-06-11 | Refactor concrete exercises description typography to improve readability | `49da561` |
| 2026-06-11 | Refactor concrete exercises card layout, padding, spacing, and lists | `e81824b` |
| 2026-06-11 | Remove max-width constraints on concrete exercises to allow full-width text | `ef92b3d` |
| 2026-06-11 | Set Noto Sans 18px 400 as default global typography style | `da5cd7e` |
| 2026-06-11 | Set size 18 on audit questions labels in AuditForm (Phase 3) | `f9a1a6a` |
| 2026-06-11 | GTX 1050 Ti GPU CLAP setup: torch 2.6.0+cu126, transformers 5.x API fix (audios→audio), 4.23GB VRAM confirmed | `15e025e` |






