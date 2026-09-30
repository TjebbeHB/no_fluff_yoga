# Ambient audio · Verdant Yoga 1.1.0

The synthetic noise in version 1.0.0 has been replaced with a real stereo field recording.

- **Recording:** “Rain_01.wav”
- **Recordist:** Q.K.
- **Source and individual-file license:** https://freesound.org/people/Q.K./sounds/56306/
- **Published:** June 28, 2008
- **License:** Creative Commons Zero / CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/
- **Author description:** “A light rain fall.”
- **Downloaded source:** the publicly offered high-quality preview, https://cdn.freesound.org/previews/56/56306_91374-hq.mp3
- **License checked:** September 8, 2026. The individual recording page explicitly states CC0 and permits copying, modification and distribution, including commercial uses. No account or private download was used. Attribution is provided voluntarily.

## Bundled adaptation

`assets/natural-rain.wav` is a 21.5-second stereo PCM loop made from seconds 1–24 of the recording. An 80 Hz high-pass filter removes low rumble, a 6.5 kHz low-pass softens high-frequency hiss, mild transient compression reduces prominent drops, and a 1.5-second cyclic crossfade joins the recording without a silent gap. It remains a field recording, with no generated noise mixed in. WAV avoids MP3 encoder padding at the loop boundary.

The file is normalized to approximately -30.5 dBFS RMS. Default player gain is 0.18 (previously 0.55), roughly 9.7 dB lower than the previous default output at the same device volume. Playback fades in over 900 ms, and immediately pauses on mute, session pause, backgrounding or exit.

Reproduce with `python3 scripts/prepare_rain.py /path/to/56306_91374-hq.mp3` (requires ffmpeg and Python). Research downloads and analysis artifacts are kept outside bundled assets in `artifacts/audio-research/`.

## Validation and limits

The recording was inspected through provenance, decoded waveform/spectrum, RMS/peak measurements, clipping checks and loop-boundary analysis. Browser tests exercise actual playback, gain ramp, mute, pause/resume, backgrounding, exit and wraparound. Subjective listening on the user's Android speaker is still needed; no claim is made that this environment provided an audible listening review.

## Additional nature recordings · version 1.2.0

Individual recording pages and CC0 links checked September 26, 2026. Both recordings explicitly permit copying, modification and commercial distribution under **CC0 1.0 Universal**, https://creativecommons.org/publicdomain/zero/1.0/. Attribution below is voluntary. Public high-quality previews are used; no account or private downloads were needed.

| Bundled file | Recording / recordist | Individual source and license page | Public download |
| --- | --- | --- | --- |
| `assets/natural-birds.wav` | Forest birds – ambient seamless loop / **Magnesus** | https://freesound.org/people/Magnesus/sounds/723913/ | https://cdn.freesound.org/previews/723/723913_2008500-hq.mp3 |
| `assets/natural-stream.wav` | Water, small stream / **peridactyloptrix** | https://freesound.org/people/peridactyloptrix/sounds/197705/ | https://cdn.freesound.org/previews/197/197705_2737063-hq.mp3 |

The birds source documents a field recording in a Polish forest, published February 17, 2024. The stream source documents a quiet flowing stream captured with a Marantz PMD661 and Rode NTG-2. Source HTML license snapshots, downloaded previews, SHA-256 hashes, and processing measurements are retained under `artifacts/audio-research/expansion/` (not bundled into the app).

### Adaptation and reproduction

Run `python3 scripts/prepare_nature.py` from the project root after downloading the two previews to the research directory above. Python 3 and ffmpeg are required. Birds uses source seconds 0.2–26.7; stream uses seconds 1–36. Both use a 1.5-second equal-power cyclic crossfade, gentle high/low-pass filtering, transient compression, smooth soft limiting of close calls/drops, and level normalization. Final stereo 44.1 kHz 16-bit PCM loops are **25 seconds (birds)** and **33.5 seconds (stream)**. WAV avoids compressed encoder padding. No generated noise has been mixed into either field recording.

Both are matched to approximately **−30.5 dBFS RMS**, with zero clipped samples. At the intended default player gain **0.18**, mean output is approximately **−45.4 dBFS**; actual perceived loudness depends on phone volume and speaker/headphones. Soft limiting keeps isolated drops/calls from dominating. The existing rain asset is unchanged.

### Quality verification and limitations

Inspected the decoded spectra, source provenance, levels, clipping counts, duration and cyclic boundary deltas. Bird spectrogram shows discrete, changing tonal calls rather than a synthetic noise bed; stream retains broadband, time-varying water transients. These measurements establish signal integrity and moderate level, not a subjective listening verdict. Audible review on a physical Android/iPhone remains necessary. App playback, voice ducking and lifecycle tests are recorded separately with app validation.

## Original transition bell

`assets/transition-bell.wav` is an original 0.85-second synthesized bell created for this app, with no sampled recording. Reproduce with `scripts/generate_chime.py`. Peak amplitude is 0.26 and player gain is 0.24. It is optional, stops when the session pauses or exits, and plays once per new move.
