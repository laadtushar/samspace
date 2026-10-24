#!/usr/bin/env python3
"""Checks every finished file in <project_dir>/out against platform specs.

    python audit.py <project_dir>

Writes <project_dir>/out/AUDIT.md and exits non-zero if anything fails.
Checks: resolution, frame rate, codecs, duration vs timeline, audio/video length
match, integrated loudness and true peak, file size per platform, the safe-area
report from render.mjs, subtitle cue order, and that card images have the
size their platform expects.
"""
import json, re, subprocess, sys
from pathlib import Path

LIMITS = {  # bytes; the tightest common upload path for each format
    "reel": 250 * 1024 * 1024,   # Instagram via app is far higher; WhatsApp status is the tight one at 16 MB
    "whatsapp": 16 * 1024 * 1024,
}


def probe(f):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(f)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def loudness(f):
    err = subprocess.run(["ffmpeg", "-nostats", "-i", str(f), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    summary = err[err.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", summary)
    tp = re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary)
    return float(i.group(1)), float(tp.group(1))


def srt_ok(f):
    times = re.findall(r"(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})", f.read_text())
    last = -1
    for t in times:
        a = int(t[0]) * 3600 + int(t[1]) * 60 + int(t[2]) + int(t[3]) / 1000
        b = int(t[4]) * 3600 + int(t[5]) * 60 + int(t[6]) + int(t[7]) / 1000
        if a < last - 1e-3 or b <= a:
            return False, len(times)
        last = b
    return True, len(times)


def main(pdir):
    pdir = Path(pdir)
    proj = json.loads((pdir / "project.json").read_text())
    out = pdir / "out"
    rows, fails = [], []
    for reel in proj["reels"]:
        f = out / f"{proj['name']}-{reel}.mp4"
        if not f.exists():
            fails.append(f"{reel}: missing")
            continue
        p = probe(f)
        v = next(s for s in p["streams"] if s["codec_type"] == "video")
        a = next((s for s in p["streams"] if s["codec_type"] == "audio"), None)
        tl = json.loads((pdir / f"{reel}.timeline.json").read_text())
        dur = float(p["format"]["duration"])
        vdur, adur = float(v.get("duration", dur)), float(a.get("duration", dur)) if a else 0
        fps = eval(v["r_frame_rate"])
        lufs, tp = loudness(f)
        size = f.stat().st_size
        safe = json.loads((pdir / f"{reel}.safezone.json").read_text()) if (pdir / f"{reel}.safezone.json").exists() else None
        checks = {
            "1080x1920": (v["width"], v["height"]) == (1080, 1920),
            "30 fps": abs(fps - 30) < 0.01,
            "h264/aac": v["codec_name"] == "h264" and a is not None and a["codec_name"] == "aac",
            "length matches timeline": abs(dur - tl["duration"]) < 0.15,
            "audio = video length": abs(vdur - adur) < 0.15,
            "loudness -15..-13 LUFS": -15.0 <= lufs <= -13.0,
            "true peak <= -1 dBFS": tp <= -1.0,
            "safe area clear": safe is not None and len(safe) == 0,
            "fits WhatsApp (16 MB)": size <= LIMITS["whatsapp"],
        }
        for srt in sorted(out.glob(f"{proj['name']}-{reel}.*.srt")):
            ok, n = srt_ok(srt)
            checks[f"{srt.name.split('.')[-2]} subtitles ordered ({n} cues)"] = ok
        hard = {k: v for k, v in checks.items() if k != "fits WhatsApp (16 MB)"}
        if not all(hard.values()):
            fails.append(f"{reel}: " + ", ".join(k for k, ok in hard.items() if not ok))
        rows.append((reel, dur, lufs, tp, size, checks))

    cards = out / "cards"
    card_rows = []
    for c in json.loads((pdir / "cards.json").read_text()) if (pdir / "cards.json").exists() else []:
        f = cards / f"{c['id']}.png"
        if not f.exists():
            fails.append(f"card {c['id']}: missing")
            continue
        s = next(x for x in probe(f)["streams"] if x["codec_type"] == "video")
        ok = (s["width"], s["height"]) == (c["w"], c["h"])
        card_rows.append((c["id"], s["width"], s["height"], ok))
        if not ok:
            fails.append(f"card {c['id']}: wrong size")

    lines = ["# Audit", "", f"Project: {proj['name']}", "",
             "| File | Length | Loudness | True peak | Size | Checks |", "|---|---|---|---|---|---|"]
    for reel, dur, lufs, tp, size, checks in rows:
        failed = [k for k, ok in checks.items() if not ok]
        lines.append(f"| {proj['name']}-{reel}.mp4 | {dur:.1f}s | {lufs:.1f} LUFS | {tp:.1f} dBFS | "
                     f"{size / 1048576:.1f} MB | {'all pass' if not failed else 'FAIL/NOTE: ' + ', '.join(failed)} |")
    if card_rows:
        lines += ["", "| Card | Size | OK |", "|---|---|---|"]
        lines += [f"| {i}.png | {w}x{h} | {'yes' if ok else 'NO'} |" for i, w, h, ok in card_rows]
    lines += ["", "Result: " + ("PASS" if not fails else "FAIL — " + "; ".join(fails))]
    (out / "AUDIT.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main(sys.argv[1])
