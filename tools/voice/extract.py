import os
TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(TOOLS)
import re, json, hashlib
src=open(REPO+'/guide.js',encoding='utf8').read()
CONTACT="jobawems@gmail.com"
lines=set(); labels=set()
GREETS=["Good morning.","Good afternoon.","Good evening."]
# scripted lines: line(face, at, mark, TEXT, [...])
for m in re.finditer(r'line\("[a-z]+",\s*(?:null|"[^"]*"),\s*(?:null|\[[^\]]*\]),\s*(greet\(\)\s*\+\s*)?"((?:[^"\\]|\\.)*)"', src):
    t=m.group(2)
    if m.group(1):
        for g in GREETS: lines.add(g+t)
    else: lines.add(t)
# dynamic T tables: ["face", "text"]
for m in re.finditer(r'\["(?:calm|serious|surprised|laugh|warm|attentive|wink)",\s*"((?:[^"\\]|\\.)*)"\]', src): lines.add(m.group(1))
# FACTS: [/.../i, "face", "text"] with possible " + CONTACT + "
for m in re.finditer(r'\[/[^\n]*?/i,\s*"[a-z]+",\s*"((?:[^"\\]|\\.|"\s*\+\s*CONTACT\s*\+\s*")*)"\]', src):
    lines.add(m.group(1).replace('" + CONTACT + "', CONTACT))
lines.add("That one needs the live version of me. Email it to "+CONTACT+" and I’ll answer properly.")
lines.add("Ask me anything about the work. I’ll answer as myself.")
# choice labels
for m in re.finditer(r'(?:next|jump|toChat|finish)\("((?:[^"\\]|\\.)*)"', src): labels.add(m.group(1))
for m in re.finditer(r'label:\s*"((?:[^"\\]|\\.)*)"', src): labels.add(m.group(1))
labels.update(["Continue","Ask me something","Finish"])
def plain(h): return re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',h)).strip()
def djb2(s):
    h=5381
    for ch in s: h=((h<<5)+h+ord(ch)) & 0xFFFFFFFF
    return format(h,'x')
items=[]
for t in sorted(lines): items.append({"who":"jason","key":"jason:"+plain(t),"text":plain(t)})
for t in sorted(labels): items.append({"who":"you","key":"you:"+plain(t),"text":plain(t)})
for it in items: it["id"]=djb2(it["key"])
json.dump(items,open(TOOLS+'/voice/items.json','w'),ensure_ascii=False,indent=1)
print(len(lines),"lines",len(labels),"labels")
