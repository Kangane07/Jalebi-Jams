function isMobileAudioEnvironment() {
  const userAgent = navigator.userAgent || "";
  const isTouchIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || isTouchIPad;
}

function waitUntilPlayable(audio, timeoutMs = 12000) {
  if (audio.readyState >= 2) return Promise.resolve();
  if (audio.error) return Promise.reject(new Error("Audio file could not be loaded."));

  return new Promise((resolve, reject) => {
    let timeout;
    const cleanup = () => {
      window.clearTimeout(timeout);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("error", onError);
    };
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error(audio.error?.message || "Audio file could not be loaded.")); };

    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
    timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("The next track took too long to load."));
    }, timeoutMs);
    if (audio.readyState >= 2) onReady();
  });
}

export class AudioPlayer extends EventTarget {
  constructor() {
    super();
    this.context = null;
    this.masterGain = null;
    this.useNativeMobileAudio = isMobileAudioEnvironment();
    this.setPlaybackAudioSession();
    this.decks = [this.createDeck(), this.createDeck()];
    this.activeIndex = 0;
    this.volume = 0.8;
    this.crossfadeSupported = false;
  }

  createDeck() {
    const audio = new Audio();
    audio.preload = "auto";
    audio.playsInline = true;
    audio.setAttribute("playsinline", "");
    audio.crossOrigin = "anonymous";
    audio.addEventListener("timeupdate", () => this.dispatchEvent(new CustomEvent("timeupdate", { detail: { audio, deck: this.decks?.findIndex((item) => item.audio === audio) } })));
    audio.addEventListener("ended", () => this.dispatchEvent(new CustomEvent("ended", { detail: { deck: this.decks.findIndex((item) => item.audio === audio) } })));
    audio.addEventListener("error", () => this.dispatchEvent(new CustomEvent("error", { detail: { deck: this.decks.findIndex((item) => item.audio === audio), message: audio.error?.message || "Audio file could not be loaded." } })));
    return { audio, source: null, gain: null, loadedUrl: "", mixLevel: 1 };
  }

  setPlaybackAudioSession() {
    if (!navigator.audioSession) return;
    try { navigator.audioSession.type = "playback"; } catch { /* Audio Session API is optional. */ }
  }

  async unlock() {
    this.setPlaybackAudioSession();
    // Keep phone playback on native media elements. iOS may suspend Web Audio
    // when Safari is backgrounded or the screen locks.
    if (this.useNativeMobileAudio) return;

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
        if (this.context) {
          this.decks.forEach((deck) => {
            try {
              deck.source?.disconnect();
              deck.gain?.disconnect();
              if (deck.source) deck.source.connect(this.context.destination);
            } catch { /* Keep normal audio playback available if Web Audio setup fails. */ }
            deck.gain = null;
          });
          this.masterGain?.disconnect();
        }
        this.masterGain = null;
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
    return deck;
  }

  preload(deckIndex, track) {
    if (!track?.audioPath) return;
    this.load(deckIndex, track);
  }

  async seekToHook(deck, track) {
    await waitUntilPlayable(deck.audio);
    const requestedTime = Math.max(0, Number(track.hookStart) || 0);
    deck.audio.currentTime = Number.isFinite(deck.audio.duration)
      ? Math.min(requestedTime, Math.max(0, deck.audio.duration - 0.1))
      : requestedTime;
  }

  async start(track) {
    this.activeIndex = 0;
    const deck = this.load(this.activeIndex, track);
    await this.seekToHook(deck, track);
    deck.mixLevel = 1;
    if (deck.gain && this.context) {
      deck.gain.gain.cancelScheduledValues(this.context.currentTime);
      deck.gain.gain.setValueAtTime(1, this.context.currentTime);
    }
    deck.audio.volume = this.masterGain ? 1 : this.volume;
    await deck.audio.play();
    this.dispatchEvent(new CustomEvent("playing", { detail: { track } }));
  }

  fadeElementVolume(deck, from, to, seconds) {
    const durationMs = Math.max(1, seconds * 1000);
    const startedAt = performance.now();
    deck.mixLevel = from;

    return new Promise((resolve) => {
      const timer = window.setInterval(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
        deck.mixLevel = from + ((to - from) * progress);
        deck.audio.volume = this.volume * deck.mixLevel;
        if (progress >= 1) {
          window.clearInterval(timer);
          resolve();
        }
      }, 20);
    });
  }

  async transition(track, seconds = 1) {
    const nextIndex = 1 - this.activeIndex;
    const next = this.load(nextIndex, track);
    const current = this.decks[this.activeIndex];
    await this.seekToHook(next, track);

    if (this.useNativeMobileAudio) {
      // Native media playback is the reliable path on phones. Switch decks
      // directly instead of depending on Web Audio or background JS fades.
      next.mixLevel = 1;
      next.audio.volume = this.volume;
      await next.audio.play();
      current.audio.pause();
      current.mixLevel = 1;
      current.audio.volume = this.volume;
    } else if (next.gain && current.gain && this.context && seconds > 0) {
      const duration = Math.min(Math.max(0, seconds), 12);
      const now = this.context.currentTime;
      next.gain.gain.cancelScheduledValues(now);
      current.gain.gain.cancelScheduledValues(now);
      next.gain.gain.setValueAtTime(0, now);
      await next.audio.play();
      const fadeStart = this.context.currentTime;
      next.gain.gain.setValueAtTime(0, fadeStart);
      current.gain.gain.setValueAtTime(current.gain.gain.value, fadeStart);
      next.gain.gain.linearRampToValueAtTime(1, fadeStart + duration);
      current.gain.gain.linearRampToValueAtTime(0, fadeStart + duration);
      window.setTimeout(() => current.audio.pause(), duration * 1000 + 100);
      next.mixLevel = 1;
      current.mixLevel = 1;
    } else {
      // Some browsers do not expose Web Audio. Overlap the decks and use
      // element volume ramps so the hand-off still feels like a fade.
      const fadeDuration = Math.min(0.8, Math.max(0.5, Number(seconds) || 0.5));
      next.mixLevel = 0;
      next.audio.volume = 0;
      await next.audio.play();
      await Promise.all([
        this.fadeElementVolume(current, current.mixLevel, 0, fadeDuration),
        this.fadeElementVolume(next, 0, 1, fadeDuration)
      ]);
      current.audio.pause();
      current.mixLevel = 1;
      current.audio.volume = this.volume;
      next.mixLevel = 1;
      next.audio.volume = this.volume;
    }

    this.activeIndex = nextIndex;
    this.dispatchEvent(new CustomEvent("playing", { detail: { track, crossfade: seconds > 0 } }));
  }

  pause() { this.decks[this.activeIndex].audio.pause(); }
  async resume() { await this.unlock(); await this.decks[this.activeIndex].audio.play(); }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value)));
    if (this.masterGain && this.context) this.masterGain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.02);
    else this.decks.forEach((deck) => { deck.audio.volume = this.volume * deck.mixLevel; });
  }
  get activeAudio() { return this.decks[this.activeIndex].audio; }
  get inactiveIndex() { return 1 - this.activeIndex; }
  stop() {
    this.decks.forEach((deck) => {
      deck.audio.pause();
      deck.audio.currentTime = 0;
      deck.mixLevel = 1;
      if (!this.masterGain) deck.audio.volume = this.volume;
    });
  }
}

