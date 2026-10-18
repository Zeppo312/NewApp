from pathlib import Path
import subprocess,math,wave,struct,random
root=Path(__file__).resolve().parent.parent
raw=root/'recordings/iphone-bedienung.mov'
for name,start,length,speed in [('intro',27,9,2),('schlaf',75,5.5,1),('tag',178,7.7,1.4),('partner',0,6,1)]:
 subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-t',str(length),'-i',str(raw),'-vf',f'setpts=PTS/{speed},fps=30,scale=720:-2','-an','-c:v','libx264','-preset','fast','-crf','18','-g','30','-keyint_min','30','-movflags','+faststart','-pix_fmt','yuv420p',str(root/f'assets/live-{name}.mp4')],check=True)
r=32000;duration=20;random.seed(17);samples=[]
for i in range(r*duration):
 t=i/r;beat=t%0.5;off=t%1;bar=int(t/4)%4
 chord=[[220,277.18,329.63],[174.61,220,261.63],[196,246.94,293.66],[220,277.18,329.63]][bar]
 # Warm chord bed, restrained kick and brushed high percussion.
 v=sum(math.sin(2*math.pi*f*t) for f in chord)*.022
 if beat<.22:v+=.18*math.exp(-beat*22)*math.sin(2*math.pi*(49*beat+1.9*(1-math.exp(-beat*28))))
 h=t%.25
 if h<.045:v+=(random.random()*2-1)*.022*math.exp(-h*90)
 if .5<off<.62:v+=(random.random()*2-1)*.045*math.exp(-(off-.5)*35)
 q=t%.5;note=chord[int(t/.5)%3]*2
 v+=.07*min(1,q/.008)*math.exp(-q*8)*math.sin(2*math.pi*note*q)
 v*=min(1,t/.25,(duration-t)/.8)
 samples.append(v)
peak=max(abs(x) for x in samples);gain=.58/peak
with wave.open(str(root/'assets/musik-schnitt.wav'),'w') as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(r)
 w.writeframes(b''.join(struct.pack('<hh',int(v*gain*32767),int(v*gain*32767)) for v in samples))
