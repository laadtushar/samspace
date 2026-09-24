#!/usr/bin/env bash
# getreel.sh — download one Instagram reel, build a 3x2 contact sheet, print its metrics.
#
#   ./getreel.sh <SHORTCODE> [SESSION] [N_FRAMES]
#
# Requires: opencli (with the Chrome extension connected), curl, ffmpeg, python3.
# Reads only. Never posts, likes or follows.

set -euo pipefail

SC="${1:?usage: ./getreel.sh <SHORTCODE> [SESSION] [N_FRAMES]}"
SESSION="${2:-research}"
N="${3:-6}"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

# The tab must be on instagram.com before any eval, or fetch() is blocked by CORS.
opencli browser "$SESSION" open "https://www.instagram.com/" >/dev/null 2>&1 || true
sleep 2

JS='(async()=>{
const AB="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function pk(s){let n=0n;for(const c of s){n=n*64n+BigInt(AB.indexOf(c));}return n.toString();}
const r=await fetch("/api/v1/media/"+pk("'"$SC"'")+"/info/",
  {headers:{"x-ig-app-id":"936619743392459"},credentials:"include"});
const d=await r.json();const m=d.items&&d.items[0];
if(!m)return JSON.stringify({err:"no media"});
return JSON.stringify({
  plays:m.play_count||m.ig_play_count, likes:m.like_count, cmts:m.comment_count,
  rp:m.media_repost_count, dur:m.video_duration, user:m.user&&m.user.username,
  cap:((m.caption&&m.caption.text)||"").replace(/\s+/g," "),
  url:m.video_versions&&m.video_versions[0].url});})()'

if command -v timeout >/dev/null 2>&1; then
  timeout 90 opencli browser "$SESSION" eval "$JS" 2>/dev/null | tail -1 > "meta_$SC.json"
elif command -v gtimeout >/dev/null 2>&1; then
  gtimeout 90 opencli browser "$SESSION" eval "$JS" 2>/dev/null | tail -1 > "meta_$SC.json"
else
  # macOS does not include timeout by default. OpenCLI has its own browser-operation timeout,
  # so keep the workflow usable without requiring GNU coreutils.
  opencli browser "$SESSION" eval "$JS" 2>/dev/null | tail -1 > "meta_$SC.json"
fi

python3 - "$SC" "$N" "$UA" <<'PY'
import sys, json, io, os, subprocess
sc, n, ua = sys.argv[1], int(sys.argv[2]), sys.argv[3]

d = json.load(io.open(f"meta_{sc}.json", encoding="utf-8"))
if d.get("err"):
    raise SystemExit(f"could not read media: {d['err']}")

dur = float(d["dur"])
if not os.path.exists(f"{sc}.mp4"):
    subprocess.run(["curl", "-sL", "-A", ua, d["url"], "-o", f"{sc}.mp4"], check=True)

ts = [round(dur * (i + 0.5) / n, 2) for i in range(n)]
ts[0] = min(0.8, dur / (2 * n))
for i, t in enumerate(ts):
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-ss", str(t),
                    "-i", f"{sc}.mp4", "-frames:v", "1", "-vf", "scale=360:-2",
                    f"_t{i}.jpg", "-y"], check=False)

if n == 6:
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error",
                    "-i", "_t0.jpg", "-i", "_t1.jpg", "-i", "_t2.jpg",
                    "-i", "_t3.jpg", "-i", "_t4.jpg", "-i", "_t5.jpg",
                    "-filter_complex",
                    "[0][1][2]hstack=3[a];[3][4][5]hstack=3[b];[a][b]vstack=2",
                    "-q:v", "3", f"{sc}_SHEET.jpg", "-y"], check=False)

subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", f"{sc}.mp4",
                "-ac", "1", "-ar", "16000", f"{sc}.wav", "-y"], check=False)

g = lambda k: d.get(k) or 0
print(f"@{d.get('user')} | {g('plays'):,} views | {g('likes'):,} likes | "
      f"{g('cmts'):,} comments | {g('rp'):,} shares | {dur:.0f}s")
print("frames at:", ", ".join(f"{t}s" for t in ts))
print("caption:", d.get("cap", "")[:400])
print(f"\nnext: transcribe {sc}.wav  ->  see SKILL.md section 3")
PY
