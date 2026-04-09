import { createAudioRecorder } from "./modules/audio-recorder.js";
import { createAudioNoteStorage } from "./modules/audio-note-storage.js";
import { createStorage } from "./modules/storage.js";
import { createReminderParser } from "./modules/reminder-parser.js";
import { createNotificationService } from "./modules/notifications.js";
import { createSpeechRecognition } from "./modules/speech-recognition.js";

const storage = createStorage();
const audioStorage = createAudioNoteStorage();
const reminderParser = createReminderParser();
const notifications = createNotificationService();

const elements = {
  statusBox: document.querySelector("#statusBox"),
  warningBox: document.querySelector("#warningBox"),
  recordBtn: document.querySelector("#recordBtn"),
  recordLabel: document.querySelector("#recordLabel"),
  recordTimer: document.querySelector("#recordTimer"),
  meterFill: document.querySelector("#meterFill"),
  meterText: document.querySelector("#meterText"),
  draftAudio: document.querySelector("#draftAudio"),
  transcriptInput: document.querySelector("#transcriptInput"),
  suggestionBox: document.querySelector("#suggestionBox"),
  analyzeBtn: document.querySelector("#analyzeBtn"),
  saveBtn: document.querySelector("#saveBtn"),
  speechBtn: document.querySelector("#speechBtn"),
  transcribeBtn: document.querySelector("#transcribeBtn"),
  nativeAudioInput: document.querySelector("#nativeAudioInput"),
  nativeRecordBtn: document.querySelector("#nativeRecordBtn"),
  notesList: document.querySelector("#notesList"),
};

const state = {
  notes: storage.getNotes(),
  reminders: storage.getReminders(),
  suggestion: null,
  draftAudio: null,
  timerId: null,
  recordingStartedAt: 0,
  audioUrls: new Map(),
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${pad(minutes)}:${pad(remainder)}`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function setStatus(message) {
  elements.statusBox.textContent = message;
}

function setWarning(message) {
  if (!message) {
    elements.warningBox.hidden = true;
    elements.warningBox.textContent = "";
    return;
  }
  elements.warningBox.hidden = false;
  elements.warningBox.textContent = message;
}

function setBusyTranscription(isBusy) {
  elements.transcribeBtn.disabled = isBusy;
  elements.transcribeBtn.textContent = isBusy ? "Dang chuyen thanh chu..." : "Chuyen audio thanh chu (AI)";
}

function renderSuggestion() {
  if (!state.suggestion) {
    elements.suggestionBox.hidden = true;
    elements.suggestionBox.textContent = "";
    return;
  }

  elements.suggestionBox.hidden = false;
  elements.suggestionBox.textContent = `De xuat reminder: ${state.suggestion.title} luc ${formatDateTime(state.suggestion.dueAt)}`;
}

function setDraftAudio(fileOrBlob, durationSeconds = null) {
  if (state.draftAudio?.url) {
    URL.revokeObjectURL(state.draftAudio.url);
  }

  const url = URL.createObjectURL(fileOrBlob);
  state.draftAudio = { blob: fileOrBlob, url, durationSeconds };
  elements.draftAudio.src = url;
}

async function attachAudio(note) {
  if (!note.audioId || state.audioUrls.has(note.audioId)) {
    return state.audioUrls.get(note.audioId) ?? "";
  }

  const blob = await audioStorage.getAudio(note.audioId);
  if (!blob) {
    return "";
  }

  const url = URL.createObjectURL(blob);
  state.audioUrls.set(note.audioId, url);
  return url;
}

async function renderNotes() {
  if (!state.notes.length) {
    elements.notesList.innerHTML = '<div class="empty">Chua co note nao. Hay tao mot note dau tien tren dien thoai.</div>';
    return;
  }

  const cards = await Promise.all(state.notes.map(async (note) => {
    const reminder = state.reminders.find((item) => item.id === note.reminderId) ?? null;
    const audioUrl = await attachAudio(note);
    const body = note.transcript?.trim() || "Voice note chua co transcript.";

    return `
      <article class="card">
        <h3>${body.slice(0, 40)}${body.length > 40 ? "..." : ""}</h3>
        <p>${body}</p>
        <div class="meta">
          <span class="pill">${formatDateTime(note.createdAt)}</span>
          ${note.durationSeconds ? `<span class="pill">${note.durationSeconds}s</span>` : ""}
          ${reminder ? `<span class="pill">Nhac luc ${formatDateTime(reminder.dueAt)}</span>` : '<span class="pill">Chua co reminder</span>'}
        </div>
        ${audioUrl ? `<audio controls src="${audioUrl}"></audio>` : ""}
      </article>
    `;
  }));

  elements.notesList.innerHTML = cards.join("");
}

function analyzeTranscript() {
  const transcript = elements.transcriptInput.value.trim();
  state.suggestion = reminderParser.extractReminder(transcript);
  renderSuggestion();
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateTimer() {
  if (!state.recordingStartedAt) {
    elements.recordTimer.textContent = "00:00";
    return;
  }

  const elapsed = Math.max(0, Math.floor((Date.now() - state.recordingStartedAt) / 1000));
  elements.recordTimer.textContent = formatDuration(elapsed);
}

const speechRecognition = createSpeechRecognition({
  onStateChange: ({ isListening, statusText }) => {
    elements.speechBtn.textContent = isListening ? "Dung speech-to-text" : "Noi de chuyen thanh chu";
    setStatus(statusText);
  },
  onTranscript: (transcript) => {
    elements.transcriptInput.value = transcript;
    analyzeTranscript();
  },
  onError: (message) => {
    setWarning(message);
    elements.speechBtn.textContent = "Noi de chuyen thanh chu";
  },
});

const recorder = createAudioRecorder({
  onLevel: (level) => {
    elements.meterFill.style.width = `${level}%`;
    elements.meterText.textContent = `Muc am: ${level}%`;
  },
  onStatus: (message) => {
    setStatus(message);
  },
  onError: (message) => {
    setWarning(message);
    stopTimer();
    elements.recordBtn.classList.remove("is-recording");
    elements.recordLabel.textContent = "Bat dau ghi";
    state.recordingStartedAt = 0;
    updateTimer();
  },
  onRecorded: ({ blob, url, durationSeconds }) => {
    stopTimer();
    if (state.draftAudio?.url) {
      URL.revokeObjectURL(state.draftAudio.url);
    }
    state.draftAudio = { blob, url, durationSeconds };
    elements.draftAudio.src = url;
    elements.recordBtn.classList.remove("is-recording");
    elements.recordLabel.textContent = "Ghi lai";
    elements.recordTimer.textContent = formatDuration(durationSeconds);
    setStatus("Da thu xong. Ban co the sua transcript roi luu note.");
  },
});

function checkEnvironment() {
  if (!window.isSecureContext) {
    setWarning("Tren iPhone, trang nay can mo bang HTTPS de dung microphone.");
  }

  if (!recorder.supportsRecording()) {
    elements.recordBtn.disabled = true;
    setWarning("Trinh duyet hien tai khong ho tro ghi am web. Tren iPhone nen dung Safari moi.");
    setStatus("Khong the bat dau app demo.");
    return;
  }

  if (speechRecognition.isSupported()) {
    setStatus("San sang. Ban co the ghi am hoac bam speech-to-text de noi thanh chu.");
    return;
  }

  setStatus("San sang. Speech-to-text co the khong ho tro tren may nay, nhung ban van co the ghi am va nhap transcript thu cong.");
}

elements.recordBtn.addEventListener("click", async () => {
  setWarning("");

  if (speechRecognition.isListening()) {
    speechRecognition.stop();
  }

  if (recorder.isRecording()) {
    recorder.stop();
    return;
  }

  const started = await recorder.start();
  if (!started) {
    return;
  }

  state.recordingStartedAt = Date.now();
  updateTimer();
  stopTimer();
  state.timerId = setInterval(updateTimer, 250);
  elements.recordBtn.classList.add("is-recording");
  elements.recordLabel.textContent = "Dung ghi";
});

elements.speechBtn.addEventListener("click", () => {
  setWarning("");

  if (!speechRecognition.isSupported()) {
    setWarning("Speech-to-text khong duoc Safari hien tai ho tro. Tren iPhone, thu cap nhat iOS va bat Siri.");
    return;
  }

  if (recorder.isRecording()) {
    recorder.stop();
  }

  if (speechRecognition.isListening()) {
    speechRecognition.stop();
    return;
  }

  speechRecognition.start(elements.transcriptInput.value);
});

elements.transcribeBtn.addEventListener("click", async () => {
  setWarning("");

  if (!state.draftAudio?.blob) {
    setWarning("Can co file audio truoc khi chuyen thanh chu. Hay ghi am hoac chon audio tu iPhone.");
    return;
  }

  if (window.location.hostname.endsWith("github.io")) {
    setWarning("Ban dang mo ban GitHub Pages. Backend transcription chi chay khi deploy repo nay tren Vercel.");
    return;
  }

  setBusyTranscription(true);
  setStatus("Dang gui audio len AI de transcribe...");

  try {
    const formData = new FormData();
    const filename = state.draftAudio.blob.type.includes("webm") ? "voice-note.webm" : "voice-note.m4a";
    formData.append("file", state.draftAudio.blob, filename);
    formData.append("prompt", "Day la ghi chu nhanh bang tieng Viet. Hay tra ve transcript tieng Viet ro rang, giu nguyen y nghia.");

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    const rawText = await response.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      const message = data.error || `Khong the transcribe audio luc nay (HTTP ${response.status}).`;
      const upstreamSuffix = data.upstream_status ? ` [OpenAI ${data.upstream_status}]` : "";
      throw new Error(`${message}${upstreamSuffix}`);
    }

    elements.transcriptInput.value = data.text || "";
    analyzeTranscript();
    setStatus("Da nhan transcript tu AI.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Khong the transcribe audio.";
    setWarning(message);
    setStatus(`Transcription that bai. ${message}`);
  } finally {
    setBusyTranscription(false);
  }
});

elements.analyzeBtn.addEventListener("click", analyzeTranscript);
elements.transcriptInput.addEventListener("input", analyzeTranscript);

elements.nativeRecordBtn.addEventListener("click", () => {
  if (speechRecognition.isListening()) {
    speechRecognition.stop();
  }
  elements.nativeAudioInput.click();
});

elements.nativeAudioInput.addEventListener("change", (event) => {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  setWarning("");
  setDraftAudio(file, null);
  elements.recordBtn.classList.remove("is-recording");
  elements.recordLabel.textContent = "Bat dau ghi";
  elements.recordTimer.textContent = "00:00";
  setStatus("Da nhan file audio tu bo ghi am cua iPhone. Ban co the dung speech-to-text hoac sua transcript roi luu note.");
  event.target.value = "";
});

elements.saveBtn.addEventListener("click", async () => {
  const transcript = elements.transcriptInput.value.trim();
  if (!state.draftAudio && !transcript) {
    setWarning("Can co it nhat audio hoac transcript de luu note.");
    return;
  }

  const noteId = crypto.randomUUID();
  const note = {
    id: noteId,
    transcript,
    createdAt: new Date().toISOString(),
    reminderId: null,
    audioId: null,
    durationSeconds: state.draftAudio?.durationSeconds ?? null,
  };

  if (state.draftAudio) {
    const audioId = crypto.randomUUID();
    await audioStorage.saveAudio(audioId, state.draftAudio.blob);
    note.audioId = audioId;
  }

  if (state.suggestion) {
    const reminder = {
      id: crypto.randomUUID(),
      noteId,
      title: state.suggestion.title,
      dueAt: state.suggestion.dueAt,
      createdAt: new Date().toISOString(),
      status: "scheduled",
    };
    note.reminderId = reminder.id;
    state.reminders = storage.saveReminder(reminder);
    notifications.schedule(reminder);
  }

  state.notes = storage.saveNote(note);
  elements.transcriptInput.value = "";
  elements.draftAudio.removeAttribute("src");
  elements.draftAudio.load();
  if (state.draftAudio?.url) {
    URL.revokeObjectURL(state.draftAudio.url);
  }
  state.suggestion = null;
  state.draftAudio = null;
  renderSuggestion();
  await renderNotes();
  setStatus("Da luu note tren dien thoai.");
});

notifications.restoreScheduledChecks(() => {
  state.reminders = storage.getReminders();
  renderNotes();
});

window.addEventListener("beforeunload", () => {
  stopTimer();
  recorder.destroy();
  if (speechRecognition.isListening()) {
    speechRecognition.stop();
  }
  for (const url of state.audioUrls.values()) {
    URL.revokeObjectURL(url);
  }
});

checkEnvironment();
setBusyTranscription(false);
renderSuggestion();
renderNotes();
