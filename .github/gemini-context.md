

## Auto-generated signatures
<!-- Updated by gen-context.js -->
You are a coding assistant with complete knowledge of this codebase.
The following code signatures were extracted by SigMap v6.14.0 on 2026-06-07T20:57:40.537Z.

These signatures represent every public function, class, and type in the project.
Refer to them when answering questions about code structure, APIs, and implementation.
Before answering questions about specific code areas, suggest running `sigmap ask "<query>"` to get the most relevant files. After config changes, `sigmap validate` confirms coverage.

## Code Signatures

## deps
```
analysis_service/analyzer.py ← requests
```

## changes (last 5 commits — 0 seconds ago)
```
analysis_service/analyzer.py                  +ClapAnalyzer  +__init__  +analyze_features  +get_clap_analyzer
```

## analysis_service

### analysis_service/analyzer.py
```
class ClapAnalyzer  :44-108
  def __init__(model_name)
  def analyze_features(file_path, tags)
def get_clap_analyzer()  :113-120
def analyze_audio_file(file_path, yt_id)  :123-333  # Runs the audio analysis on the downloaded file
def download_and_analyze(youtube_url, yt_id, callback_url)  :336-428  # Downloads audio via yt-dlp to a temporary directory, analyze
```
