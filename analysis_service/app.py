import os
import sys
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Add current folder to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from analyzer import download_and_analyze

app = FastAPI(
    title="Sonic DNA Audio Analysis Service",
    description="Microservice for extracting BPM, key, scale, and meters from audio files.",
    version="1.0.0"
)

# Enable CORS for convenience
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    song_id: str
    youtube_url: str
    yt_id: str
    callback_url: Optional[str] = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "sonic-dna-analysis"}

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

if __name__ == "__main__":
    import uvicorn
    # Allow port configurations via env
    port = int(os.environ.get("PORT", 8080))
    print(f"Starting Sonic DNA Analysis microservice on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
