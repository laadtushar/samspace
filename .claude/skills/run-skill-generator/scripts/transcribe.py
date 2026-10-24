#!/usr/bin/env python3
"""Word-level transcript of a video, and a second opinion where words disagree.

    python transcribe.py <video> <project_dir> [--model medium] [--scribe]

Writes <project_dir>/transcript.json (faster-whisper, offline). With --scribe and
ELEVENLABS_API_KEY set, also writes scribe.json (ElevenLabs speech-to-text) and
prints every place the two disagree, so a caption never guesses at a word
(a dropped "not" can invert a sentence). Also prints low-confidence words.
"""
import argparse, difflib, json, os, re, subprocess, sys, tempfile
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("video"); ap.add_argument("project_dir")
ap.add_argument("--model", default="medium")
ap.add_argument("--scribe", action="store_true")
ap.add_argument("--stt-model", default="scribe_v2", help="ElevenLabs speech-to-text model (scribe_v1, scribe_v2, ...)")
ap.add_argument("--slice", help="start,end in seconds: transcribe only this part (for a third opinion on one word)")
args = ap.parse_args()
pdir = Path(args.project_dir); pdir.mkdir(parents=True, exist_ok=True)

wav = pdir / "audio.16k.wav"
cut = ["-ss", args.slice.split(",")[0], "-to", args.slice.split(",")[1]] if args.slice else []
subprocess.run(["ffmpeg", "-v", "error", "-y", *cut, "-i", args.video, "-ac", "1", "-ar", "16000", str(wav)], check=True)
offset = float(args.slice.split(",")[0]) if args.slice else 0.0

from faster_whisper import WhisperModel
model = WhisperModel(args.model, device="cpu", compute_type="int8")
segs, info = model.transcribe(str(wav), word_timestamps=True, vad_filter=True, beam_size=5)
out = {"language": info.language, "prob": info.language_probability, "segments": []}
for s in segs:
    out["segments"].append({"start": s.start + offset, "end": s.end + offset, "text": s.text,
                            "words": [{"w": w.word, "s": w.start + offset, "e": w.end + offset, "p": w.probability} for w in s.words]})
(pdir / ("transcript.json" if not args.slice else f"transcript.{args.slice.replace(',', '-')}.json")).write_text(json.dumps(out, ensure_ascii=False, indent=1))
words = [w for s in out["segments"] for w in s["words"]]
print(f"language {info.language} ({info.language_probability:.2f}), {len(words)} words")
for s in out["segments"]:
    print(f"{s['start']:7.2f}-{s['end']:7.2f} {s['text'].strip()}")
low = [(round(w["s"], 2), w["w"].strip()) for w in words if w["p"] < 0.6]
print("low-confidence words:", low or "none")

if args.scribe:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("--scribe needs ELEVENLABS_API_KEY in the environment (never pass the key on the command line)")
    r = subprocess.run(["curl", "-sS", "https://api.elevenlabs.io/v1/speech-to-text", "-H", f"xi-api-key: {key}",
                        "-F", f"model_id={args.stt_model}", "-F", f"file=@{wav}", "-F", "timestamps_granularity=word",
                        "-F", "tag_audio_events=false"], capture_output=True, text=True, check=True)
    scribe = json.loads(r.stdout)
    if "words" not in scribe:
        sys.exit(f"Scribe error: {str(scribe)[:300]}")
    for w in scribe["words"]:
        w["start"] = w.get("start", 0) + offset; w["end"] = w.get("end", 0) + offset
    (pdir / f"{args.stt_model}{'.' + args.slice.replace(',', '-') if args.slice else ''}.json").write_text(json.dumps(scribe, ensure_ascii=False, indent=1))
    a = [re.sub(r"[^a-z0-9']", "", w["w"].lower()) for w in words]
    sw = [w for w in scribe["words"] if w.get("type") == "word"]
    b = [re.sub(r"[^a-z0-9']", "", w["text"].lower()) for w in sw]
    print("\nwhere the two transcripts disagree (check these by ear):")
    n = 0
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if tag != "equal":
            t = words[i1]["s"] if i1 < len(words) else sw[j1]["start"]
            print(f"  ~{t:6.2f}s  whisper: {' '.join(a[i1:i2]) or '—'}   scribe: {' '.join(b[j1:j2]) or '—'}")
            n += 1
    print(f"  {n} difference(s)")
