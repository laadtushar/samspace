#!/usr/bin/env python3
"""Builds the delivery page for a project.

    python make_page.py <project_dir> <assets.json> <out.html> [--skill-dir DIR]

assets.json maps each uploaded file name (as in out/) to its artifact asset URL.
Text (kit, audit, subtitles, the skill pack itself) is embedded in the page.
Every download goes through the `downloads` capability; "Download everything"
zips the lot in the browser with JSZip.
"""
import argparse, html, json, re
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("project_dir"); ap.add_argument("assets"); ap.add_argument("out")
ap.add_argument("--skill-dir")
ap.add_argument("--masters", help="link to full-quality masters (e.g. a media-only git branch)")
a = ap.parse_args()
pdir = Path(a.project_dir); out = pdir / "out"
proj = json.loads((pdir / "project.json").read_text())
assets = json.loads(Path(a.assets).read_text())
b = proj["brand"]; c = b["colors"]; name = proj["name"]


def text(p):
    return p.read_text() if p.exists() else ""


reels = []
info = proj.get("delivery", {}).get("reels", {})
for r, cfg in proj["reels"].items():
    tl = json.loads((pdir / f"{r}.timeline.json").read_text())
    base = f"{name}-{r}"
    reels.append({
        "id": r, "title": info.get(r, {}).get("title", r), "use": info.get(r, {}).get("use", ""),
        "length": f"{int(tl['duration'] // 60)}:{int(tl['duration'] % 60):02d}",
        "video": assets.get(f"{base}.mp4"), "cover": assets.get(f"{base}-cover.jpg"),
        "files": {k: f"{base}{k}" for k in (".mp4", "-cover.jpg")},
        "srt": {lang: text(out / f"{base}.{lang}.srt") for lang in ("en", "hi") if (out / f"{base}.{lang}.srt").exists()},
        "caption": info.get(r, {}).get("caption", ""),
    })

cards = [{"id": c_["id"], "w": c_["w"], "h": c_["h"], "url": assets.get(f"cards/{c_['id']}.png")}
         for c_ in json.loads((pdir / "cards.json").read_text())]

skill = {}
if a.skill_dir:
    sd = Path(a.skill_dir)
    for f in sorted(sd.rglob("*")):
        if f.is_file() and "__pycache__" not in f.parts and f.suffix in (".md", ".py", ".sh", ".mjs", ".html", ".json"):
            skill[str(f.relative_to(sd.parent))] = f.read_text()

data = {"name": name, "reels": reels, "cards": cards, "kit": text(out / "MARKETING-KIT.md"),
        "audit": text(out / "AUDIT.md"), "skill": skill, "masters": a.masters, "brand": {"handle": b["handle"], "site": b["site"]}}
blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")

page = (Path(__file__).parent.parent / "templates" / "page.html").read_text()
page = page.replace("__DATA__", blob)
for k, v in {"--ink": c["ink"], "--ground": c["ground"], "--paper": c["paper"], "--calm": c["calm"],
             "--calm-l": c["calm_light"], "--accent": c["accent"], "--accent-l": c["accent_light"]}.items():
    page = page.replace(f"{k}:#000", f"{k}:{v}")
page = page.replace("__TITLE__", html.escape(proj.get("delivery", {}).get("page_title", f"{name} marketing pack")))
Path(a.out).write_text(page)
print(f"wrote {a.out} ({len(page) / 1024:.0f} KB): {len(reels)} reels, {len(cards)} cards, {len(skill)} skill files")
