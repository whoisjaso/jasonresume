import os
TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(TOOLS)
import json, re, subprocess, time, sys, os
import numpy as np, soundfile as sf, torch, torchaudio
import imageio_ffmpeg
S=TOOLS+'/voice'
OUT=REPO+'/assets/voice'
FF=imageio_ffmpeg.get_ffmpeg_exe()
torch.set_num_threads(4)
REF=TOOLS+'/voice/ref.wav'
only=sys.argv[1:]  # optional ids to render (test mode)
from chatterbox.tts import ChatterboxTTS as M; turbo=False
print("model", "turbo" if turbo else "standard", flush=True)
model=M.from_pretrained(device="cpu")
EXAG={"laugh":0.65,"surprised":0.65,"wink":0.6,"warm":0.55,"calm":0.45,"attentive":0.5,"serious":0.4}
lines=json.load(open(S+'/lines.json'))
if only: lines=[l for l in lines if l["id"] in only]
manifest=json.load(open(OUT+'/manifest.json'))
def chunks(t, n=220):
    parts=re.split(r'(?<=[.!?])\s+', t); cur=""; out=[]
    for p in parts:
        if len(cur)+len(p)+1>n and cur: out.append(cur); cur=p
        else: cur=(cur+" "+p).strip()
    if cur: out.append(cur)
    return out
t0=time.time()
for i,l in enumerate(lines):
    text=l["text"].replace("Mon to Sat","Monday to Saturday").replace("webDEALER","web dealer").replace("GPA 3.63","G P A three point six three").replace("3.63","three point six three").replace("2024","twenty twenty-four")
    wavs=[]
    for c in chunks(text):
        kw=dict(audio_prompt_path=REF)
        ex=EXAG.get(l["face"],0.5); kw.update(exaggeration=ex, cfg_weight=0.4 if ex>=0.6 else 0.5, temperature=0.7)
        w=model.generate(c, **kw)
        wavs.append(w.squeeze(0).cpu().numpy())
        wavs.append(np.zeros(int(0.22*model.sr),dtype=np.float32))
    s=np.concatenate(wavs); sr=model.sr
    a=np.abs(s); idx=np.where(a>0.01)[0]
    if len(idx): s=s[max(0,idx[0]-int(0.05*sr)):min(len(s),idx[-1]+int(0.2*sr))]
    n=int(0.02*sr); s[:n]*=np.linspace(0,1,n); s[-n:]*=np.linspace(1,0,n)
    s=s/max(1e-6,np.abs(s).max())*0.85
    wav=S+'/out_'+l["id"]+'.wav'; sf.write(wav, s, sr)
    mp3=OUT+'/'+l["id"]+'.mp3'
    subprocess.run([FF,"-v","error","-y","-i",wav,"-codec:a","libmp3lame","-b:a","64k","-ac","1","-ar","24000",mp3],check=True)
    manifest[l["id"]]={"f":l["id"]+".mp3","d":round(len(s)/sr,2)}
    json.dump(manifest,open(OUT+'/manifest.json','w'),separators=(",",":"))
    print(i+1,"/",len(lines),l["face"],round(len(s)/sr,1),"s","elapsed",round(time.time()-t0),flush=True)
print("DONE",round(time.time()-t0),"s")
