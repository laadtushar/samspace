---
name: run-skill-generator
description: Raw video in, audited marketing pack out — reels in several cuts with motion type and captions, covers, subtitles, carousel, quote posts, Story frames, captions and a posting plan, delivered as one download page.
disable-model-invocation: true
---

One raw video becomes a set of ready-to-post files. The pipeline is scripted
(`scripts/`, each with `--help`-style docstrings), driven by one `project.json`
per video. Work in the session scratchpad; deliver through an Artifact.

## Guardrails

- **Every word on screen is heard.** Captions and type come from the speaker's
  audio, checked by two transcribers. A caption you write carries only claims the
  speaker made or a source supports.
- **Config holds the specifics.** Brand, copy, cuts and timings live in
  `project.json` / `cards.json`; scripts stay client-free.
- **Keys live in the environment.** `ELEVENLABS_API_KEY` comes from the
  environment's secrets or a 600-mode file outside any repo; it appears in no chat,
  command line, log, file or output. ElevenLabs is optional — every step has an
  offline path.
- **Licensed or self-made media only.** Synthesised SFX (built into `build.py`),
  platform music libraries, and generated media whose licence covers the use
  (`references/elevenlabs.md`). A real person's voice is cloned or dubbed only with
  their recorded consent.

## Steps

### 1. Intake
Ask, in one message with defaults so one-word answers work: brand kit, goal,
platforms, versions, subtitle languages, must-keep/must-cut lines and notices,
whether an account voice skill exists (if so, load it — it writes every hook and
caption), and whether to use ElevenLabs (optional; if yes and `ELEVENLABS_API_KEY`
is unset, give them the steps in `references/elevenlabs.md`). **Done when** each of
the eight has an answer or an accepted default.

### 2. Setup
`bash scripts/setup.sh`, then `export RSG=$HOME/.cache/run-skill-generator/venv/bin/python`
— **done when** it prints a faster-whisper version and a Playwright source.

### 3. Transcribe — every word heard
`$RSG scripts/transcribe.py <video> <project_dir>`, plus `--scribe` when
ElevenLabs is in use. Without it, the second opinion is Whisper again with a
bigger model (`--model large-v3`) on each doubtful slice (`--slice a,b`).
For each low-confidence word and each disagreement: measure the audio around it
(50 ms RMS) and take a third reading on just that slice (another model). Choose the reading that matches the speaker's
own next sentence; tell the user any word chosen by sense rather than sound.
**Done when** every listed disagreement has a decision written in your notes.

### 4. Fact-check
Search every research or factual claim the speaker makes; record what supports
it and what does not, with links, for the user. The speaker's words stay in the
video unless the user says otherwise. **Done when** each claim has a verdict and a link.

### 5. Plan
Read `references/marketing-playbook.md`, then write `project.json`
(`references/project-schema.md`; worked example `templates/project.example.json`)
and `cards.json`. Hook = the line naming a feeling or behaviour in the first 3 s.
Cuts = time ranges per version. Motion events = 5–10 moments, one idea each, with
the face visible between them. **Done when** every requested version has segments
and every event anchors to a spoken word.

### 6. Contact sheet
`$RSG scripts/build.py <project_dir>`, then render 8–12 stills
(`node scripts/render.mjs <project_dir> <reel> t1,t2,…`), composite them over the
base video into one contact sheet, and look. **Done when** the sheet shows the hook
legible off the face, type landing with the voice, every event once, and the end
card — fix config/templates and repeat until it does.

### 7. Render and audit — PASS
`bash scripts/make_all.sh <project_dir>` in the background (the script waits for
its own children; stop only PIDs you started). `scripts/audit.py` checks every
file against `references/platform-specs.md`. **Done when** `out/AUDIT.md` ends in PASS.

### 8. Kit
Write `out/MARKETING-KIT.md` (worked example `templates/MARKETING-KIT.example.md`)
in the account's voice. **Done when** every file in `out/` has a post plan, every
post has a caption, and the user's open checks (words by ear, translations by eye,
notices, attributions) are listed.

### 9. Deliver
Load `artifact-design` and `artifact-capabilities`; publish one page that previews
every video and image with a Download button each (`downloads`), videos and images
in the artifact's asset store (`assets`, 20 MiB each — encode a delivery copy to
fit), text inline, and a whole-pack zip built in the browser. **Done when** the page
is published and one read-back shows every asset URL resolving.

## Files
`scripts/` setup.sh · transcribe.py · build.py · render.mjs · compose.sh ·
render_cards.mjs · make_all.sh · audit.py · elevenlabs.py
`templates/` overlay.html · card.html · project.example.json · cards.example.json ·
MARKETING-KIT.example.md
`references/` project-schema.md · platform-specs.md · marketing-playbook.md · elevenlabs.md
