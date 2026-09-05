import os
TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(TOOLS)
import json, re, subprocess, time, sys
import numpy as np, soundfile as sf, torch
import imageio_ffmpeg
S=TOOLS
OUT=REPO+'/assets/voice'
FF=imageio_ffmpeg.get_ffmpeg_exe(); torch.set_num_threads(4)
from chatterbox.tts import ChatterboxTTS as M
print("model standard", flush=True)
model=M.from_pretrained(device="cpu")
lines=json.load(open(S+'/vsl/you_lines.json'))
only=sys.argv[1:]
if only: lines=[l for l in lines if l["id"] in only]
manifest=json.load(open(OUT+'/manifest.json'))
t0=time.time()
for i,l in enumerate(lines):
    text=l["text"].strip()
    if not re.search(r'[.!?]$', text): text=text+"."
    # short labels read better with a beat after them
    w=model.generate(text, exaggeration=0.5, cfg_weight=0.5, temperature=0.6)
    s=w.squeeze(0).cpu().numpy(); sr=model.sr
    a=np.abs(s); idx=np.where(a>0.01)[0]
    if len(idx): s=s[max(0,idx[0]-int(0.05*sr)):min(len(s),idx[-1]+int(0.15*sr))]
    n=int(0.02*sr); s[:n]*=np.linspace(0,1,n); s[-n:]*=np.linspace(1,0,n)
    s=s/max(1e-6,np.abs(s).max())*0.8
    wav=S+'/vsl/you_'+l["id"]+'.wav'; sf.write(wav, s, sr)
    mp3=OUT+'/'+l["id"]+'.mp3'
    subprocess.run([FF,"-v","error","-y","-i",wav,"-codec:a","libmp3lame","-b:a","64k","-ac","1","-ar","24000",mp3],check=True)
    manifest[l["id"]]={"f":l["id"]+".mp3","d":round(len(s)/sr,2)}
    json.dump(manifest,open(OUT+'/manifest.json','w'),separators=(",",":"))
    print(i+1,"/",len(lines),repr(text),round(len(s)/sr,1),"s elapsed",round(time.time()-t0),flush=True)
print("YOU2 DONE",round(time.time()-t0))
