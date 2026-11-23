# Jalebi-Jams

Jalebi Jams is a static, mobile-friendly personal automated DJ. The site includes the landing page, Hindi and Marathi category selection, a two-deck audio player, and automatic DJ selection. The public music catalog starts empty; no recordings are included.

## Add songs

Read [HOW-TO-ADD-SONGS.md](HOW-TO-ADD-SONGS.md). Only upload audio you have permission to distribute publicly. Put MP3 or M4A files in `music/songs/<language>/<category>/`; the GitHub Actions workflow generates metadata in `music/library.json`. Files should remain under GitHub's per-file size limit and the recommended 25 MB limit.

The workflow requires the checked-in `music/library.json` to define category ids. It estimates a hook using audio energy; review results with `tools/hook-picker.html` and set manual timestamps in `music/overrides.json` if needed. Every generated entry uses the branded placeholder artwork until custom artwork is added.

## Run locally

From the repository root, start a static HTTP server so the browser can fetch the JSON catalog:

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000>. Audio files stored under `music/audio/` are ignored by Git and are suitable for private local development. The public `music/songs/` folder is committed and publicly accessible; only put files there if you have public distribution rights. A separate public audio host must allow cross-origin access when serving files from another domain.

## Track metadata

Each generated track includes the following fields. The initial `tracks` array is empty.

```json
{
  "id": "hindi_chatpatte_example_song",
  "title": "Example Song",
  "artist": "Example Artist",
  "language": "hindi",
  "category": "chatpatte",
  "audioPath": "music/songs/hindi/chatpatte/Example%20Song%20-%20Example%20Artist.mp3",
  "artwork": "assets/artwork/placeholder.svg",
  "hookStart": 42,
  "playbackEnd": 155,
  "transitionDuration": 5
}
```

The DJ starts at `hookStart`, stops at `playbackEnd`, and uses the outgoing track's `transitionDuration` for a two-deck gain transition when supported. Test audible transitions with permitted audio on target browsers before relying on them.

## Deploy

The web app is plain HTML, CSS, and JavaScript with no build step. Configure GitHub Pages to publish the repository root on `main`. The Actions workflow only updates the generated song catalog; it does not deploy a separate site artifact.


