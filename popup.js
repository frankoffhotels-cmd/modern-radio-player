"use strict";

const stations = [
  {
    id: "record",
    name: "Радио Рекорд",
    genre: "Танцевальная музыка",
    quality: "96 kbps AAC",
    shortLabel: "RR",
    color: "#b899ff",
    colorClass: "purple",
    url: "https://radiorecord.hostingradio.ru/rr_main96.aacp",
  },
  {
    id: "dfm",
    name: "DFM",
    genre: "Поп · Танцевальные хиты",
    quality: "96 kbps AAC",
    shortLabel: "DFM",
    color: "#6bd7f7",
    colorClass: "blue",
    url: "https://dfm.hostingradio.ru/dfm96.aacp",
  },
  {
    id: "hit-fm",
    name: "Хит FM",
    genre: "Главные хиты",
    quality: "128 kbps MP3",
    shortLabel: "ХИТ",
    color: "#ffb078",
    colorClass: "orange",
    url: "https://hitfm.hostingradio.ru/hitfm128.mp3?48c22b78",
  },
  {
    id: "europa-plus",
    name: "Европа Плюс",
    genre: "Европейские хиты",
    quality: "256 kbps MP3",
    shortLabel: "E+",
    color: "#74dfba",
    colorClass: "green",
    url: "https://ep256.hostingradio.ru:8052/europaplus256.mp3",
  },
  {
    id: "lavradio",
    name: "Love Radio",
    genre: "Love Radio · Москва",
    quality: "48 kbps AAC",
    shortLabel: "LOVE",
    color: "#b899ff",
    colorClass: "purple",
    url: "http://microit.n340.com:9000/VgMv0WV17ZVx1uuo_12_love_28_reg_44",
  },
  {
    id: "nashe",
    name: "Наше Радио",
    genre: "Русский рок",
    quality: "256 kbps MP3",
    shortLabel: "НАШЕ",
    color: "#6bd7f7",
    colorClass: "blue",
    url: "http://nashe1.hostingradio.ru/nashe-128.mp3",
  },
  {
    id: "nashe-piter",
    name: "Наше Радио Питер",
    genre: "Наше Радио · Санкт-Петербург",
    quality: "256 kbps MP3",
    shortLabel: "СПБ",
    color: "#ffb078",
    colorClass: "orange",
    url: "http://nashe1.hostingradio.ru/nashespb128.mp3",
  },
  {
    id: "maximum",
    name: "Радио Максимум",
    genre: "Рок · Альтернатива",
    quality: "128 kbps MP3",
    shortLabel: "MAX",
    color: "#74dfba",
    colorClass: "green",
    url: "http://maximum.hostingradio.ru/maximum128.mp3",
  },
];

const stationGrid = document.querySelector("#station-grid");
const stationTitle = document.querySelector("#now-playing-title");
const stationDescription = document.querySelector("#now-playing-description");
const stationCover = document.querySelector("#station-cover");
const coverCaption = document.querySelector("#cover-caption");
const streamQuality = document.querySelector("#stream-quality-value");
const playerStatus = document.querySelector("#player-status");
const liveIndicator = document.querySelector("#live-indicator");
const playButton = document.querySelector("#play-button");
const playIcon = playButton.querySelector("path");
const unlockAudioButton = document.querySelector("#unlock-audio");
const volumeControl = document.querySelector("#volume-control");
const visualizerCanvas = document.querySelector(".visualizer-canvas");
const canvasContext = visualizerCanvas.getContext("2d");

let currentAudio = null;
let currentStation = null;
let audioContext = null;
let analyser = null;
let activeSource = null;
let frequencyData = null;

const playPath = "M8.2 5.8a1 1 0 0 1 1.52-.85l9.1 5.7a1.6 1.6 0 0 1 0 2.7l-9.1 5.7a1 1 0 0 1-1.52-.85V5.8Z";
const pausePath = "M7 5h4v14H7zM14 5h4v14h-4z";

function renderStations() {
  const fragment = document.createDocumentFragment();

  for (const station of stations) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `station-card station-card-${station.colorClass}`;
    card.dataset.stationId = station.id;
    card.setAttribute("aria-pressed", "false");

    const icon = document.createElement("span");
    icon.className = "station-card-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = station.shortLabel;

    const copy = document.createElement("span");
    copy.className = "station-card-copy";

    const name = document.createElement("strong");
    name.textContent = station.name;

    const genre = document.createElement("small");
    genre.textContent = station.genre;
    copy.append(name, genre);

    const playMark = document.createElement("span");
    playMark.className = "card-play";
    playMark.setAttribute("aria-hidden", "true");
    playMark.textContent = "▶";

    card.append(icon, copy, playMark);
    fragment.append(card);
  }

  stationGrid.replaceChildren(fragment);
}

function setPlaybackState(isPlaying) {
  playIcon.setAttribute("d", isPlaying ? pausePath : playPath);
  playButton.setAttribute("aria-label", isPlaying ? "Пауза" : "Воспроизвести");
  playButton.setAttribute("aria-pressed", String(isPlaying));
  liveIndicator.hidden = !isPlaying;
}

function setStatus(message) {
  playerStatus.textContent = message;
}

function showAudioUnlock(show) {
  unlockAudioButton.hidden = !show;
  playerStatus.hidden = show;
}

function updateVolumeTrack() {
  const volume = Number(volumeControl.value);
  volumeControl.style.background = `linear-gradient(90deg, #9b7bff 0 ${volume}%, rgba(255, 255, 255, 0.17) ${volume}%)`;
}

function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  if (activeSource) {
    activeSource.disconnect();
    activeSource = null;
  }

  setPlaybackState(false);
}

function connectAudioToVisualizer(audio) {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor || !canvasContext) {
    console.error("Web Audio API or canvas is unavailable; audio will play without visualization.");
    return Promise.resolve();
  }

  try {
    if (!audioContext) {
      audioContext = new AudioContextConstructor();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      analyser.connect(audioContext.destination);
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
    }

    activeSource = audioContext.createMediaElementSource(audio);
    activeSource.connect(analyser);

    if (audioContext.state === "suspended") {
      return audioContext.resume();
    }

    return Promise.resolve();
  } catch (error) {
    if (activeSource) {
      const source = activeSource;
      activeSource = null;
      source.disconnect();
      try {
        source.connect(audioContext.destination);
      } catch (fallbackError) {
        console.error("Could not route audio directly to the speakers.", fallbackError);
      }
    }
    console.error("Could not connect the radio stream to the audio visualizer.", error);
    return Promise.resolve();
  }
}

function updateSelectedStation(station) {
  currentStation = station;
  showAudioUnlock(false);
  stationTitle.textContent = station.name;
  stationDescription.textContent = station.genre;
  streamQuality.textContent = station.quality;
  stationCover.style.setProperty("--cover-color", station.color);
  stationCover.setAttribute("aria-label", `Обложка станции «${station.name}»`);
  coverCaption.textContent = station.shortLabel;

  for (const card of stationGrid.querySelectorAll(".station-card")) {
    const isSelected = card.dataset.stationId === station.id;
    card.classList.toggle("is-active", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));
  }
}

async function playStation(station) {
  stopCurrentAudio();
  updateSelectedStation(station);
  setStatus("Подключаемся…");

  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.preload = "none";
  audio.muted = false;
  audio.volume = Number(volumeControl.value) / 100;
  audio.src = station.url;
  currentAudio = audio;
  const visualizerReady = connectAudioToVisualizer(audio);

  audio.addEventListener("playing", () => {
    if (currentAudio !== audio) return;
    setPlaybackState(true);
    setStatus("Эфир онлайн");
  });

  audio.addEventListener("pause", () => {
    if (currentAudio !== audio) return;
    setPlaybackState(false);
    setStatus("Пауза");
  });

  audio.addEventListener("waiting", () => {
    if (currentAudio === audio) setStatus("Загрузка потока…");
  });

  audio.addEventListener("error", () => {
    if (currentAudio !== audio) return;
    setPlaybackState(false);
    setStatus("Не удалось загрузить поток");
    if (audio.error) {
      console.error("Audio error:", audio.error);
      console.error("Audio error code:", audio.error.code, "message:", audio.error.message);
      if (audio.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        console.error(`The browser may not support the audio format for ${station.name}.`);
      }
    } else {
      console.error(`Radio stream error for ${station.name}; no MediaError details were provided.`);
    }
  });

  try {
    const playback = audio.play();
    await Promise.all([playback, visualizerReady]);
  } catch (error) {
    if (currentAudio !== audio) return;
    setPlaybackState(false);
    setStatus("Воспроизведение недоступно");
    console.error(`Could not play radio station ${station.name}.`, error);
    if (audio.error) {
      console.error("Audio error:", audio.error);
      console.error("Audio error code:", audio.error.code, "message:", audio.error.message);
    }
    if (error.name === "NotAllowedError" || audioContext?.state === "suspended") {
      showAudioUnlock(true);
    }
  }
}

function togglePlayback() {
  if (!currentAudio || !currentStation) {
    setStatus("Сначала выберите станцию");
    return;
  }

  if (currentAudio.paused) {
    const playback = currentAudio.play();
    const visualizerReady = audioContext && audioContext.state === "suspended"
      ? audioContext.resume()
      : Promise.resolve();

    Promise.all([playback, visualizerReady]).catch((error) => {
      setPlaybackState(false);
      setStatus("Воспроизведение недоступно");
      console.error(`Could not resume radio station ${currentStation.name}.`, error);
      if (currentAudio && currentAudio.error) {
        console.error("Audio error:", currentAudio.error);
        console.error("Audio error code:", currentAudio.error.code, "message:", currentAudio.error.message);
      }
      if (error.name === "NotAllowedError" || audioContext?.state === "suspended") {
        showAudioUnlock(true);
      }
    });
  } else {
    currentAudio.pause();
  }
}

function unlockAudio() {
  if (!currentAudio || !currentStation) {
    setStatus("Сначала выберите станцию");
    showAudioUnlock(false);
    return;
  }

  currentAudio.muted = false;
  const playback = currentAudio.paused ? currentAudio.play() : Promise.resolve();
  const contextResume = audioContext && audioContext.state !== "running"
    ? audioContext.resume()
    : Promise.resolve();

  Promise.all([playback, contextResume]).then(() => {
    showAudioUnlock(false);
    setPlaybackState(!currentAudio.paused);
    if (!currentAudio.paused) setStatus("Эфир онлайн");
  }).catch((error) => {
    setStatus("Не удалось включить звук");
    console.error(`Could not unlock audio for ${currentStation.name}.`, error);
    if (currentAudio.error) {
      console.error("Audio error:", currentAudio.error);
      console.error("Audio error code:", currentAudio.error.code, "message:", currentAudio.error.message);
    }
  });
}

function drawVisualizer() {
  if (!canvasContext) return;

  const bounds = visualizerCanvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const canvasWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
  const canvasHeight = Math.max(1, Math.round(bounds.height * pixelRatio));

  if (visualizerCanvas.width !== canvasWidth || visualizerCanvas.height !== canvasHeight) {
    visualizerCanvas.width = canvasWidth;
    visualizerCanvas.height = canvasHeight;
  }

  canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  canvasContext.clearRect(0, 0, bounds.width, bounds.height);

  const barCount = 44;
  const barWidth = Math.max(1, (bounds.width / barCount) * 0.48);
  const slotWidth = bounds.width / barCount;
  const gradient = canvasContext.createLinearGradient(0, 0, 0, bounds.height);
  gradient.addColorStop(0, "#66ddf6");
  gradient.addColorStop(0.58, "#a27bff");
  gradient.addColorStop(1, "rgba(162, 123, 255, 0.24)");
  canvasContext.fillStyle = gradient;

  const isPlaying = currentAudio && !currentAudio.paused && !currentAudio.error;
  if (analyser && frequencyData && isPlaying) {
    analyser.getByteFrequencyData(frequencyData);
  }

  for (let index = 0; index < barCount; index += 1) {
    const frequencyIndex = Math.min(
      frequencyData ? frequencyData.length - 1 : 0,
      Math.floor((index / barCount) ** 1.65 * (frequencyData ? frequencyData.length : 0)),
    );
    const measured = analyser && frequencyData && isPlaying
      ? frequencyData[frequencyIndex] / 255
      : 0.12 + Math.abs(Math.sin(index * 0.47)) * 0.12;
    const barHeight = Math.max(2, measured * bounds.height * 0.92);
    const x = index * slotWidth + (slotWidth - barWidth) / 2;
    const y = (bounds.height - barHeight) / 2;
    canvasContext.fillRect(x, y, barWidth, barHeight);
  }

  requestAnimationFrame(drawVisualizer);
}

stationGrid.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;

  const card = event.target.closest("button[data-station-id]");
  if (!card) return;

  const station = stations.find((entry) => entry.id === card.dataset.stationId);
  if (station) void playStation(station);
});

playButton.addEventListener("click", togglePlayback);
unlockAudioButton.addEventListener("click", unlockAudio);

volumeControl.addEventListener("input", () => {
  const volume = Number(volumeControl.value) / 100;
  if (currentAudio) currentAudio.volume = volume;
  updateVolumeTrack();
});

renderStations();
updateVolumeTrack();
drawVisualizer();
