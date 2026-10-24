# project.json

All times are **source** seconds. Wherever a time is expected you may anchor it to
a spoken word instead: `{"w": "word", "after": 12.0, "edge": "s"|"e", "plus": 0.1}`
(first match of `word` starting after `after`; `edge` start/end; `plus` offset).
`build.py` maps everything to each reel's own clock, so one set of cues serves
every cut.

```jsonc
{
  "name": "anger",                       // prefix for output files
  "source": "path/to/raw.mp4",           // absolute, or relative to the project dir
  "transcript": "transcript.json",       // from transcribe.py
  "word_fixes": [{"w": "So", "near": 56.18, "set_s": 56.57, "why": "..."}],
  "brand": {
    "handle": "@account", "site": "example.com",
    "end_tagline": "One line in the brand's voice.", "end_cta": "What you offer",
    "logo_light": "public/brand/lockup-reversed.svg",   // for dark grounds; repo-relative OK
    "logo_dark":  "public/brand/lockup-color.svg",      // for light cards
    "font_head": "…/Serif-SemiBold.ttf", "font_text": "…/Sans-Regular.ttf", "font_text_medium": "…/Sans-Medium.ttf",
    "colors": {"ink": "#…", "ground": "#…", "paper": "#…", "calm": "#…", "calm_light": "#…",
               "accent": "#…", "accent_light": "#…"}
  },
  "edit": {
    "tighten_pauses_over": 0.4,   // shorten silences longer than this (measured on audio)
    "keep_pad": 0.12,             // silence kept either side of a cut
    "silence_db": -32,            // RMS threshold for "silence"
    "punch_zoom": 0.05,           // zoom added on alternate cuts (pattern interrupt)
    "push_in": 0.035,             // slow zoom across each segment
    "end_card": 3.2,              // seconds
    "sfx": true,                  // whoosh/tick at motion events (synthesised by default)
    "sfx_files": {                // optional: licensed files instead, paths relative to the project
      "whoosh": {"path": "sfx/whoosh.mp3", "reverse": true, "peak_db": -30},   // reverse: ends ON the moment (a riser)
      "tick":   {"path": "sfx/tick.mp3", "peak_db": -33}
    }
  },
  "hook": {"lines": ["First line.", "Second line."], "end": 4.52},
  "events": [
    {"type": "word",  "start": T, "end": T, "small": "lead-in", "big": "Word.", "bigAt": T,
     "accent": true, "strikeAt": T, "reveal": true},
    {"type": "list",  "start": T, "end": T, "header": "optional", "style": "when"|null,
     "rows": [{"left": "Raise your voice", "right": "rude.", "at": T, "rightAt": T}]},
    {"type": "quote", "start": T, "end": T, "text": "Revealed with the voice.", "from": T},
    {"type": "steps", "start": T, "end": "END", "header": "…", "steps": [{"text": "Feel it.", "at": T}]}
  ],
  "reels": {
    "full":   {"kicker": "Small label", "segments": [[0, 25.48, 1.0], [25.48, 43.1, 1.07]]},
    "teaser": {"kicker": "…", "segments": [[0, 4.52, 1.0], [56.5, 59.85, 1.08]]},
    "type-only": {"kicker": "…", "typeOnly": true, "segments": [[…]]}
  },
  "subtitles_hi": [[start, end, "Hindi line"], …],  // any language: add subtitles_<code>
  "word_decisions": [{"at": 68.8, "heard": {...}, "captioned": "...", "why": "..."}],  // record of judgement calls
  "delivery": {"page_title": "…", "reels": {"<reel>": {"title": "…", "use": "…", "caption": "…"}}}
}
```

Segments are `[start, end, zoom]`. Choose boundaries inside measured silences.

# cards.json

A list of stills. Each: `id`, `w`, `h`, `theme` (`dark`|`light`), and any of
`page`, `kicker`, `small` (above the headline), `big`, `accent`, `xl`, `strike`,
`sub` (below the headline), `rows` ([[left, right]]), `bullets`, `steps`,
`swipe`, `top` (start content at this y instead of centring — leaves room for a
Story sticker), `brand` (false hides the logo), `foot` (false hides handle/site).
