# 🧠 Active Agent Memory — Arra

## 🎯 Active Session Focus (Intent)
- **Goal**: Full redeployment after rebrand — tests, PM2, MongoDB, and live verification.
- **Status**: ✅ Complete — all 29 tests passing, PM2 restarted as arra-server/arra-client, MongoDB 7.0.35 healthy, app live at arra.homma.casa.

## ⚠️ Critical Architectural Constraints (Red Lines)
- **YouTube Embedding**: Always set `controls: 1` and pass `origin` in `playerVars`. Removing `pointer-events: none` from iframe containers is mandatory to allow browser autoplay unlock gestures.
- **Service Layering**: Always write business logic in `services/`, not router files. Use swappable repository adapters (`MongoSongRepository.js` and `InMemoryRepository.js` for offline tests).
- **PM2 Python Paths**: Resolve `yt-dlp` relative to `sys.executable` in FastAPI scripts.
- **Mock Repo Querying**: `InMemoryRepository` must explicitly support null-matching and query operators (`$ne`, `$eq`) for parity with MongoDB.
- **Vite Proxying**: Set `VITE_API_URL=/api` and `host: true` in development to allow network exposure without hardcoded localhost strings.
- **MongoDB on Proxmox kernel 6.19+**: Only MongoDB 7.0.21+ works. v8.x crashes on startup. Use `mongodb-org` 7.0 repo (debian bookworm). After apt upgrade, `/etc/mongod.conf` resets `bindIp` to `127.0.0.1` — always re-set to `0.0.0.0`. Auth user `myAdmin` must be recreated in `admin` db after fresh installs (URI: `authSource=admin`).
- **Jest test paths**: Tests live in root `tests/` but import `../../services/`. Run from `server/` via symlink `server/tests -> ../tests`. Always run as `npm test` from `server/` dir.

## 🛠️ Open Priority TODOs
- [ ] Time signature selector (3/4, 6/8) in ArrangementTimelineWidget.
- [ ] Horizontal zoom control (PX_PER_SEC slider) in timeline.
- [ ] Multi-select and bulk-delete track blocks.
- [ ] Export arrangement as image/PDF.

## 🔄 Pruned Session Log (Full history in devlogs.md)
| Date | Summary | Commit |
|---|---|---|
| 2026-06-06 | ArrangementTimelineWidget v2: BPM autofill, BARS/SECS ruler toggle (4/4), multi-track lanes | `b6f3e75` |
| 2026-06-07 | Integrate SigMap and configure Antigravity MCP server | `0f0a791` |
| 2026-06-07 | Prune agent_memory.md to optimize token usage | `c4c348c` |
| 2026-06-07 | Scaffold CLAP GPU analysis pipeline & fallback simulation | `7151075` |
| 2026-06-10 | Rebrand: all Sonic DNA → Arra references in source, docs, deploy scripts | `66249ec` |
| 2026-06-10 | Full redeployment: PM2 ecosystem config, MongoDB 7.0.35 upgrade, live at arra.homma.casa | `8c35682` |
