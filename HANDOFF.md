# Hand-off Document: Sonic DNA — Audio Analysis Pipeline Integration

Yes — this is very feasible, and the best implementation is not “one Python script” but a small analysis pipeline that combines rhythm, tonal, and confidence outputs into one structured result for your song-audit app. pyAudioAnalysis is useful for feature extraction and some beat-rate work, but for production-grade BPM/key/time-signature analysis, Essentia and madmom are stronger foundations because Essentia exposes dedicated tonal and meter algorithms, while madmom is specifically known for beat, downbeat, and meter tracking.

## Recommended Stack
I would treat the feature set in tiers. For BPM and beat positions, Essentia’s rhythm extractors and librosa’s beat tracking are both viable, and librosa also supports time-varying tempo if the song drifts, while Essentia exposes beat positions and BPM confidence directly. For key detection, Essentia is the strongest fit because it explicitly computes HPCP-based tonal descriptors and runs a dedicated key/scale estimator with a returned strength value.

For time signature, you should be careful: this is the least reliable field in fully automatic audio analysis, especially for rubato, sparse intros, polymeter, swung material, or arrangement-heavy music. Essentia has a Meter algorithm that estimates time signature from a beatogram, and madmom includes downbeat and meter tracking, so the right product decision is to expose a predicted meter plus confidence and allow quick manual correction in the UI rather than presenting it as absolute truth.

### What Each Library is Good At
| Library | Best Use in Your App | Notes |
| :--- | :--- | :--- |
| **pyAudioAnalysis** | General feature extraction, chroma/MFCC/spectrogram helpers, fast prototyping | Useful, but not the best primary engine for key + meter detection. |
| **Essentia** | BPM, beat positions, key/scale, tonal descriptors, broader music descriptors | Best core backend choice for your feature set. |
| **madmom** | Beat tracking, downbeats, meter-aware rhythmic analysis | Strong complement if you want better bar-awareness. |
| **librosa** | Fast Python prototyping, beat tracking, chroma, onset analysis, tempo curves | Great fallback and visualization tool, but less turnkey for meter. |

---

## Technical Architecture
Your app is already a Vite React front end, so the cleanest path is to keep Python in a separate analysis service. Based on your current workflow around structured song audits and Python automation, a split architecture fits well: React uploads or references an audio file, a Python microservice analyzes it asynchronously, then the React app stores and displays both machine-derived descriptors and editable human corrections.

A practical shape is:
- **Frontend**: Vite React upload/import panel, analysis status, editable result cards.
- **API Layer**: Node/Express or Python FastAPI endpoint to enqueue analysis jobs.
- **Worker**: Python service using Essentia first, optionally madmom/librosa as backup.
- **Storage**: Persist raw JSON output, normalized fields, and user-overrides separately.
- **Audit UI**: Show detected BPM, key, scale, time signature, confidence, beat grid, and “needs review” flags.

This matters because BPM/key detection is not just a one-time computed field. You will want re-analysis, versioning, and side-by-side machine vs user-corrected metadata for long-term trust in the app.

---

## Suggested Feature Model
The first release should return more than four labels. A useful result object should include:
- `tempo_bpm`
- `tempo_confidence`
- `tempo_curve` or `tempo_segments`
- `beat_times`
- `downbeat_times`
- `estimated_meter`
- `meter_confidence`
- `key`
- `scale`
- `key_confidence`
- `tuning_reference`
- `sectional_key_candidates`
- `loudness_integrated`
- `dynamic_range`
- `energy_curve`
- `spectral_centroid_summary`
- `danceability_or_pulse_strength`
- `analysis_notes`

This is important because songs often change harmonic center by section, and “the key” is sometimes only a rough summary. Essentia’s tonal pipeline is based on HPCP and returns key strength, which gives you a native confidence metric, while beat-tracking outputs can support visual beat grids and section alignment in the arrangement editor.

---

## Best Implementation Strategy
The most robust strategy is a hybrid analyzer rather than betting on one library. Use Essentia as the main engine, then cross-check selected outputs with librosa or madmom where useful.

A good rule set is:
- **Tempo**: Essentia primary, librosa fallback, compare for disagreement.
- **Key**: Essentia primary, optional librosa/chroma heuristic fallback if Essentia confidence is weak.
- **Meter**: madmom or Essentia estimate, but always mark as provisional unless confidence is high.
- **Beat/downbeat grid**: madmom is especially valuable if you want section alignment and bar-aware UI overlays.

If outputs disagree, do not silently choose one. Store both and resolve with a scoring layer such as:
$$score = w_1 \cdot \text{confidence} + w_2 \cdot \text{cross\_model\_agreement} + w_3 \cdot \text{section\_stability}$$

That gives you a more trustworthy final label and a reason code like “low-confidence key due to modulating chorus.” This is especially useful for your audit workflow, where ambiguity itself can be musically meaningful.

---

## UI Integration Ideas
For your song audit interface, the feature should not live as a plain metadata box. It should become part of the analysis workflow.

Recommended UI components:
- **Track facts card**: BPM, key, scale, meter, duration, confidence badges.
- **Rhythm lane**: beat markers and downbeats over the arrangement timeline.
- **Tonal lane**: key estimate and possible sectional key changes.
- **Reliability panel**: “high confidence,” “mixed result,” or “manual review suggested.”
- **Override controls**: tap-tempo, manual key selector, manual time-signature selector.
- **Source comparison**: Essentia result vs user override vs imported metadata.

That would fit your existing “lens” model nicely: rhythm lens gets BPM and meter, harmony lens gets key/scale, arrangement lens gets beat-aligned sections, and production lens can later use loudness/spectral descriptors.

---

## Backend Flow
A solid backend job would look like this:
1. Convert input to mono analysis stream while keeping original file for playback.
2. Run tempo + beat extraction.
3. Run key/scale extraction from tonal descriptors.
4. Run meter/downbeat estimation.
5. Compute derived descriptors such as energy curve and dynamic landmarks.
6. Compare outputs across analyzers where enabled.
7. Save raw result JSON plus normalized app schema.
8. Return a summary object for the React UI.

pyAudioAnalysis can still contribute here for generalized short-term and mid-term feature extraction because it supports chromagram/spectrogram-like feature workflows and beat extraction via its feature stack, but I would not make it your only analysis engine for this feature.

---

## Practical Engineering Notes
Essentia is powerful, but deployment is heavier than a pure-pip library in some environments because of compiled dependencies and platform differences. That makes it a better fit for a Dockerized analysis worker than for embedding directly into your Vite app runtime. If you want client-side experimentation later, Essentia also has a JavaScript/WASM path through essentia.js, which could eventually support lightweight browser-side preview analysis, though I would keep server-side Python as the authoritative pipeline first.

For your stack, I’d recommend:
- **Frontend**: Vite React.
- **API**: FastAPI for analysis endpoints.
- **Worker**: Celery/RQ or a simple job queue.
- **Container**: Docker image with Essentia, madmom, librosa, ffmpeg.
- **Storage**: Postgres for normalized fields, object storage for raw analysis JSON and uploaded audio.

---

## Accuracy Caveats
You should design the product around the reality that:
- BPM is usually reliable for steady modern productions, less so for live or rubato recordings.
- Key detection is often decent for strongly tonal tracks, but can fail on modal, chromatic, heavily sampled, or tonally ambiguous music.
- Time signature detection is the most fragile of the three and should always be presented as an estimate with review tools.

A good UX pattern is:
- **Green badge**: confident.
- **Yellow badge**: probable.
- **Red badge**: manual review suggested.

---

## Best Roadmap
- **Phase 1**: BPM, beat times, key, scale, confidence.
- **Phase 2**: Downbeats, estimated meter, sectional tempo/key summaries.
- **Phase 3**: Energy curve, loudness landmarks, spectral descriptors, section auto-suggestions.
- **Phase 4**: Browser-side preview analysis with WASM for instant feedback, server-side final pass for canonical results.
