# After Hours: the voice scripts, written from the story itself.
#
#   python3 tools/site/story_voice.py
#
# Reads tools/site/story.json and writes the two files the voice tools read:
#   tools/voice/story_lines.json        the fictional cast and your own thoughts, each line
#                                       with its stock Kokoro voice (render with narrate_free.py)
#   tools/voice/story_jason_lines.json  my own lines, ids prefixed jason- (render with
#                                       narrate_jason.py, my voice from my recording)
# Both write to assets/voice/story. assemble_home.py checks the Jason file agrees
# with story.json, so run this after changing a line, then render.
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
story = json.loads((ROOT / "tools/site/story.json").read_text())
out = story.get("out", "assets/voice/story")
cast = story["cast"]
fict, mine, seen = [], [], set()
for tid, t in story["talks"].items():
    for l in t.get("lines", []):
        if l["id"] in seen:
            raise SystemExit("story_voice: duplicate line id " + l["id"])
        seen.add(l["id"])
        who = l["who"]
        if who == "jason":
            mine.append({"id": "jason-" + l["id"], "text": l["t"]})
        else:
            v = cast[who].get("voice")
            if not v:
                raise SystemExit("story_voice: no voice for " + who)
            fl = {"id": l["id"], "who": who, "voice": v, "text": l["t"]}
            if l.get("speed") or cast[who].get("speed"):
                fl["speed"] = l.get("speed") or cast[who]["speed"]  # a line, or a voice (your thoughts), said slower
            fict.append(fl)

(ROOT / "tools/voice/story_lines.json").write_text(json.dumps({
    "_about": "Written by tools/site/story_voice.py from tools/site/story.json. The fictional cast of After Hours in stock Kokoro voices. Render: /root/kvenv/bin/python -I tools/voice/narrate_free.py tools/voice/story_lines.json",
    "out": out, "lines": fict}, indent=1, ensure_ascii=False) + "\n")
(ROOT / "tools/voice/story_jason_lines.json").write_text(json.dumps({
    "_about": "Written by tools/site/story_voice.py from tools/site/story.json. My own lines in After Hours, first person, every fact already in llms.txt, rendered in my voice from my own recording with my permission. Render: /root/cbvenv/bin/python -I tools/voice/narrate_jason.py tools/voice/story_jason_lines.json. The reference recording is never committed.",
    "out": out,
    "say": {"206,777": "two hundred six thousand, seven hundred seventy-seven dollars", "130-U": "one thirty U", "30-day": "thirty-day",
            "3.63": "three point six three", "n8n": "N eight N", "webDEALER": "web dealer", "SOP": "S O P"},
    "lines": mine}, indent=1, ensure_ascii=False) + "\n")
print(f"story_voice: {len(fict)} fictional lines, {len(mine)} of mine, {sum(1 for l in fict if l['who'] == 'you')} of them your thoughts")
