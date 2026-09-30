"""Prepare verified CC0 recordings; run from project root with Python 3 + ffmpeg.
Source previews must be in artifacts/audio-research/expansion (see AUDIO_CREDITS.md).
No synthetic noise is introduced. Source recordings and rain stay unchanged.
"""
from array import array
from pathlib import Path
import hashlib, json, math, subprocess, wave

RATE = 44100
RESEARCH = Path('artifacts/audio-research/expansion')
SOURCES = [
    ('birds', '723913_2008500-hq.mp3', 0.2, 26.5, 120, 8500),
    ('stream', '197705_2737063-hq.mp3', 1, 35, 80, 6500),
]
reports = []
for name, filename, start, duration, highpass, lowpass in SOURCES:
    source = RESEARCH / filename
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(source), '-ss', str(start),
        '-t', str(duration), '-af', f'highpass=f={highpass},lowpass=f={lowpass},acompressor=threshold=0.025:ratio=5:attack=1:release=150:makeup=1',
        '-ar', str(RATE), '-ac', '2', '-f', 'f32le', 'pipe:1'], capture_output=True, check=True).stdout
    samples = array('f'); samples.frombytes(raw)
    frames = len(samples) // 2
    overlap = int(RATE * 1.5)
    loop = array('f')
    # Cyclic tail->head equal-power blend. Both outer joins follow contiguous samples.
    for frame in range(overlap):
        t = frame / (overlap - 1)
        a, b = math.cos(t * math.pi / 2), math.sin(t * math.pi / 2)
        for channel in range(2):
            loop.append(samples[(frames - overlap + frame)*2+channel]*a + samples[frame*2+channel]*b)
    loop.extend(samples[overlap*2:(frames-overlap)*2])
    rms = math.sqrt(sum(value*value for value in loop)/len(loop))
    # Smoothly tame close water drops/bird calls before final level matching.
    ceiling = rms * 4
    loop = array('f', (ceiling * math.tanh(value / ceiling) for value in loop))
    rms = math.sqrt(sum(value*value for value in loop)/len(loop))
    gain = 10 ** (-30.5/20) / rms
    pcm = array('h', (round(max(-1,min(1,value*gain))*32767) for value in loop))
    # Rotate to a quiet sample boundary without changing any adjacent audio.
    cut = min(range(RATE, len(pcm)//2 - RATE), key=lambda i: max(abs(pcm[i*2+c] - pcm[(i-1)*2+c]) for c in range(2))) * 2
    pcm = pcm[cut:] + pcm[:cut]
    out = Path(f'assets/natural-{name}.wav')
    with wave.open(str(out),'wb') as file:
        file.setnchannels(2); file.setsampwidth(2); file.setframerate(RATE); file.writeframes(pcm.tobytes())
    def db(value): return 20*math.log10(max(value, 1e-12))
    report = dict(id=name,source=filename,sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),
        output=str(out),outputSHA256=hashlib.sha256(out.read_bytes()).hexdigest(),
        seconds=len(pcm)/2/RATE,rmsDbFS=db(math.sqrt(sum(v*v for v in pcm)/len(pcm))/32768),
        peakDbFS=db(max(abs(v) for v in pcm)/32768),clippedSamples=sum(abs(v)>=32767 for v in pcm),
        wrapDeltaDbFS=db(max(abs(pcm[-2+i]-pcm[i]) for i in range(2))/32768),
        highpassHz=highpass,lowpassHz=lowpass,cyclicCrossfadeSeconds=1.5,defaultPlayerVolume=.18)
    reports.append(report)
(RESEARCH/'processing-report.json').write_text(json.dumps(reports,indent=2)+'\n')
print(json.dumps(reports,indent=2))
