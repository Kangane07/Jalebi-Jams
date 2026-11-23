export class AudioPlayer extends EventTarget {
  constructor() {
    super();
    this.context = null;
    this.masterGain = null;
    this.decks = [this.createDeck(), this.createDeck()];
    this.activeIndex = 0;
    this.volume = 0.8;
    this.crossfadeSupported = false;
  }

  createDeck() {
    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audio.addEventListener("timeupdate", () => this.dispatchEvent(new CustomEvent("timeupdate", { detail: { audio, deck: this.decks?.findIndex((item) => item.audio === audio) } })));
    audio.addEventListener("ended", () => this.dispatchEvent(new CustomEvent("ended", { detail: { deck: this.decks.findIndex((item) => item.audio === audio) } })));
    audio.addEventListener("error", () => this.dispatchEvent(new CustomEvent("error", { detail: { deck: this.decks.findIndex((item) => item.audio === audio), message: audio.error?.message || "Audio file could not be loaded." } })));
    return { audio, source: null, gain: null, loadedUrl: "" };
  }

  async unlock() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (Context && !this.context) {
      try {
        this.context = new Context();
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.context.destination);
        this.decks.forEach((deck) => {
          deck.source = this.context.createMediaElementSource(deck.audio);
          deck.gain = this.context.createGain();
          deck.gain.gain.value = 0;
          deck.source.connect(deck.gain).connect(this.masterGain);
        });
        this.crossfadeSupported = true;
      } catch {
        this.crossfadeSupported = false;
        this.context = null;
      }
    }
    if (this.context?.state === "suspended") await this.context.resume();
  }

  load(deckIndex, track) {
    const deck = this.decks[deckIndex];
    if (deck.loadedUrl !== track.audioPath) {
      deck.audio.pause();
      deck.audio.src = track.audioPath;
      deck.audio.load();
      deck.loadedUrl = track.audioPath;
    }
  }

  preload(deckIndex, track) {
    if (!track?.audioPath) return;
    this.load(deckIndex, track);
  }

  async start(track) {
    this.activeIndex = 0;
    const deck = this.decks[this.activeIndex];
    this.load(this.activeIndex, track);
    deck.audio.currentTime = Number(track.hookStart) || 0;
    if (deck.gain && this.context) deck.gain.gain.setValueAtTime(1, this.context.currentTime);
    deck.audio.volume = this.masterGain ? 1 : this.volume;
    await deck.audio.play();
    this.dispatchEvent(new CustomEvent("playing", { detail: { track } }));
  }

  async transition(track, seconds = 4) {
    const nextIndex = 1 - this.activeIndex;
    const next = this.decks[nextIndex];
    const current = this.decks[this.activeIndex];
    this.load(nextIndex, track);
    next.audio.currentTime = Number(track.hookStart) || 0;
    next.audio.volume = this.masterGain ? 1 : this.volume;
    if (next.gain && current.gain && this.context && seconds > 0) {
      const now = this.context.currentTime;
      const duration = Math.min(Math.max(0, seconds), 12);
      next.gain.gain.cancelScheduledValues(now);
      current.gain.gain.cancelScheduledValues(now);
      next.gain.gain.setValueAtTime(0, now);
      current.gain.gain.setValueAtTime(current.gain.gain.value, now);
      next.gain.gain.linearRampToValueAtTime(1, now + duration);
      current.gain.gain.linearRampToValueAtTime(0, now + duration);
      await next.audio.play();
      window.setTimeout(() => current.audio.pause(), duration * 1000 + 100);
    } else {
      current.audio.pause();
      if (current.gain && this.context) current.gain.gain.setValueAtTime(0, this.context.currentTime);
      if (next.gain && this.context) next.gain.gain.setValueAtTime(1, this.context.currentTime);
      await next.audio.play();
    }
    this.activeIndex = nextIndex;
    this.dispatchEvent(new CustomEvent("playing", { detail: { track, crossfade: this.crossfadeSupported && seconds > 0 } }));
  }

  pause() { this.decks[this.activeIndex].audio.pause(); }
  async resume() { await this.unlock(); await this.decks[this.activeIndex].audio.play(); }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value)));
    if (this.masterGain && this.context) this.masterGain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.02);
    else this.decks.forEach((deck) => { deck.audio.volume = this.volume; });
  }
  get activeAudio() { return this.decks[this.activeIndex].audio; }
  get inactiveIndex() { return 1 - this.activeIndex; }
  stop() { this.decks.forEach(({ audio }) => { audio.pause(); audio.currentTime = 0; }); }
}

