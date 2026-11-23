import { AudioPlayer } from "./audio-player.js";
import { DJEngine } from "./dj-engine.js";
import "./analytics-consent.js";

const categories = {
  hindi: [
    { id: "chatpatte", name: "Chatpatte Gaane", description: "Bollywood bangers & dancefloor favourites", note: "THE CROWD PLEASERS" },
    { id: "retro", name: "Retro", description: "Evergreen Hindi hits from another era", note: "TIMELESS GROOVES" }
  ],
  marathi: [
    { id: "standard", name: "Standard", description: "Marathi hits, Lavani & folk-inspired beats", note: "FULL MARATHI SWAG" }
  ]
};
const languageNames = { hindi: "Hindi", marathi: "Marathi" };
const form = document.querySelector("#party-form");
const categoryOptions = document.querySelector("#category-options");
const note = document.querySelector("#form-note");
const setupView = document.querySelector("#setup-view");
const playerPanel = document.querySelector("#player-panel");
const playerCard = playerPanel.querySelector(".player-panel");
const audioPlayer = new AudioPlayer();
const dj = new DJEngine(audioPlayer);
let selectedCategory = "chatpatte";

function renderCategories(language) {
  const available = categories[language] ?? [];
  if (!available.some((category) => category.id === selectedCategory)) selectedCategory = available[0]?.id ?? "";
  categoryOptions.replaceChildren(...available.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-card";
    button.setAttribute("aria-pressed", String(category.id === selectedCategory));
    button.setAttribute("aria-label", `${category.name}: ${category.description}`);
    button.innerHTML = `<span class="category-name">${category.name}</span><span class="category-desc">${category.description}</span>`;
    button.addEventListener("click", () => { selectedCategory = category.id; renderCategories(language); });
    return button;
  }));
  note.textContent = available.find((category) => category.id === selectedCategory)?.note ?? "Choose your sound.";
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function drawWaveform() {
  const waveform = document.querySelector("#waveform");
  waveform.replaceChildren(...Array.from({ length: 56 }, (_, index) => {
    const bar = document.createElement("i");
    const height = 7 + Math.abs(Math.sin(index * 12.9898) * Math.cos(index * 4.141)) * 37;
    bar.style.setProperty("--bar-height", `${height}px`);
    bar.style.setProperty("--bar-delay", `${(index % 8) * -0.11}s`);
    return bar;
  }));
}

function setStatus(status, message = "") {
  document.querySelector("#party-status").textContent = status;
  document.querySelector("#player-message").textContent = message;
}

function setPlaybackControl(isPlaying) {
  const button = document.querySelector("#play-button");
  button.dataset.state = isPlaying ? "playing" : "paused";
  button.setAttribute("aria-label", isPlaying ? "Pause" : "Resume");
  button.title = isPlaying ? "Pause" : "Resume";
  playerPanel.classList.toggle("is-playing", isPlaying);
  playerCard.classList.toggle("is-playing", isPlaying);
}

function showPlayerView() {
  setupView.classList.add("is-exiting");
  window.setTimeout(() => {
    setupView.hidden = true;
    setupView.classList.remove("is-exiting");
    playerPanel.hidden = false;
    playerPanel.classList.add("is-entering");
    playerPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => playerPanel.classList.remove("is-entering"), 520);
  }, 280);
}

function showSetupView() {
  playerPanel.classList.add("is-exiting");
  window.setTimeout(() => {
    playerPanel.hidden = true;
    playerPanel.classList.remove("is-exiting", "is-playing");
    playerCard.classList.remove("is-playing", "is-empty");
    setupView.hidden = false;
    setupView.classList.add("is-entering");
    setupView.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => setupView.classList.remove("is-entering"), 470);
  }, 250);
}

function displayTrack(track) {
  document.querySelector("#track-title").textContent = track.title;
  document.querySelector("#track-artist").textContent = track.artist;
  document.querySelector("#elapsed-time").textContent = "0:00";
  document.querySelector("#duration-time").textContent = formatTime(Number(track.playbackEnd) - Number(track.hookStart));
  document.querySelector("#progress-fill").style.width = "0%";
  const artwork = document.querySelector("#artwork-frame");
  artwork.style.backgroundImage = track.artwork ? `url("${track.artwork}")` : "";
  artwork.classList.toggle("has-artwork", Boolean(track.artwork));
  playerPanel.classList.remove("is-empty");
  setPlaybackControl(true);
  setStatus("ON AIR", "The DJ has the decks.");
}

drawWaveform();
document.querySelectorAll('input[name="language"]').forEach((input) => input.addEventListener("change", (event) => renderCategories(event.target.value)));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const language = new FormData(form).get("language");
  const category = categories[language]?.find((item) => item.id === selectedCategory);
  if (!category) { note.textContent = "Choose a language and category to continue."; return; }
  const startButton = form.querySelector(".start-button");
  startButton.disabled = true;
  startButton.querySelector("span").textContent = "Starting the party…";
  try {
    const response = await fetch("music/library.json");
    if (!response.ok) throw new Error("Library unavailable");
    const library = await response.json();
    document.querySelector("#player-context").textContent = `${languageNames[language]} · ${category.name}`;
    playerPanel.hidden = false;
    document.querySelector("#skip-button").disabled = false;
    document.querySelector("#play-button").disabled = false;
    const started = await dj.start(library, language, selectedCategory);
    if (started) {
      showPlayerView();
      return;
    }
    if (!started && !dj.tracks.length) {
      playerCard.classList.add("is-empty");
      setPlaybackControl(false);
      document.querySelector("#track-title").textContent = "Your mix is waiting";
      document.querySelector("#track-artist").textContent = "Add your own licensed tracks to this category.";
      document.querySelector("#duration-time").textContent = "0:00";
      document.querySelector("#skip-button").disabled = true;
      document.querySelector("#play-button").disabled = true;
      setStatus("CATALOG EMPTY", "No audio is included. Add permitted tracks to music/library.json.");
      showPlayerView();
    } else {
      note.textContent = document.querySelector("#player-message").textContent || "Could not start the audio. Check the track file and try again.";
      playerPanel.hidden = true;
    }
  } catch {
    note.textContent = "Could not load the music library. Run the local server and try again.";
  } finally {
    startButton.disabled = false;
    startButton.querySelector("span").textContent = "Start party";
  }
});

dj.addEventListener("track", (event) => displayTrack(event.detail.track));
dj.addEventListener("progress", (event) => {
  const { currentTime, duration } = event.detail;
  document.querySelector("#elapsed-time").textContent = formatTime(currentTime);
  document.querySelector("#progress-fill").style.width = `${duration > 0 ? Math.min(100, currentTime / duration * 100) : 0}%`;
});
dj.addEventListener("empty", () => {});
dj.addEventListener("playbackerror", (event) => setStatus("TRACK ISSUE", event.detail.message));

document.querySelector("#skip-button").addEventListener("click", () => dj.skip());
document.querySelector("#play-button").addEventListener("click", async (event) => {
  if (audioPlayer.activeAudio.paused) {
    try { await dj.resume(); setPlaybackControl(true); setStatus("ON AIR", "The DJ has the decks."); }
    catch { setStatus("PLAYBACK BLOCKED", "Tap play again to let your browser start audio."); }
  } else {
    dj.pause(); setPlaybackControl(false); setStatus("PAUSED", "Your mix is holding.");
  }
});
document.querySelector("#volume-control").addEventListener("input", (event) => audioPlayer.setVolume(event.target.value));
document.querySelector("#exit-button").addEventListener("click", () => {
  dj.stop();
  setPlaybackControl(false);
  showSetupView();
});

renderCategories("hindi");

