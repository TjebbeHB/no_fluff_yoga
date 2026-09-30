"""Original soft bell cue for Verdant; no external recording or license required."""
import math
import pathlib
import struct
import wave
rate, duration = 44100, 0.85
samples = []
for i in range(round(rate * duration)):
    t = i / rate
    attack = min(1, t / 0.018)
    tail = min(1, (duration - t) / 0.15)
    tone = (math.sin(2 * math.pi * 659.25 * t) * math.exp(-5.8 * t)
            + 0.22 * math.sin(2 * math.pi * 1318.5 * t) * math.exp(-9 * t)
            + 0.08 * math.sin(2 * math.pi * 1977.75 * t) * math.exp(-13 * t))
    samples.append(round(32767 * 0.28 * attack * tail * tone))
target = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'transition-bell.wav'
with wave.open(str(target), 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(rate)
    output.writeframes(struct.pack('<' + 'h' * len(samples), *samples))
print(target)
