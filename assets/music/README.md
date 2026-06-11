Royalty-free background music for flow videos.

## Default track (`background.mp3`)

Generated locally by `scripts/generate-background-music.sh` — a soft ambient chord
progression (C → Am → F → G). No attribution required.

Regenerate:

```bash
npm run music:generate
```

## Using your own music

Drop any MP3 into this folder and set the path in your flow YAML:

```yaml
video:
  music: assets/music/your-track.mp3
  music_volume: 0.45
```

Good royalty-free sources (download manually, then place here):

- [Pixabay Music](https://pixabay.com/music/search/corporate/)
- [Joystock](https://www.joystock.org/royalty-free-music/corporate)
- [Mixkit](https://mixkit.co/free-stock-music/)

Check each track's license before use.
