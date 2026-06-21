# Handoff: Local-Audio Refactor — Next Steps

> Companion to `devlogs.md` (entry 2026-06-21) and `agent_memory.md` session
> log. Captures what's left to do after the YouTube IFrame → local-audio
> refactor (commit `77d4514`). Ordered by leverage, not by chronology.

## 1. Verify the production download flow end-to-end [highest priority]

**What we have:** 288 client + 131 server tests passing, but jsdom can't
exercise the real Python `/download` endpoint. The first real-YouTube
import in production is the first actual proof the refactor works.

**What to test:**

1. **Happy path.** Paste a real YouTube URL → POST /songs/import.
   - Does the response 201 in < 2s? (It should — the download is
     fire-and-forget.)
   - Does `publicUrl` populate within the 6s client poll? (Background
     download + `attachLocalAudio` must finish before timeout.)
   - Does `audioAnalysisStatus` transition `not_started → pending → success`?
   - Does the waveform appear in the arranger timeline and render audio?
   - Does seeking on the wavesurfer waveform drive the floating monitor
     and the rAF-polled playhead in ArrangementTimelineWidget?

2. **Long video.** Try a 10-minute video. yt-dlp may take 30-60s for the
   audio extraction. The 6s poll in `loadSong` will time out and the
   waveform won't appear until the user reloads the song.

3. **Error paths.**
   - yt-dlp binary missing or wrong path → import returns 201 but
     `audioDownloadedAt` never populates, `importErrors` should get a
     row.
   - Network failure mid-download → file is partial, `<audio>` errors
     with `MEDIA_ERR_NETWORK`. AudioContext logs to console but the
     user sees nothing. Needs a UI signal.
   - Invalid YouTube URL → caught upstream at `extractYouTubeId`.

**Where bugs likely live:**

- `analysis_service/app.py:_download_to_dir` — the `_resolve_ytdlp_bin`
  fallback. If `sys.executable` doesn't have a sibling `yt-dlp` and PATH
  doesn't either, we get a 503 (we catch `FileNotFoundError` now). But
  if PATH has a stale `yt-dlp` (different version, broken config), we
  silently use it. Add a startup log of which binary is being used.
- `server/routes/songs.js:_downloadAndStoreInBackground` — the `fs.rmSync`
  on temp dir happens in `finally`. If the Python process dies between
  writing the file and returning, the callback never fires and the temp
  file leaks (no TTL since it's not in `/tmp/arra_temp_*`). Add a TTL
  sweep similar to `analyzer.py:purge_stale_temp_files`.
- `client/src/context/AudioContext.jsx:loadSong` — the 6s poll on
  `getAudioFallbackUrl` doesn't update the song in-place; it sets
  `activeSong` with the new publicUrl, but any component that has the
  old `song` prop (e.g. `ArrangementTimelineWidget`) won't see the
  update. This is actually the bug we'll most likely hit.

## 2. The in-flight download UX [ship together with auth]

When the user just imported a song, the client polls for up to 6s. After
6s with no `publicUrl`, the waveform never appears and there's no signal
that anything is happening. Three options:

1. **Spinner in the waveform lane.** While `!song.publicUrl` (or
   `!audioRef.current`), render a thin "Downloading audio…" placeholder
   in place of the WaveformTimelineOverlay. Cheapest, ships in <1h.

2. **Status field on Song.** Add `audioDownloadStatus: 'pending' |
   'downloading' | 'ready' | 'failed'` to the schema. Python updates it
   before/after the download. Client subscribes via SSE (or polls
   `/audio-status`). More work, but enables showing real progress and
   retry on failure.

3. **Bump poll to 30s + show spinner.** Compromise. Likely enough for
   most cases.

I'd do (1) for now and revisit if users complain.

## 3. /uploads/songs/ is unauthenticated [security]

`server/server.js:229` mounts `/uploads` via `express.static` with no
auth check. Song IDs are ObjectIds, not secrets — anyone who knows or
guesses one can fetch the audio.

`SongSketch` has the same issue but sketches are by definition shared
references. Songs are not.

**Fix:** Replace `app.use('/uploads', express.static(...))` with a
per-mount auth gate. Either:

```js
app.get('/uploads/songs/:songId.:ext', authMiddleware, async (req, res) => {
  const song = await Song.findById(req.params.songId);
  if (!song || song.userId.toString() !== req.userId) return res.status(404).end();
  res.sendFile(path.join(__dirname, 'uploads', 'songs', `${req.params.songId}.${req.params.ext}`));
});
```

Or keep the static mount but add a per-request `setHeaders` callback
that checks auth. The express route approach is cleaner.

`/uploads/sketch-*` should stay public (or get its own auth gate) since
sketches are referenced from outside auth contexts (share links, etc.).

## 4. Soft-delete file cleanup

`purgeSong` (server/services/songService.js) calls
`audioStorageService.remove(songId)`. But `deleteSong` (soft delete) does
not — intentionally, so restored songs still have their audio. Problem:
files sit in `/uploads/songs/` forever even for songs in trash.

**Fix:** Add a TTL-based cleanup job. Either:
- pm2 cron: a daily script that unlinks audio for songs whose
  `deletedAt` is older than 30 days.
- Eager: when a song is purged (in `purgeSong` it already works),
  also walk the trash for stale entries.

Cheapest: 1-line pm2 cron.

## 5. Refresh wavesurfer when navigating between songs

`WaveformTimelineOverlay.jsx` recreates the wavesurfer instance when
`audioRef?.current?.src` changes. But React refs don't notify on
property changes — the effect re-runs only when something else forces
a re-render. Loading a new song triggers one (because `activeSong`
changes), but loading the *same* song twice in a row (or rapid
back-to-back) might not.

**Test:** Import two different songs, switch between them several
times. Does the waveform always reflect the current audio?

If not, the fix is to give wavesurfer a `key` prop tied to the audio
src so React unmounts/remounts the component (forcing the effect to
re-run), or to expose a public `attachMedia()` method on the
WaveformTimelineOverlay.

## 6. Storage size policy

Every imported song burns 5-10MB. A heavy user with 1000 songs = 5-10GB
on disk. No policy exists.

**Add a `storage_used_bytes` field on User** (compute on import),
**and a soft cap in songService.importSong** that warns (or fails) when
the user crosses, say, 5GB. Trivially reportable in the dashboard.

For now, just track the number. The cap can be Phase 4.

## 7. Memory cleanup: drop the superseded red line

`agent_memory.md:14` still says:

```
- **YouTube Embedding**: `controls: 1` + `origin` in `playerVars`. ... 
  **SUPERSEDED 2026-06-21**: YouTube IFrame has been removed. ...
```

That block is dead weight. The next agent reading agent_memory will
search for the IFrame code and not find it. Either delete the line
entirely or keep one line:

```
- **YouTube IFrame removed 2026-06-21** (commit 77d4514). Single
  <audio> element in AudioContext, fed by /uploads/songs/{songId}.{ext}.
  See devlogs.md entry "Local audio storage + wavesurfer integration".
```

## 8. Python `/analyze` (YouTube URL path) is now rarely-used dead weight

`/analyze` accepts a YouTube URL and re-downloads. Now that songs have
local audio, the only legitimate use is:
- Songs whose download failed at import time
- Old songs imported before this refactor (none yet in prod)

**Options:**
- Keep as fallback but log every call so we know if/when it's hit
- Delete entirely once we've confirmed all production songs have
  `localAudioPath` set

**Action:** Add a log line in `songService.triggerAnalysis` when the
fallback path runs (`console.warn` or `console.info` with the songId).
After a week in prod with no fallback calls, delete the code.

## 9. Phase 3.2: Offline-first (the high-leverage long-term play)

This is now MUCH more tractable than it was before. With audio under
our control (no third-party IFrame dependency), the only network
dependencies for an audit session are:
- Research summary load
- AI summary
- Initial analysis (one-time per song)

The audit editing itself — arrangement, bookmarks, observations, notes
— is all React state + Mongo writes. The audio playback is `<audio>`
served from `/uploads/`. A service worker that:
- Caches `/uploads/songs/{songId}.{ext}` once downloaded
- Caches the Song JSON for songs the user has opened
- Queues audit writes in IndexedDB for replay when online

...gets us genuine offline songwriting. The PWA plugin was specced in
the original Phase 3.2; with audio now local, it's a 1-2 week project
instead of a "fundamental problem" project.

**Dependency:** Item (3) — auth on `/uploads/songs/` — must land first
or the service worker will hand out private audio to anyone.

## What I'd skip (for now)

- **Multi-resolution audio.** Songs are 5-10MB; not worth the complexity.
- **Server-side waveform peaks pre-generation.** Client decode is <2s
  on a modern device; the optimization is invisible.
- **Replacing `<audio>` with a Service Worker audio cache** before
  the offline-first work. Premature.
- **Bulk re-download for old songs.** The current schema migration
  isn't needed — new imports get the local flow, old songs (if any)
  fall back to the YouTube IFrame path (which... doesn't exist anymore
  since we deleted `react-youtube`). So old songs need either
  re-import OR a one-shot script to download their audio. **This is
  actually a small but real gap** — worth a 2-line note: "any songs
  imported before 2026-06-21 are broken in playback; users will see a
  no-audio state and need to re-import OR we run a backfill script."

## Suggested commit order (when you tackle this)

```
#1  chore: drop superseded YouTube Embedding red line from agent_memory
#2  feat(audio): show "downloading audio" placeholder in waveform lane
#3  feat(auth): gate /uploads/songs/ behind auth middleware
#4  chore: pm2 cron to unlink audio for songs in trash > 30 days
#5  fix(audio): ensure wavesurfer remounts on rapid song switches
#6  feat(user): track storage_used_bytes on User
#7  docs: log when songService.triggerAnalysis hits the YouTube URL fallback
```

Items 1, 2, 3, 4, 5 are < 1h each. 6, 7 are 1-2h. Then the offline
push becomes a 1-2w project, not a 1-month one.
