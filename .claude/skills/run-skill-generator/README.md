# run-skill-generator

Give Claude Code one raw video; get back an audited marketing pack: several reel
cuts with motion type and word-by-word captions, covers, subtitles (EN + any
language you supply), a carousel, quote posts, Story frames, captions for every
post, a posting plan, and a page to download it all.

## Install

Copy this folder to either place:

- `<your repo>/.claude/skills/run-skill-generator/` — for one project (commit it to share), or
- `~/.claude/skills/run-skill-generator/` — for every project on your machine.

Needs: `ffmpeg`, Python 3, Node with `playwright` in the repo (`npm i -D playwright`
and `npx playwright install chromium` if it isn't). `scripts/setup.sh` checks all of
it and installs faster-whisper into its own environment.

## Use

In Claude Code, attach or point to the video and type:

```
/run-skill-generator
```

Claude asks a few questions (brand, goal, platforms, versions, languages, notices,
ElevenLabs yes/no), then transcribes, fact-checks, plans, renders, audits and
publishes the pack. It is user-invoked only, so it never fires on its own and
adds nothing to other conversations.

ElevenLabs is optional. If you want it, `references/elevenlabs.md` explains how to
create a restricted key and where to store it (never in the chat).

## What's inside

- `SKILL.md` — the steps Claude follows
- `scripts/` — transcription, build, motion render, compose, cards, audit, page, ElevenLabs helpers
- `templates/` — motion overlay, card and page templates; a worked example project
- `references/` — project schema, platform specs, marketing playbook (with sources), ElevenLabs guide
- `extras/samvriti-reel-scripts-v2/` — an updated version of the Samvriti reel-writing
  skill with the 2026 research added; upload it to claude.ai to replace the old one
