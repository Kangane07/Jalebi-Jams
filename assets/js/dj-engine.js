import { transitionSeconds } from "./transitions.js";

export class DJEngine extends EventTarget {
  constructor(player, { historyLimit = 3 } = {}) {
    super();
    this.player = player;
    this.historyLimit = historyLimit;
    this.history = [];
    this.tracks = [];
    this.currentTrack = null;
    this.nextTrack = null;
    this.transitioning = false;
    player.addEventListener("timeupdate", (event) => this.onTimeUpdate(event.detail));
    player.addEventListener("error", (event) => this.onAudioError(event.detail));
    player.addEventListener("ended", () => this.advance());
  }

  eligibleTracks(library, language, category) {
    return library.tracks.filter((track) => track.language === language && track.category === category && track.audioPath && Number.isFinite(Number(track.hookStart)) && Number(track.playbackEnd) > Number(track.hookStart));
  }

  pickNext() {
    if (!this.tracks.length) return null;
    const fresh = this.tracks.filter((track) => !this.history.includes(track.id));
    const pool = fresh.length ? fresh : this.tracks.filter((track) => track.id !== this.currentTrack?.id);
    const choices = pool.length ? pool : this.tracks;
    const picked = choices[Math.floor(Math.random() * choices.length)];
    this.history = [...this.history.filter((id) => id !== picked.id), picked.id].slice(-this.historyLimit);
    return picked;
  }

  async start(library, language, category) {
    this.tracks = this.eligibleTracks(library, language, category);
    this.history = [];
    if (!this.tracks.length) {
      this.dispatchEvent(new CustomEvent("empty", { detail: { language, category } }));
      return false;
    }
    await this.player.unlock();
    const first = this.pickNext();
    try {
      await this.player.start(first);
      this.currentTrack = first;
      this.prepareNext();
      this.dispatchEvent(new CustomEvent("track", { detail: { track: first } }));
      return true;
    } catch (error) {
      this.dispatchEvent(new CustomEvent("playbackerror", { detail: { message: error.message || "Playback was blocked. Tap play to try again." } }));
      return false;
    }
  }

  prepareNext() {
    this.nextTrack = this.pickNext();
    if (this.nextTrack) this.player.preload(this.player.inactiveIndex, this.nextTrack);
  }

  async advance() {
    if (this.transitioning || !this.tracks.length) return;
    this.transitioning = true;
    const next = this.nextTrack || this.pickNext();
    if (!next) { this.transitioning = false; return; }
    try {
      await this.player.transition(next, transitionSeconds(this.currentTrack));
      this.currentTrack = next;
      this.dispatchEvent(new CustomEvent("track", { detail: { track: next } }));
      this.prepareNext();
    } catch (error) {
      this.dispatchEvent(new CustomEvent("playbackerror", { detail: { message: `Could not play ${next.title}: ${error.message || "file unavailable"}` } }));
      this.prepareNext();
    } finally { this.transitioning = false; }
  }

  onTimeUpdate({ audio, deck }) {
    if (deck !== this.player.activeIndex || !this.currentTrack) return;
    const end = Number(this.currentTrack.playbackEnd);
    const remaining = end - audio.currentTime;
    this.dispatchEvent(new CustomEvent("progress", { detail: { currentTime: audio.currentTime - Number(this.currentTrack.hookStart || 0), duration: end - Number(this.currentTrack.hookStart || 0) } }));
    const fade = Math.max(0, Number(this.currentTrack.transitionDuration) || 0);
    if (remaining <= Math.max(0.25, fade) || audio.currentTime >= end) this.advance();
  }

  onAudioError({ deck, message }) {
    if (deck !== this.player.activeIndex) return;
    this.dispatchEvent(new CustomEvent("playbackerror", { detail: { message } }));
    if (this.nextTrack) this.advance();
  }

  async skip() { await this.advance(); }
  pause() { this.player.pause(); }
  async resume() { await this.player.resume(); }
  stop() { this.player.stop(); this.currentTrack = null; this.nextTrack = null; this.tracks = []; }
}

