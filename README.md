# Flow Documentation POC (Demo-as-Code)

Automated step-by-step guides from website navigation flows. Pilot site: [grimme.com/en](https://grimme.com/en).

## Quick start

```bash
npm install
npx playwright install chromium
npm run demo
```

This runs the `contact-from-home` flow and writes everything under `output/contact-from-home/`:

- `guide.md` — user-facing markdown guide
- `assets/*.png` — guide screenshots with red highlights
- `flow.webm` — viewport recording **with background music**
- `flow.mp4` — same video with background music (better compatibility in some players)
- `captions.srt` — step timing file (voiceover seed, not burned into video)
- `flow-result.json` — machine-readable recording metadata
- `video-raw/` — raw Playwright video chunks (intermediate)
- `debug/` — probe/dev screenshots (not published)

## How it works

```
flows/contact-from-home.yaml   →   src/record-flow.ts   →   output/
  (declarative steps)              (Playwright browser)       guide.md + PNGs
                                          ↓
                                   src/generate-guide.ts
```

Flows are defined in YAML. Each step has an action, human-readable title/description, and optional screenshot settings. Edit the YAML, re-run `npm run demo`, and the guide regenerates.

## Commands

| Command | Description |
|---------|-------------|
| `npm run record` | Run Playwright against a flow YAML (default: `contact-from-home.yaml`) |
| `npm run record -- other-flow.yaml` | Record a different flow file from `flows/` |
| `npm run generate` | Build `guide.md` from `flow-result.json` |
| `npm run demo` | Record + generate in one step |
| `npm run test:flow` | Playwright test with trace + video (for future video pipeline) |

## Iterating a flow

1. Edit `flows/contact-from-home.yaml` — change steps, locators, or copy.
2. Run `npm run demo`.
3. Review `output/contact-from-home/guide.md`.

### Flow step actions

| Action | Purpose |
|--------|---------|
| `goto` | Navigate to a URL |
| `click` | Click an element (screenshot taken before click if configured) |
| `click_optional` | Click if present (e.g. cookie banners) |
| `scroll_to` | Scroll element into view |
| `assert_visible` | Wait for element, capture confirmation screenshot |

### Locator format

```yaml
locator:
  role: link
  name: Open form
```

Also supports `text:` and `css:` keys. See `src/locators.ts`.

## Adding a new flow

1. Copy `flows/contact-from-home.yaml` to `flows/your-flow.yaml`.
2. Update `name`, `title`, `output_dir`, and `steps`.
3. Run `npm run record -- your-flow.yaml && npm run generate -- output/your-flow/flow-result.json`.

## Video with step annotations

Recording uses two passes so video and guide assets don't interfere:

1. **Video pass** — 1920×1080 (16:9) viewport with a browser chrome bar, step caption cards, and no full-page screenshot scrolling.
2. **Screenshot pass** — separate run for guide PNGs (including full-page where configured).

| Output | Description |
|--------|-------------|
| `flow.webm` | 16:9 viewport recording with browser chrome + on-screen step cards |
| `captions.srt` | Step timings + copy for a future voiceover track (not burned into video) |

To skip a step in the video (e.g. cookie accept), set `screenshot: none` or `video_caption: false` in the YAML.

Scroll speed during video recording uses a custom eased animation (not native `scrollIntoView`). Tune globally in your flow YAML:

```yaml
video:
  scroll_duration_ms: 3500   # base duration; scales up for long scroll distances
```

Or per step: `scroll_duration_ms: 5000` on any `scroll_to` or `click` step.

### Higher-polish video options (future)

| Tool | What it adds beyond this POC |
|------|------------------------------|
| [playwright-recast](https://github.com/ThePatriczek/playwright-recast) | Animated cursor, zoom, TTS narration from Playwright traces |
| [Demo Machine](https://github.com/45ck/demo-machine) | YAML-driven polish, quality reports, MCP authoring |
| [ScreenCI](https://github.com/screenci/screenci) | Playwright-style `.video.ts` scripts with hosted rendering |

## Next steps (from research doc)

- [ ] Add AI voiceover (TTS) synced to `captions.srt` via ffmpeg or NeuraScreen
- [ ] Add CI job to regenerate guides on schedule or deploy
- [ ] LLM layer to refine step descriptions from DOM context
- [ ] Visual diff on screenshot changes in PRs

See [docs/web-flow-documentation-research.md](docs/web-flow-documentation-research.md) for the full tooling landscape.
