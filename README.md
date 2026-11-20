# Jalebi-Jams

Jalebi Jams is a static, mobile-friendly personal automated DJ. The site includes a responsive landing page, Hindi and Marathi category selection, a two-deck audio player, and an automatic DJ engine. The music catalog starts empty; no recordings are included.

> **Adding songs?** Read [HOW-TO-ADD-SONGS.md](HOW-TO-ADD-SONGS.md). Drop MP3s into `music/songs/<language>/<category>/` and the playlist updates itself.

## Run locally

Use a local HTTP server so the browser can load `music/library.json`:

```powershell
py -m http.server 8000
```

Then open <http://localhost:8000>. If `py` is unavailable, use `python -m http.server 8000`.

## Music library

`music/library.json` defines the agreed categories and starts with an empty `tracks` array. No songs or commercial recordings are included. Add only recordings you have permission to play from your chosen host. Track metadata follows this shape:

```json
{
  "id": "hindi_001",
  "title": "Placeholder title",
  "artist": "Placeholder artist",
  "language": "hindi",
  "category": "chatpatte",
  "audioPath": "music/audio/local-track.mp3",
  "artwork": "assets/artwork/placeholder.jpg",
  "hookStart": 42,
  "playbackEnd": 155,
  "transitionDuration": 5
}
```

For local development, place your own audio files under `music/audio/` and use that relative path in `audioPath`. This folder and common audio formats are ignored by Git. Do not commit recordings to this public repository. GitHub Pages is for the site, not private music storage. Public playback requires an audio host, permission to distribute the recordings, and cross-origin audio access enabled by the host when serving files from another domain. Never include private keys in frontend files.

The DJ starts each track at `hookStart`, ends it at `playbackEnd`, and uses `transitionDuration` seconds from the outgoing track for the two-deck gain transition when the Web Audio API is available. Browsers that block Web Audio routing fall back to a direct deck handoff. Crossfading should be checked with permitted audio on the target browsers before being relied on for a party.

## Project structure

- `index.html` — page structure and setup flow
- `assets/css/style.css` — responsive visual design
- `assets/js/app.js` — language/category selection and setup validation
- `assets/js/dj-engine.js` — category filtering, shuffle history, preload and automatic track selection
- `assets/js/audio-player.js` — two HTML Audio decks and Web Audio gain handling
- `assets/js/transitions.js` — per-track transition duration helper
- `music/library.json` — category metadata and track catalog

## Deploy

The site has no build step or dependencies. Publish the repository root through GitHub Pages. The local HTTP server above is also the simplest way to preview it.

