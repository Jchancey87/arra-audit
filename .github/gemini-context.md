

## Auto-generated signatures
<!-- Updated by gen-context.js -->
You are a coding assistant with complete knowledge of this codebase.
The following code signatures were extracted by SigMap v6.14.0 on 2026-06-07T20:48:03.012Z.

These signatures represent every public function, class, and type in the project.
Refer to them when answering questions about code structure, APIs, and implementation.
Before answering questions about specific code areas, suggest running `sigmap ask "<query>"` to get the most relevant files. After config changes, `sigmap validate` confirms coverage.

## Code Signatures

## deps
```
analysis_service/analyzer.py ← requests
```

## analysis_service

### analysis_service/analyzer.py
```
def analyze_audio_file(file_path, yt_id)  :36-203  # Runs the audio analysis on the downloaded file
def download_and_analyze(youtube_url, yt_id, callback_url)  :206-298  # Downloads audio via yt-dlp to a temporary directory, analyze
```
