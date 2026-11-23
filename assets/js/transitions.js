// The crossfade automation lives in AudioPlayer so both decks share one timing source.
// This module exposes a small duration helper for per-track transition settings.
export function transitionSeconds(track) {
  const value = Number(track?.transitionDuration);
  return Number.isFinite(value) ? Math.max(0, Math.min(12, value)) : 0;
}

