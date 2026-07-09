# Mohamed Azarudeen — Portfolio

A cinematic, scroll-driven personal portfolio. No build step, no frameworks, no dependencies —
plain HTML + CSS + JS. Open `index.html` directly, or serve the folder:

```
python serve.py
# → http://localhost:4173
```

Use `serve.py` (not `python -m http.server`) — the scroll-scrubbed videos need
HTTP Range support to be seekable, which the stock module lacks. Production
static hosts (GitHub Pages, Netlify, Vercel…) support ranges out of the box.

## Project structure

```
index.html          all content & structure
css/style.css       visual identity (dark editorial · film-grade)
js/main.js          scrub engine, reveals, cursor, menu, fallbacks
assets/img/         logo, textures, project screenshots
assets/video/       the three scroll-scrubbed reels
assets/resume/      resume PDF
```

## Media map

Real media is in place for the three videos, the logo, the resume, and project
screenshots 1–4. If a referenced file ever goes missing, the site degrades
gracefully (styled fallback panels, no broken-image icons).

| File | Path | Status |
|---|---|---|
| Hero video clip | `assets/video/hero.mp4` | ✅ real (re-encoded for scrubbing) |
| Mid-page video clip | `assets/video/midpage.mp4` | ✅ real (re-encoded for scrubbing) |
| Closing video clip | `assets/video/closing.mp4` | ✅ real (re-encoded for scrubbing) |
| Logo mark (favicon + nav) | `assets/img/logo.png` | ✅ real (cropped from `logo.jpeg`) |
| Blog to Podcast screenshot | `assets/img/project-1-blog-to-podcast.png` | ✅ real |
| Support Assistant screenshot | `assets/img/project-2-support-assistant.jpg` | ✅ real |
| Breakup Recovery screenshot | `assets/img/project-3-breakup-recovery.jpg` | ✅ real |
| GitHub MCP Agent screenshot | `assets/img/project-4-github-mcp.jpeg` | ✅ real |
| Injury Risk Analyzer screenshot | `assets/img/project-5-injury-risk.png` | ⚠️ still a placeholder |
| Background texture 1 (About) | `assets/img/texture-1.jpg` | ⚠️ still a placeholder (subtle noise) |
| Background texture 2 (Education) | `assets/img/texture-2.jpg` | ⚠️ still a placeholder (subtle noise) |
| Resume | `assets/resume/Mohamed_Azarudeen_Resume.pdf` | ✅ real |

Your original (pre-re-encode) video files are kept in `assets/video/_originals/` —
safe to delete once you're happy with the site. `assets/img/logo.jpeg` is your
original logo file; the site uses the cropped `logo.png`. 

### 🎞 Encoding your videos for buttery scrubbing

The three reels are **scrubbed by scroll** (the video is paused and seeked as you
scroll). Seeking smoothness depends on keyframe density, so re-encode your clips
with a short keyframe interval:

```
ffmpeg -i input.mov -vf "scale=1920:-2" -r 30 -c:v libx264 -g 4 -crf 21 \
       -pix_fmt yuv420p -movflags +faststart -an output.mp4
```

The important flags: `-g 4` (a keyframe every 4 frames → precise, cheap seeks),
`-movflags +faststart` (metadata up front), `-an` (videos are muted anyway).
Keep clips short (5–15 s) — scroll distance maps across the whole duration.

## ✏️ Remaining to-dos

| What | Where |
|---|---|
| Project 2 repo link currently duplicates the breakup-recovery repo | search `TODO` in `index.html` |
| Real Injury Risk Analyzer screenshot | drop at `assets/img/project-5-injury-risk.png` |
| Real background textures (optional — current noise placeholders look fine) | `assets/img/texture-1.jpg`, `texture-2.jpg` |

Email, employment dates, education dates, and the other four repo links are filled
in with real values.
