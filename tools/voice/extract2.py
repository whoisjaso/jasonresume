import os
TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(TOOLS)
import re, json
src=open(REPO+'/guide.js',encoding='utf8').read()
CONTACT="jobawems@gmail.com"; GREETS=["Good morning.","Good afternoon.","Good evening."]
items={}
def add(face,t):
    items.setdefault(t,face)
for m in re.finditer(r'line\("([a-z]+)",\s*(?:null|"[^"]*"),\s*(?:null|\[[^\]]*\]),\s*(greet\(\)\s*\+\s*)?"((?:[^"\\]|\\.)*)"', src):
    face,t=m.group(1),m.group(3)
    if m.group(2):
        for g in GREETS: add(face,g+t)
    else: add(face,t)
for m in re.finditer(r'\["(calm|serious|surprised|laugh|warm|attentive|wink)",\s*"((?:[^"\\]|\\.)*)"\]', src): add(m.group(1),m.group(2))
for m in re.finditer(r'\[/[^\n]*?/i,\s*"([a-z]+)",\s*"((?:[^"\\]|\\.|"\s*\+\s*CONTACT\s*\+\s*")*)"\]', src): add(m.group(1), m.group(2).replace('" + CONTACT + "', CONTACT))
add("attentive","That one needs the live version of me. Email it to "+CONTACT+" and I’ll answer properly.")
add("attentive","Ask me anything about the work. I’ll answer as myself.")
def plain(h): return re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',h)).strip()
def djb2(s):
    h=5381
    for ch in s: h=((h<<5)+h+ord(ch)) & 0xFFFFFFFF
    return format(h,'x')
out=[{"id":djb2("jason:"+plain(t)),"face":f,"text":plain(t)} for t,f in items.items()]
json.dump(out,open(TOOLS+'/voice/lines.json','w'),ensure_ascii=False,indent=1)
print(len(out),"jason lines")

# visitor replies: every choice label the guide can speak for the visitor
labels=set()
for m in re.finditer(r'(?:next|jump|toChat|finish)\("((?:[^"\\]|\\.)*)"', src): labels.add(m.group(1))
for m in re.finditer(r'label:\s*"((?:[^"\\]|\\.)*)"', src): labels.add(m.group(1))
labels.update(["Continue","Ask me something","Finish"])
you=[{"id":djb2("you:"+plain(t)),"face":"calm","text":plain(t)} for t in sorted(labels)]
json.dump(you,open(TOOLS+'/voice/you_lines.json','w'),ensure_ascii=False,indent=1)
man=json.load(open(REPO+'/assets/voice/manifest.json'))
need=[l["id"] for l in out if l["id"] not in man]; needyou=[l["id"] for l in you if l["id"] not in man]
keep=set(l["id"] for l in out)|set(l["id"] for l in you)
stale=[k for k in man if k not in keep]
json.dump({"jason":need,"you":needyou,"stale":stale},open(TOOLS+'/voice/todo.json','w'),indent=1)
print(len(you),"visitor labels;",len(need),"jason lines to render;",len(needyou),"visitor lines to render;",len(stale),"stale clips")
