#!/usr/bin/env python3
"""Cut every reel in a project, and write what the motion layer needs.

    python build.py <project_dir> [reel ...]

Reads <project_dir>/project.json and the transcript it names. For each reel:
  <reel>.base.mp4       graded, upscaled 1080x1920 video with clean audio (+ subtle SFX)
  <reel>.timeline.json  words, hook, motion events and end card on the reel's own clock
  <reel>.en.srt / .hi.srt  subtitles for platforms that take a file

Pauses longer than edit.tighten_pauses_over are shortened, measured from the
AUDIO (RMS), never from transcript timings: a transcriber can miss a short
word, and cutting on its timings would clip it.
"""
import json, math, os, re, struct, subprocess, sys
from pathlib import Path

import numpy as np

W, H, FPS, SR = 1080, 1920, 30, 48000


def load(project_dir):
    pdir = Path(project_dir)
    proj = json.loads((pdir / "project.json").read_text())
    tr = json.loads((pdir / proj["transcript"]).read_text())
    words = [dict(w, w=w["w"].strip()) for s in tr["segments"] for w in s["words"]]
    root = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=pdir, capture_output=True, text=True).stdout.strip() or ".")
    for key, val in list(proj.get("brand", {}).items()):
        if key.startswith(("logo", "font")) and val and not os.path.isabs(val):
            proj["brand"][key] = str((root / val).resolve()) if (root / val).exists() else str((Path(__file__).resolve().parents[4] / val).resolve())
    if not os.path.isabs(proj["source"]):
        proj["source"] = str((pdir / proj["source"]).resolve())
    for fix in proj.get("word_fixes", []):
        for w in words:
            if w["w"] == fix["w"] and abs(w["s"] - fix["near"]) < 0.05:
                w["s"] = fix.get("set_s", w["s"])
                w["w"] = fix.get("set_w", w["w"])
    return pdir, proj, words


def norm(x):
    return re.sub(r"[^a-z0-9']", "", x.lower())


def resolver(words):
    def t(v):
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, dict) and "w" in v:
            for w in words:
                if w["s"] >= v.get("after", 0) and norm(w["w"]) == norm(v["w"]):
                    return (w["e"] if v.get("edge") == "e" else w["s"]) + v.get("plus", 0)
            raise SystemExit(f"anchor word not found: {v}")
        return v
    return t


def source_audio(src):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768


def silences(pcm, db, min_len):
    """[(start, end)] where 50 ms RMS stays under `db` for at least min_len seconds."""
    hop = SR // 20
    n = len(pcm) // hop
    rms = np.sqrt(np.mean(pcm[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    quiet = 20 * np.log10(rms) < db
    out, start = [], None
    for i, q in enumerate(list(quiet) + [False]):
        if q and start is None:
            start = i
        elif not q and start is not None:
            if (i - start) / 20 >= min_len:
                out.append((start / 20, i / 20))
            start = None
    return out


def refine(segments, gaps, pad, punch):
    """Split each (a, b, zoom) around long silences; alternate the zoom at every cut."""
    out = []
    for a, b, z in segments:
        cur, flip = a, False
        for s, e in gaps:
            cut_a, cut_b = s + pad, e - pad
            if cut_a > cur + 0.3 and cut_b < b - 0.05 and cut_b > cut_a:
                out.append((cur, cut_a, z + (punch if flip else 0)))
                cur, flip = cut_b, not flip
        out.append((cur, b, z + (punch if flip else 0)))
    return out


def mapper(segments):
    offs, t = [], 0.0
    for a, b, _ in segments:
        offs.append((a, b, t))
        t += b - a

    def to_out(x, clamp=False):
        for a, b, off in offs:
            if a - 1e-6 <= x <= b + 1e-6:
                return off + (x - a)
        if clamp:  # inside a removed pause or past the end: snap to the nearest kept edge before it
            before = [off + (b - a) for a, b, off in offs if x > b]
            after = [off for a, b, off in offs if x < a]
            return before[-1] if before else (after[0] if after else None)
        return None
    return to_out, t


def load_sfx(path, reverse, peak_db):
    """A supplied sound, mono 48 kHz, optionally reversed (an impact becomes a riser), at a fixed peak."""
    y = source_audio(path)
    y = y[::-1].copy() if reverse else y
    return y / (np.max(np.abs(y)) + 1e-9) * 10 ** (peak_db / 20)


def sfx_track(duration, hits, files=None):
    """A quiet bed of whooshes and ticks: synthesised, or from licensed files in edit.sfx_files.

    A supplied whoosh with "reverse": true is placed to END on its moment, so the
    swell lands as the type appears; ticks start on theirs.
    """
    out = np.zeros(int(duration * SR) + SR, dtype=np.float32)
    rng = np.random.default_rng(7)
    files = files or {}
    supplied = {k: load_sfx(v["path"], v.get("reverse", False), v.get("peak_db", -30 if k == "whoosh" else -33))
                for k, v in files.items()}
    for kind, at in hits:
        i = int(at * SR)
        if kind in supplied:
            y = supplied[kind]
            if files[kind].get("reverse"):
                i = max(0, i - len(y))
        elif kind == "whoosh":
            n = int(0.42 * SR)
            noise = rng.standard_normal(n).astype(np.float32)
            y, acc = np.empty(n, np.float32), 0.0
            cut = np.concatenate([np.linspace(0.02, 0.18, n // 2), np.linspace(0.18, 0.03, n - n // 2)])
            for k in range(n):  # one-pole low-pass whose cutoff rises then falls
                acc += cut[k] * (noise[k] - acc)
                y[k] = acc
            env = np.sin(np.linspace(0, math.pi, n)) ** 2
            y = y / (np.max(np.abs(y)) + 1e-9) * env * 10 ** (-30 / 20)
        else:  # tick
            n = int(0.07 * SR)
            tt = np.arange(n) / SR
            y = (np.sin(2 * math.pi * 1250 * tt) + 0.4 * np.sin(2 * math.pi * 2500 * tt)) * np.exp(-tt * 70)
            y = y / np.max(np.abs(y)) * 10 ** (-33 / 20)
        j = min(len(out), i + len(y))
        out[i:j] += y[: j - i]
    return out


def srt_time(t):
    t = max(0.0, t)
    return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(round((t % 1) * 1000)) % 1000:03d}"


def caption_chunks(words):
    """Same chunking as the overlay, so the SRT matches what is burned in."""
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        chars = len(" ".join(x["w"] for x in cur))
        new_sentence = bool(re.search(r"[.?!]$", w["w"])) and nxt is not None and nxt["w"][:1].isupper()
        next_finishes = (nxt is not None and bool(re.search(r"[.?!]$", nxt["w"]))
                         and chars + 1 + len(nxt["w"]) <= 44 and nxt["s"] - w["e"] <= .35)
        if not nxt or nxt["s"] - w["e"] > .35 or (re.search(r"[.?!,]$", w["w"]) and len(cur) >= 2) or new_sentence \
                or (chars > 30 and not next_finishes):
            out.append(cur)
            cur = []
    return out


def write_srt(path, cues):
    # A cue never runs into the next one.
    cues = [(a, min(b, cues[i + 1][0] - .02) if i + 1 < len(cues) else b, t) for i, (a, b, t) in enumerate(cues)]
    path.write_text("\n".join(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{text}\n" for i, (a, b, text) in enumerate(cues, 1)))


def build(pdir, proj, words, name):
    t = resolver(words)
    reel, edit = proj["reels"][name], proj["edit"]
    end_card = edit.get("end_card", 3.2)
    pcm = source_audio(proj["source"])
    src_len = len(pcm) / SR
    gaps = silences(pcm, edit.get("silence_db", -32), edit.get("tighten_pauses_over", 0.4))
    segs = refine([tuple(s) for s in reel["segments"]], gaps, edit.get("keep_pad", 0.12), edit.get("punch_zoom", 0.05))
    to_out, speech = mapper(segs)
    total = speech + end_card

    out_words = []
    for w in words:
        s, e = to_out(w["s"]), to_out(w["e"])
        if s is None and e is not None:
            s = e - min(0.3, w["e"] - w["s"])
        if e is None and s is not None:
            e = s + min(0.3, w["e"] - w["s"])
        if s is not None and e is not None:
            out_words.append({"w": w["w"], "s": round(s, 3), "e": round(e, 3)})

    events = []
    for ev in proj.get("events", []):
        s = to_out(t(ev["start"]))
        if s is None:
            continue
        ev2 = json.loads(json.dumps(ev))
        ev2["start"] = round(s, 3)
        ev2["end"] = round(total if ev["end"] == "END" else to_out(min(t(ev["end"]), src_len), clamp=True), 3)
        for key in ("bigAt", "strikeAt", "from"):
            if key in ev2:
                v = to_out(t(ev2[key]), clamp=True)
                ev2[key] = round(v if v is not None else ev2["start"], 3)
        for row in ev2.get("rows", []) + ev2.get("steps", []):
            for key in ("at", "rightAt"):
                if key in row:
                    v = to_out(t(row[key]))
                    row[key] = round(v, 3) if v is not None else None
        events.append(ev2)

    hook = dict(proj["hook"])
    hook["end"] = round(to_out(t(proj["hook"]["end"]), clamp=True), 3)
    timeline = {"duration": round(total, 3), "speechEnd": round(speech, 3), "fps": FPS,
                "kicker": reel["kicker"], "typeOnly": reel.get("typeOnly", False), "hook": hook,
                "brand": proj["brand"], "words": out_words, "events": events,
                "segments": [[round(a, 3), round(b, 3), round(z, 3)] for a, b, z in segs]}

    # Video and voice.
    parts, ins = [], []
    for i, (a, b, z) in enumerate(segs):
        d, push = b - a, edit.get("push_in", 0.035)
        parts.append(
            f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS,fps={FPS},scale={W}:{H}:flags=lanczos,"
            f"scale=w='trunc({W}*({z}+{push}*t/{d})/2)*2':h='trunc({H}*({z}+{push}*t/{d})/2)*2':eval=frame:flags=lanczos,"
            f"crop={W}:{H},setsar=1[v{i}];"
            f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={max(0, d - .012)}:d=0.012[a{i}];")
        ins.append(f"[v{i}][a{i}]")
    graph = "".join(parts) + "".join(ins) + f"concat=n={len(segs)}:v=1:a=1[vc][ac];" \
        "[vc]eq=contrast=1.04:saturation=0.93,colorbalance=rm=0.02:bm=-0.02,unsharp=5:5:0.5,vignette=PI/6," \
        f"tpad=stop_mode=clone:stop_duration={end_card},format=yuv420p[vo];" \
        f"[ac]highpass=f=80,afftdn=nf=-28,loudnorm=I=-14:TP=-1.5:LRA=11,aresample={SR},apad=pad_dur={end_card}[ao]"
    voice = pdir / f"{name}.voice.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", proj["source"], "-filter_complex", graph,
                    "-map", "[vo]", "-map", "[ao]", "-t", f"{total:.3f}", "-c:v", "libx264", "-preset", "medium",
                    "-crf", "16", "-r", str(FPS), "-c:a", "pcm_s16le", str(voice.with_suffix(".mkv"))], check=True)
    base = pdir / f"{name}.base.mp4"
    if edit.get("sfx", False):
        hits = []
        for ev in events:
            hits.append(("whoosh", ev["start"] if edit.get("sfx_files", {}).get("whoosh", {}).get("reverse") else max(0, ev["start"] - 0.12)))
            for row in ev.get("rows", []) + ev.get("steps", []):
                if row.get("at") is not None:
                    hits.append(("tick", row["at"]))
        hits.append(("whoosh", speech + 0.05))
        files = {k: dict(v, path=v["path"] if os.path.isabs(v["path"]) else str(pdir / v["path"]))
                 for k, v in edit.get("sfx_files", {}).items()}
        bed = sfx_track(total, hits, files)
        sfx_wav = pdir / f"{name}.sfx.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        str(sfx_wav)], input=bed.tobytes(), check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(voice.with_suffix(".mkv")), "-i", str(sfx_wav),
                        "-filter_complex", "[0:a][1:a]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89[a]",
                        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", str(base)], check=True)
        timeline["sfx"] = hits
    else:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(voice.with_suffix(".mkv")), "-c:v", "copy",
                        "-c:a", "aac", "-b:a", "192k", str(base)], check=True)
    voice.with_suffix(".mkv").unlink()

    # Loudness of the finished mix, per frame, for the type-only meter.
    if reel.get("typeOnly"):
        mix = source_audio(str(base))
        step = SR // FPS
        n = len(mix) // step
        lv = np.sqrt(np.mean(mix[: n * step].reshape(n, step) ** 2, axis=1))
        peak = float(np.quantile(lv, .98)) or 1.0
        timeline["levels"] = [round(float(min(1, v / peak)), 3) for v in lv]

    (pdir / f"{name}.timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1))

    # Subtitles: English from the burned-in chunks; Hindi from the project's cues.
    en = [(c[0]["s"], c[-1]["e"] + .2, " ".join(w["w"] for w in c)) for c in caption_chunks(out_words)]
    write_srt(pdir / f"{name}.en.srt", en)
    hi = []
    for a, b, text in proj.get("subtitles_hi", []):
        oa, ob = to_out(a), to_out(b, clamp=True)
        if oa is not None and ob is not None and ob > oa:
            hi.append((oa, ob + .2, text))
    if hi:
        write_srt(pdir / f"{name}.hi.srt", hi)
    print(f"{name}: {len(segs)} cuts, speech {speech:.2f}s (was {sum(b - a for a, b, _ in reel['segments']):.2f}s), "
          f"total {total:.2f}s, events {len(events)}, words {len(out_words)}, hi cues {len(hi)}")


def srt_only(pdir, name):
    """Rewrite the English SRT from an existing timeline, without re-encoding anything."""
    tl = json.loads((pdir / f"{name}.timeline.json").read_text())
    write_srt(pdir / f"{name}.en.srt", [(c[0]["s"], c[-1]["e"] + .2, " ".join(w["w"] for w in c))
                                         for c in caption_chunks(tl["words"])])


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    pdir, proj, words = load(args[0])
    for name in args[1:] or proj["reels"]:
        if "--srt-only" in sys.argv:
            srt_only(pdir, name)
        else:
            build(pdir, proj, words, name)
