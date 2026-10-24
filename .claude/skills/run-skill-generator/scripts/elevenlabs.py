#!/usr/bin/env python3
"""Small, explicit ElevenLabs helpers. The key comes only from ELEVENLABS_API_KEY.

    python elevenlabs.py credits
    python elevenlabs.py isolate <in.wav> <out.mp3>      # voice isolation (cleanup)
    python elevenlabs.py sfx "<prompt>" <seconds> <out.mp3>

Every generating command first checks the plan. On a free plan it stops unless
--non-commercial is passed, because ElevenLabs' help centre says content made
outside a paid subscription may not be used commercially, and marketing a
practice is commercial use. Speech-to-text for checking captions lives in
transcribe.py --scribe; it produces text for your own review, not media.
"""
import json, os, subprocess, sys

API = "https://api.elevenlabs.io/v1"


def key():
    k = os.environ.get("ELEVENLABS_API_KEY")
    if not k:
        sys.exit("Set ELEVENLABS_API_KEY in the environment (e.g. `export ELEVENLABS_API_KEY=$(cat ~/.secrets/elevenlabs)`).")
    return k


def call(args, out=None):
    cmd = ["curl", "-sS", "-f", "-H", f"xi-api-key: {key()}"] + args
    if out:
        cmd += ["-o", out]
    r = subprocess.run(cmd, capture_output=True, text=not out)
    if r.returncode != 0:
        sys.exit(f"ElevenLabs request failed ({r.returncode}): {r.stderr[:300] if isinstance(r.stderr, str) else r.stderr[:300]!r}")
    return r.stdout


def plan():
    d = json.loads(call([f"{API}/user/subscription"]))
    return d["tier"], d["character_count"], d["character_limit"]


def guard():
    tier, used, limit = plan()
    print(f"plan {tier}: {used}/{limit} credits used")
    if tier == "free" and "--non-commercial" not in sys.argv:
        sys.exit("Free plan: output may not be used commercially. Re-run with --non-commercial for drafts only, "
                 "or upgrade before using the result in marketing.")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "credits"
    if cmd == "credits":
        tier, used, limit = plan()
        print(f"plan {tier}: {used}/{limit} credits used, {limit - used} left")
    elif cmd == "isolate":
        guard()
        call(["-X", "POST", f"{API}/audio-isolation", "-F", f"audio=@{sys.argv[2]}"], out=sys.argv[3])
        print("wrote", sys.argv[3])
    elif cmd == "sfx":
        guard()
        body = json.dumps({"text": sys.argv[2], "duration_seconds": float(sys.argv[3]), "prompt_influence": 0.4})
        call(["-X", "POST", f"{API}/sound-generation", "-H", "Content-Type: application/json", "-d", body], out=sys.argv[4])
        print("wrote", sys.argv[4])
    else:
        sys.exit(__doc__)
