import os
import sys
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Add current folder to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from analyzer import download_and_analyze, analyze_sketch_file

app = FastAPI(
    title="Arra Audio Analysis Service",
    description="Microservice for extracting BPM, key, scale, and meters from audio files.",
    version="1.0.0"
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

class AnalysisRequest(BaseModel):
    song_id: str
    youtube_url: str
    yt_id: str
    callback_url: Optional[str] = None

class SketchAnalysisRequest(BaseModel):
    sketch_id: str
    file_path: str
    callback_url: Optional[str] = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "arra-analysis"}

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

if __name__ == "__main__":
    import uvicorn
    # Allow port configurations via env
    port = int(os.environ.get("PORT", 8080))
    print(f"Starting Arra Analysis microservice on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
