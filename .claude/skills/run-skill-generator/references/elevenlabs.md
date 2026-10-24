# ElevenLabs (optional)

The pipeline runs fully without ElevenLabs: Whisper transcribes, a second Whisper
pass (bigger model, or just the disputed slice) gives the second opinion, and
`build.py` synthesises its own whoosh and tick. ElevenLabs adds a stronger
second transcription (Scribe) and generated sound effects. At intake, ask the
user whether they want it; if they do and no key is set, give them the steps below.

## Getting a key (for the user)

1. Sign in at elevenlabs.io and open the **API Keys** page (under Developers /
   Settings in the app).
2. **Create API Key**, turn **Restrict Key** on, and allow only what this skill
   calls: **Speech to Text**, **Sound Effects** (and **Audio Isolation** if they
   want voice cleanup). Leave everything else off.
3. Put the key where only this session's tools can read it — never in the chat:
   - **Claude Code on the web:** the environment's settings (cloud environment menu
     in the session title bar → Edit) → add it as a secret or environment
     variable named `ELEVENLABS_API_KEY`. New sessions pick it up.
   - **Claude Code on your own computer:** store it in a private file, then export it:
     ```bash
     umask 077; mkdir -p ~/.secrets
     read -rs -p "ElevenLabs key: " k; printf '%s' "$k" > ~/.secrets/elevenlabs; unset k
     export ELEVENLABS_API_KEY=$(cat ~/.secrets/elevenlabs)
     ```
4. Check it: `python scripts/elevenlabs.py credits` prints the plan and credits left.
5. When the work is done, delete or rotate the key on the same page. Rotate it at
   once if it was ever pasted into a chat, email or ticket.

## What uses it

| Use | Command | Cost / licence |
|---|---|---|
| Plan and credits | `python scripts/elevenlabs.py credits` | free |
| Second-opinion transcript | `transcribe.py … --scribe [--stt-model scribe_v2] [--slice a,b]` | uses credits (a full 80 s talk took ~2,000 on Scribe); text for your own checking |
| Sound effects | `elevenlabs.py sfx "<prompt>" 0.8 out.mp3`, then `edit.sfx_files` in project.json | ElevenLabs' sound-effects pages allow free-plan commercial use **with attribution** — put the attribution line in the caption, not the video |
| Voice isolation | `elevenlabs.py isolate in.wav out.mp3` | paid plan for commercial use |

Generated sounds are checked by measurement before use (length, peak, envelope,
spectral centroid): a "whoosh" that measures as a front-loaded low thump can be
reversed into a riser (`"reverse": true`) or replaced by the synthesised one.

Free plan: ElevenLabs' help centre says content made outside a paid subscription
is not for commercial use; its sound-effects pages say attribution is enough for
sound effects. `elevenlabs.py` stops generating calls on a free plan unless
`--non-commercial` is passed, and the user decides which reading applies.

A real person's voice is cloned, dubbed or synthesised only with their explicit,
recorded consent.

Sources: elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform ·
elevenlabs.io/sound-effects/commercial · elevenlabs.io/docs/help-center/technical/how-do-i-authorize-myself-using-an-api-key
