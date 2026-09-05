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
