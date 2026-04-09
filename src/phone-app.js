import { createAudioRecorder } from "./modules/audio-recorder.js";
import { createAudioNoteStorage } from "./modules/audio-note-storage.js";
import { createStorage } from "./modules/storage.js";
import { createReminderParser } from "./modules/reminder-parser.js";
import { createNotificationService } from "./modules/notifications.js";

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

function renderSuggestion() {
  if (!state.suggestion) {
    elements.suggestionBox.hidden = true;
    elements.suggestionBox.textContent = "";
    return;
  }
  elements.suggestionBox.hidden = false;
  elements.suggestionBox.textContent = `Đề xuất reminder: ${state.suggestion.title} lúc ${formatDateTime(state.suggestion.dueAt)}`;
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
    elements.notesList.innerHTML = '<div class="empty">Chưa có note nào. Hãy ghi âm một note đầu tiên trên điện thoại.</div>';
    return;
  }

  const cards = await Promise.all(state.notes.map(async (note) => {
    const reminder = state.reminders.find((item) => item.id === note.reminderId) ?? null;
    const audioUrl = await attachAudio(note);
    const body = note.transcript?.trim() || "Voice note chưa có transcript.";
    return `
      <article class="card">
        <h3>${body.slice(0, 40)}${body.length > 40 ? "..." : ""}</h3>
        <p>${body}</p>
        <div class="meta">
          <span class="pill">${formatDateTime(note.createdAt)}</span>
          ${note.durationSeconds ? `<span class="pill">${note.durationSeconds}s</span>` : ""}
          ${reminder ? `<span class="pill">Nhắc lúc ${formatDateTime(reminder.dueAt)}</span>` : '<span class="pill">Chưa có reminder</span>'}
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

const recorder = createAudioRecorder({
  onLevel: (level) => {
    elements.meterFill.style.width = `${level}%`;
    elements.meterText.textContent = `Mức âm: ${level}%`;
  },
  onStatus: (message) => {
    setStatus(message);
  },
  onError: (message) => {
    setWarning(message);
    stopTimer();
    elements.recordBtn.classList.remove("is-recording");
    elements.recordLabel.textContent = "Bắt đầu ghi";
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
    elements.recordLabel.textContent = "Ghi lại";
    elements.recordTimer.textContent = formatDuration(durationSeconds);
    setStatus("Đã thu xong. Bạn có thể nhập transcript rồi lưu note.");
  },
});

function checkEnvironment() {
  if (!window.isSecureContext) {
    setWarning("Trên iPhone, trang này cần mở bằng HTTPS để dùng microphone.");
  }
  if (!recorder.supportsRecording()) {
    elements.recordBtn.disabled = true;
    setWarning("Trình duyệt hiện tại không hỗ trợ ghi âm web. Trên iPhone nên dùng Safari mới.");
    setStatus("Không thể bắt đầu app demo.");
    return;
  }
  setStatus("Sẵn sàng. Bấm Bắt đầu ghi để tạo voice note đầu tiên.");
}

elements.recordBtn.addEventListener("click", async () => {
  setWarning("");
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
  elements.recordLabel.textContent = "Dừng ghi";
});

elements.analyzeBtn.addEventListener("click", analyzeTranscript);
elements.transcriptInput.addEventListener("input", analyzeTranscript);
elements.nativeRecordBtn.addEventListener("click", () => {
  elements.nativeAudioInput.click();
});

elements.nativeAudioInput.addEventListener("change", async (event) => {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  setWarning("");
  setDraftAudio(file, null);
  elements.recordBtn.classList.remove("is-recording");
  elements.recordLabel.textContent = "Bắt đầu ghi";
  elements.recordTimer.textContent = "00:00";
  setStatus("Đã nhận file audio từ bộ ghi âm của iPhone. Bạn có thể nhập transcript rồi lưu note.");
  event.target.value = "";
});

elements.saveBtn.addEventListener("click", async () => {
  const transcript = elements.transcriptInput.value.trim();
  if (!state.draftAudio && !transcript) {
    setWarning("Cần có ít nhất audio hoặc transcript để lưu note.");
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
  setStatus("Đã lưu note trên điện thoại.");
});

notifications.restoreScheduledChecks(() => {
  state.reminders = storage.getReminders();
  renderNotes();
});

window.addEventListener("beforeunload", () => {
  stopTimer();
  recorder.destroy();
  for (const url of state.audioUrls.values()) {
    URL.revokeObjectURL(url);
  }
});

checkEnvironment();
renderSuggestion();
renderNotes();
