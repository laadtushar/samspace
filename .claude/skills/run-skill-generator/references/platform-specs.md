# Platform specs used by the pipeline

| Item | Value used | Why |
|---|---|---|
| Video frame | 1080×1920, 9:16, 30 fps, H.264 High, yuv420p, AAC 48 kHz | Reels / Shorts / TikTok / Stories all accept it natively |
| Loudness | −14 LUFS integrated, true peak ≤ −1 dBFS | Matches the normalisation target most short-video platforms use, so nothing is turned down or clipped |
| Safe area for text | x 40–950, y 210–1560 (on 1080×1920) | Keeps clear of the top bar, the right-hand action buttons and the caption/handle block at the bottom. `render.mjs` audits this every 15 frames |
| Feed card | 1080×1350 (4:5) | Largest portrait size the Instagram feed shows uncropped |
| Story card | 1080×1920; keep text in the upper half when a sticker goes below | Room for poll / link / reel-share stickers |
| Cover | the frame where the hook has fully landed | Readable in the grid and the share sheet |
| WhatsApp status / send | ≤ 16 MB per video | Tightest common limit; the audit notes larger files |
| Subtitles | SRT, UTF-8, ordered non-overlapping cues | YouTube, LinkedIn, Facebook accept uploaded tracks |

Re-check these against each platform's help pages before relying on them for a
new platform; they change.
