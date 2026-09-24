#!/usr/bin/env python3
"""Transcribe a reel's audio without losing the opening seconds.

    python transcribe.py <SHORTCODE>

The defaults in faster-whisper silently drop the first seconds when music sits over the speech
or the speaker is fast. That is exactly where the hook lives. These parameters turn every
drop-heuristic off.

If the first printed line is not [ 0.0s], the transcript is truncated. Run it again.
"""
import os
import subprocess
import sys

from faster_whisper import WhisperModel

sc = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
wav = f"{sc}.wav"

if not os.path.exists(wav):
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", f"{sc}.mp4",
                    "-ac", "1", "-ar", "16000", wav, "-y"], check=True)

model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    wav,
    vad_filter=False,
    condition_on_previous_text=False,
    no_speech_threshold=1.0,           # never drop a segment as "no speech"
    log_prob_threshold=None,           # never drop on low confidence
    compression_ratio_threshold=None,  # never drop on repetition
    temperature=[0.0, 0.2, 0.4],
    beam_size=5,
)

print(f"[language: {info.language}]")

first = None
count = 0
for s in segments:
    if first is None:
        first = s.start
    print(f"[{s.start:6.1f}s] {s.text.strip()}")
    count += 1

if count == 0:
    print("(NO SPEECH)")
    print("\nThis is a finding, not a failure: the whole script lives in the on-screen text.")
    print("Confirm it by looking at the frames before you write anything.")
elif first and first > 1.5:
    print(f"\n!! WARNING: transcript starts at {first:.1f}s, not 0.0s.")
    print("!! It is almost certainly truncated and you are missing the hook. Run it again.")
    print("!! If there really is no speech before that, confirm it in the frames.")
