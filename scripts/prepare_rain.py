"""Prepare the CC0 Q.K. field recording into a modest-level, wrap-crossfaded PCM loop.
Usage: python3 scripts/prepare_rain.py /path/to/56306_91374-hq.mp3
Original public preview URL and individual-file license are documented in AUDIO_CREDITS.md.
"""
from pathlib import Path
from array import array
import json, math, subprocess, sys, wave, tempfile
source=Path(sys.argv[1])
rate=44100
# Roll off infrasonic handling rumble and the very top of the spectrum; retain drops.
raw=subprocess.run(['ffmpeg','-v','error','-i',str(source),'-ss','1','-t','23','-af','highpass=f=80,lowpass=f=6500,acompressor=threshold=0.06:ratio=3:attack=5:release=100:makeup=1','-ac','2','-ar',str(rate),'-f','f32le','pipe:1'],capture_output=True,check=True).stdout
samples=array('f');samples.frombytes(raw)
frames=len(samples)//2;overlap=int(rate*1.5)
# Tail -> head wrap blend, followed by the untouched middle. Both boundaries are contiguous.
loop=array('f')
for i in range(overlap):
 t=i/(overlap-1);a=math.cos(t*math.pi/2);b=math.sin(t*math.pi/2)
 for ch in range(2):loop.append(samples[(frames-overlap+i)*2+ch]*a+samples[i*2+ch]*b)
loop.extend(samples[overlap*2:(frames-overlap)*2])
rms=math.sqrt(sum(v*v for v in loop)/len(loop));gain=10**(-30.5/20)/rms
pcm=array('h',(int(max(-1,min(1,v*gain))*32767) for v in loop))
out=Path('assets/natural-rain.wav')
with wave.open(str(out),'wb') as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
result={'source':'Freesound 56306, Rain_01.wav by Q.K., CC0','durationSeconds':len(loop)/2/rate,'sampleRate':rate,'channels':2,'rmsDbFS':-30.5,'peakDbFS':20*math.log10(max(abs(v) for v in pcm)/32768),'clippedSamples':sum(abs(v)>=32767 for v in pcm),'wrapDeltaDbFS':20*math.log10(max(abs(pcm[-2+i]-pcm[i]) for i in range(2))/32768),'defaultPlayerVolume':.18,'defaultEffectiveRmsDbFS':-30.5+20*math.log10(.18),'oldEffectiveRmsDbFS':-30.5+20*math.log10(.55),'processing':'1-24 sec excerpt; 80 Hz highpass, 6.5 kHz lowpass, gentle transient compression; 1.5 sec equal-power cyclic crossfade; RMS normalization; lossless stereo PCM'}
Path('artifacts/audio-research/processing-report.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
