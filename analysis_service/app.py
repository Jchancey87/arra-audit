import os
import sys
import asyncio
import subprocess
import tempfile
from contextlib import asynccontextmanager
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Add current folder to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from analyzer import (
    download_and_analyze,
    analyze_sketch_file,
    analyze_segment,
    purge_stale_temp_files,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Phase 2.3 v2: run temp-file TTL purge at startup. Configurable via
    `TEMP_CACHE_TTL_SECONDS` env (default 24h). Any purge failures are
    logged but never abort startup — a stuck file is a maintenance issue,
    not a startup blocker."""
    ttl = int(os.environ.get("TEMP_CACHE_TTL_SECONDS", str(24 * 3600)))
    try:
        purged = purge_stale_temp_files(max_age_seconds=ttl)
        print(f"[Startup] Temp cache TTL={ttl}s, purged {purged} stale file(s)")
    except Exception as e:
        print(f"[Startup] Temp cache purge failed: {e}", file=sys.stderr)
    yield


app = FastAPI(
    title="Arra Audio Analysis Service",
    description="Microservice for extracting BPM, key, scale, and meters from audio files.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for configured origins only (credentials require explicit origins)
allowed_origins = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Phase 2.3: GPU concurrent limit for per-bookmark segment jobs ─────────────
# A 4GB VRAM GTX 1050 Ti can comfortably run 2 CLAP inferences in parallel
# before OOMing. The semaphore is global because there is only one GPU
# device in the box.
SEGMENT_GPU_CONCURRENCY = int(os.environ.get("SEGMENT_GPU_CONCURRENCY", "2"))
_segment_gpu_semaphore = asyncio.Semaphore(SEGMENT_GPU_CONCURRENCY)


class AnalysisRequest(BaseModel):
    song_id: str
    youtube_url: str
    yt_id: str
    callback_url: Optional[str] = None

class SketchAnalysisRequest(BaseModel):
    sketch_id: str
    file_path: str
    callback_url: Optional[str] = None

class SegmentAnalysisRequest(BaseModel):
    """Phase 2.3: per-bookmark CLAP analysis.
    Either `file_path` OR (`youtube_url` + `yt_id`) must be supplied."""
    audio_id: Optional[str] = None
    file_path: Optional[str] = None
    youtube_url: Optional[str] = None
    yt_id: Optional[str] = None
    start_seconds: float
    end_seconds: float
    pad_seconds: Optional[float] = 5.0


def _ensure_cached_audio(youtube_url, yt_id):
    """Download via yt-dlp if `/tmp/arra_temp_{yt_id}.mp3` is missing.
    Returns the file path on success, raises HTTPException on failure."""
    temp_dir = tempfile.gettempdir()
    target = os.path.join(temp_dir, f"arra_temp_{yt_id}.mp3")
    if os.path.exists(target):
        return target

    output_template = os.path.join(temp_dir, f"arra_temp_{yt_id}.%(ext)s")
    ytdlp_bin = os.path.join(os.path.dirname(sys.executable), "yt-dlp")
    if not os.path.exists(ytdlp_bin):
        ytdlp_bin = "yt-dlp"
    cmd = [
        ytdlp_bin,
        "--no-playlist",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "5",
        "-o", output_template,
        youtube_url,
    ]
    print(f"[API] Caching audio for {yt_id} via yt-dlp...")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
    if result.returncode != 0:
        # Try without audio extraction as a last resort
        fallback = [ytdlp_bin, "--no-playlist", "-o", output_template, youtube_url]
        fb_result = subprocess.run(fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
        if fb_result.returncode != 0:
            raise HTTPException(status_code=502, detail=f"yt-dlp download failed: {fb_result.stderr[:300]}")
    if not os.path.exists(target):
        # yt-dlp may have produced a different extension
        for ext in ("mp3", "m4a", "webm", "opus", "wav"):
            cand = os.path.join(temp_dir, f"arra_temp_{yt_id}.{ext}")
            if os.path.exists(cand):
                return cand
        raise HTTPException(status_code=502, detail="yt-dlp finished but no audio file was found")
    return target


@app.get("/health")
def health():
    return {"status": "ok", "service": "arra-analysis", "segment_gpu_concurrency": SEGMENT_GPU_CONCURRENCY}

@app.post("/analyze")
def trigger_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """
    Triggers an asynchronous audio analysis job.
    Downloads the audio from YouTube, processes features, and hits the callback URL.
    """
    if not request.youtube_url or not request.yt_id or not request.song_id:
        raise HTTPException(status_code=400, detail="Missing required parameters: song_id, youtube_url, yt_id")

    print(f"[API] Queueing analysis for song_id: {request.song_id}, video: {request.yt_id}")

    background_tasks.add_task(
        download_and_analyze,
        youtube_url=request.youtube_url,
        yt_id=request.yt_id,
        callback_url=request.callback_url
    )

    return {
        "status": "queued",
        "song_id": request.song_id,
        "yt_id": request.yt_id
    }

@app.post("/analyze-sketch")
def trigger_sketch_analysis(request: SketchAnalysisRequest):
    """
    Synchronously analyze an uploaded DAW sketch from a local file path.
    Returns the analysis dict in the response body. No yt-dlp required.
    """
    if not request.sketch_id or not request.file_path:
        raise HTTPException(status_code=400, detail="Missing required parameters: sketch_id, file_path")

    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"Sketch file not found: {request.file_path}")

    print(f"[API] Analyzing sketch {request.sketch_id} from {request.file_path}")
    try:
        analysis = analyze_sketch_file(
            file_path=request.file_path,
            sketch_id=request.sketch_id,
            callback_url=request.callback_url,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sketch analysis failed: {e}")

    return {
        "status": "success",
        "sketch_id": request.sketch_id,
        "analysis": analysis,
    }

@app.post("/analyze-segment")
async def trigger_segment_analysis(request: SegmentAnalysisRequest):
    """
    Phase 2.3: run CLAP on the ±pad_seconds window around a bookmark.
    Synchronous. Returns the analysis dict. Concurrency-limited by a
    semaphore so a flood of bookmark adds doesn't OOM the GPU.
    """
    if request.start_seconds is None or request.end_seconds is None:
        raise HTTPException(status_code=400, detail="start_seconds and end_seconds are required")
    if request.end_seconds <= request.start_seconds:
        raise HTTPException(status_code=400, detail="end_seconds must be greater than start_seconds")
    if not request.file_path and not (request.youtube_url and request.yt_id):
        raise HTTPException(status_code=400, detail="Provide either file_path or (youtube_url + yt_id)")

    # Resolve the file path (download-and-cache if needed)
    try:
        if request.file_path and os.path.exists(request.file_path):
            file_path = request.file_path
        elif request.youtube_url and request.yt_id:
            file_path = _ensure_cached_audio(request.youtube_url, request.yt_id)
        else:
            raise HTTPException(status_code=404, detail=f"Audio file not found: {request.file_path}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio resolution failed: {e}")

    audio_id = request.audio_id or request.yt_id or os.path.basename(file_path)

    # Acquire the GPU slot before the (potentially expensive) CLAP call.
    async with _segment_gpu_semaphore:
        try:
            analysis = await asyncio.to_thread(
                analyze_segment,
                file_path=file_path,
                start_s=request.start_seconds,
                end_s=request.end_seconds,
                audio_id=audio_id,
                pad_seconds=request.pad_seconds if request.pad_seconds is not None else 5.0,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Segment analysis failed: {e}")

    return {
        "status": "success",
        "audio_id": audio_id,
        "start_seconds": request.start_seconds,
        "end_seconds": request.end_seconds,
        "analysis": analysis,
    }

if __name__ == "__main__":
    import uvicorn
    # Allow port configurations via env
    port = int(os.environ.get("PORT", 8080))
    print(f"Starting Arra Analysis microservice on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
