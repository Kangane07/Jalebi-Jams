#!/usr/bin/env python3
import json, re, subprocess, sys, math
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
SONGS = ROOT / "music" / "songs"
LIBRARY = ROOT / "music" / "library.json"
OVERRIDES = ROOT / "music" / "overrides.json"
EXTS = {".mp3", ".m4a"}
SR = 11025
FRAME = 0.5
HOOK_LEN = 60.0
TRANSITION = 1


def duration_of(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", str(path)], capture_output=True, text=True)
    return float(out.stdout.strip())


def energy_envelope(path):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True).stdout
    audio = np.frombuffer(raw, dtype=np.float32)
    n = int(SR * FRAME)
    frames = len(audio) // n
    if frames == 0:
        return np.zeros(1)
    chunks = audio[: frames * n].reshape(frames, n)
    return np.sqrt((chunks ** 2).mean(axis=1))


def find_hook(path, duration):
    import numpy as np
    env = energy_envelope(path)
    fps = 1 / FRAME
    length = min(HOOK_LEN, max(20.0, duration - 8))
    win = int(length * fps)
    if len(env) <= win + 4:
        return 0.0, round(max(5.0, duration - 1), 1)
    lead = int(8 * fps)
    lo = int(len(env) * 0.12)
    hi = min(int(len(env) * 0.75), len(env) - win)
    csum = np.concatenate([[0], np.cumsum(env)])
    mean = lambda a, b: (csum[b] - csum[a]) / max(1, b - a)
    best, best_score = lo, -1.0
    for i in range(max(lo, lead), max(hi, lo + 1)):
        body = mean(i, i + win)
        first = mean(i, i + lead)
        before = mean(i - lead, i)
        score = body + 0.6 * max(0.0, first - before)
        if score > best_score:
            best, best_score = i, score
    a, b = max(1, best - 4), min(len(env) - 1, best + 4)
    rises = [(env[j] - env[j - 1], j) for j in range(a, b + 1)]
    snapped = max(rises)[1] if rises else best
    start = round(snapped * FRAME * 2) / 2
    end = min(start + length, duration - 1.0)
    return float(start), round(float(end), 1)


def parse_name(stem):
    if " - " in stem:
        title, artist = stem.split(" - ", 1)
        return title.strip(), artist.strip()
    return stem.strip(), "Jalebi Jams"


def slug(text):
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_") or "track"


def apply_timing_overrides(entry, override, duration, detected):
    if not isinstance(override, dict):
        print(f"WARN {entry['id']}: override must be an object; using detected values")
        return
    original = {"hookStart": detected[0], "playbackEnd": detected[1]}
    for field in ("hookStart", "playbackEnd"):
        if field not in override:
            continue
        try:
            value = float(override[field])
        except (TypeError, ValueError):
            print(f"WARN {entry['id']}: invalid {field}; using detected value")
            continue
        if not math.isfinite(value) or value < 0 or value >= duration:
            print(f"WARN {entry['id']}: {field} must be between 0 and {duration:.1f}; using detected value")
            continue
        entry[field] = round(value, 1)
    if entry["playbackEnd"] <= entry["hookStart"]:
        print(f"WARN {entry['id']}: playbackEnd must follow hookStart; using detected timestamps")
        entry.update(original)


def main():
    library = json.loads(LIBRARY.read_text(encoding="utf-8"))
    categories = library.get("categories", {})
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.exists() else {}
    tracks, used = [], set()
    for path in sorted(SONGS.rglob("*")):
        if path.suffix.lower() not in EXTS:
            continue
        rel = path.relative_to(SONGS)
        if len(rel.parts) != 3:
            print(f"SKIP {rel}: put songs inside music/songs/<language>/<category>/")
            continue
        language, category = rel.parts[0], rel.parts[1]
        if category not in categories.get(language, {}):
            print(f"SKIP {rel}: '{language}/{category}' is not in library.json categories")
            continue
        try:
            duration = duration_of(path)
            start, end = find_hook(path, duration)
        except Exception as exc:
            print(f"SKIP {rel}: could not read audio ({exc})")
            continue
        title, artist = parse_name(path.stem)
        key = rel.as_posix()
        entry = {"id": f"{language}_{category}_{slug(path.stem)}", "title": title, "artist": artist,
                 "language": language, "category": category,
                 "audioPath": "music/songs/" + quote(key),
                 "artwork": "assets/artwork/placeholder.svg",
                 "hookStart": start, "playbackEnd": end, "transitionDuration": TRANSITION}
        apply_timing_overrides(entry, overrides.get(key, {}), duration, (start, end))
        base, n = entry["id"], 2
        while entry["id"] in used:
            entry["id"], n = f"{base}_{n}", n + 1
        used.add(entry["id"])
        tracks.append(entry)
        print(f"OK   {key}: hook {entry['hookStart']}s -> {entry['playbackEnd']}s")
    library["tracks"] = tracks
    LIBRARY.write_text(json.dumps(library, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nLibrary updated: {len(tracks)} track(s).")


if __name__ == "__main__":
    sys.exit(main())

