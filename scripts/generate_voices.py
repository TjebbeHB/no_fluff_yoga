#!/usr/bin/env python3
"""Render the audio-guide lines with Paradee into downloadable voice packs.

Paradee (https://github.com/sahilmahendrakar/paradee, Apache-2.0) is an
8M-parameter text-to-speech model distilled from Kokoro-82M. The guide only
ever says a fixed set of lines, so each voice pack is those lines rendered
once: small AAC files plus a manifest that the app downloads on request.

Setup (Python 3.10 to 3.13):
    python3.11 -m venv .venv
    .venv/bin/pip install "git+https://github.com/sahilmahendrakar/paradee" soundfile

Usage:
    node scripts/export_guide_lines.cjs > lines.json
    .venv/bin/python scripts/generate_voices.py lines.json voices/paradee-1.2

Lines whose text is unchanged since the last run are kept as they are.
ffmpeg must be on the PATH.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

VOICES = ["af_heart", "bf_isabella", "am_puck", "bm_fable"]
SPEED = 0.94  # a touch slower than normal speech, for a calm guide
GAP = 0.34  # seconds of silence between sentences
LEAD, TAIL = 0.12, 0.3
TARGET_RMS = 10 ** (-20 / 20)  # even loudness across lines
PEAK = 10 ** (-1.5 / 20)


def short_espeak_path():
    """espeak-ng ignores data paths longer than its internal buffer and falls
    back to a build-machine path, and phonemizer-fork 3.3.2 never passes the
    configured path on. Link the bundled data from a short directory and hand
    that to phonemizer directly."""
    import espeakng_loader
    from phonemizer.backend.espeak.wrapper import EspeakWrapper

    short = Path.home() / ".cache" / "paradee-espeak"
    short.mkdir(parents=True, exist_ok=True)
    link = short / "espeak-ng-data"
    if link.is_symlink() or link.exists():
        link.unlink()
    link.symlink_to(espeakng_loader.get_data_path())
    EspeakWrapper.data_path = property(lambda self: str(short))


def render(tts, text, voice, sample_rate):
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s]
    gap = np.zeros(int(GAP * sample_rate), dtype=np.float32)
    parts = []
    for i, sentence in enumerate(sentences):
        if i:
            parts.append(gap)
        parts.append(np.asarray(tts(sentence, speed=SPEED, voice=voice), dtype=np.float32))
    audio = np.concatenate(
        [np.zeros(int(LEAD * sample_rate), np.float32), *parts, np.zeros(int(TAIL * sample_rate), np.float32)]
    )
    rms = float(np.sqrt(np.mean(audio**2))) or 1.0
    audio = audio * (TARGET_RMS / rms)
    peak = float(np.max(np.abs(audio))) or 1.0
    if peak > PEAK:
        audio = audio * (PEAK / peak)
    return audio


def encode(audio, sample_rate, out):
    import soundfile as sf

    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "line.wav"
        sf.write(wav, audio, sample_rate, subtype="PCM_16")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-c:a", "aac", "-b:a", "48k",
             "-movflags", "+faststart", str(out)],
            check=True,
        )


def main():
    lines = json.loads(Path(sys.argv[1]).read_text())
    root = Path(sys.argv[2])
    voices = sys.argv[3:] or VOICES
    short_espeak_path()
    from paradee import SAMPLE_RATE, Paradee

    tts = Paradee()
    for voice in voices:
        folder = root / voice
        folder.mkdir(parents=True, exist_ok=True)
        manifest_path = folder / "manifest.json"
        previous = json.loads(manifest_path.read_text())["lines"] if manifest_path.exists() else {}
        entries = {}
        for line_id, text in lines.items():
            name = f"{line_id}.m4a"
            out = folder / name
            old = previous.get(line_id)
            if not (old and old["text"] == text and out.exists()):
                audio = render(tts, text, voice, SAMPLE_RATE)
                encode(audio, SAMPLE_RATE, out)
                seconds = round(len(audio) / SAMPLE_RATE, 2)
            else:
                seconds = old["seconds"]
            data = out.read_bytes()
            entries[line_id] = {
                "file": name,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "seconds": seconds,
                "text": text,
            }
        for stale in set(previous) - set(lines):
            (folder / previous[stale]["file"]).unlink(missing_ok=True)
        manifest = {
            "format": 1,
            "model": "Paradee 1.2 (Apache-2.0), distilled from Kokoro-82M",
            "voice": voice,
            "bytes": sum(e["bytes"] for e in entries.values()),
            "lines": entries,
        }
        manifest_path.write_text(json.dumps(manifest, indent=1) + "\n")
        print(f"{voice}: {len(entries)} lines, {manifest['bytes'] / 1e6:.2f} MB")


if __name__ == "__main__":
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    main()
