import { createStorage } from "./modules/storage.js";
import { createRecorder } from "./modules/voice-recorder.js";
import { createReminderParser } from "./modules/reminder-parser.js";
import { createNotificationService } from "./modules/notifications.js";
import { createRenderer } from "./modules/renderer.js";
import { createMicDiagnostics } from "./modules/mic-diagnostics.js";

const storage = createStorage();
const reminderParser = createReminderParser();
const notifications = createNotificationService();
const renderer = createRenderer();

const elements = {
  recordBtn: document.querySelector("#recordBtn"),
  recordLabel: document.querySelector("#recordLabel"),
  recordingStatus: document.querySelector("#recordingStatus"),
  recordingTimer: document.querySelector("#recordingTimer"),
  transcriptInput: document.querySelector("#transcriptInput"),
  analyzeBtn: document.querySelector("#analyzeBtn"),
  saveBtn: document.querySelector("#saveBtn"),
  searchInput: document.querySelector("#searchInput"),
  notesList: document.querySelector("#notesList"),
  remindersList: document.querySelector("#remindersList"),
  reminderSuggestion: document.querySelector("#reminderSuggestion"),
  suggestionTitle: document.querySelector("#suggestionTitle"),
  suggestionDateText: document.querySelector("#suggestionDateText"),
  notificationBtn: document.querySelector("#notificationBtn"),
  supportMessage: document.querySelector("#supportMessage"),
  testMicBtn: document.querySelector("#testMicBtn"),
  micStatus: document.querySelector("#micStatus"),
  levelFill: document.querySelector("#levelFill"),
};

const micDiagnostics = createMicDiagnostics({
  onLevelChange: (level) => {
    elements.levelFill.style.width = `${level}%`;
  },
  onStatusChange: (message) => {
    elements.micStatus.textContent = message;
  },
});

const state = {
  draftTranscript: "",
  suggestedReminder: null,
  notes: storage.getNotes(),
  reminders: storage.getReminders(),
  searchTerm: "",
};

const recorder = createRecorder({
  onStateChange: ({ isRecording, durationLabel, statusText }) => {
    elements.recordBtn.classList.toggle("is-recording", isRecording);
    elements.recordBtn.setAttribute("aria-pressed", String(isRecording));
    elements.recordLabel.textContent = isRecording ? "Dừng ghi" : "Bắt đầu ghi";
    elements.recordingStatus.textContent = statusText;
    elements.recordingTimer.textContent = durationLabel;
  },
  onTranscript: (transcript) => {
    state.draftTranscript = transcript;
    elements.transcriptInput.value = transcript;
    analyzeTranscript();
  },
  onError: (message) => {
    showSupportMessage(message);
  },
});

function updateMicButton() {
  elements.testMicBtn.textContent = micDiagnostics.isRunning() ? "Dừng test mic" : "Kiểm tra mic";
}

function showSupportMessage(message) {
  if (!message) {
    elements.supportMessage.classList.add("is-hidden");
    elements.supportMessage.textContent = "";
    return;
  }
  elements.supportMessage.textContent = message;
  elements.supportMessage.classList.remove("is-hidden");
}

function checkEnvironment() {
  const issues = [];
  if (!window.isSecureContext) {
    issues.push("Mic chỉ hoạt động ổn định khi mở demo bằng http://localhost hoặc https, không nên mở trực tiếp file HTML.");
  }
  if (!recorder.supportsSpeechRecognition()) {
    issues.push("Trình duyệt hiện tại không hỗ trợ chuyển giọng nói thành chữ. Hãy thử Chrome hoặc Edge mới nhất.");
  }

  if (issues.length) {
    elements.recordBtn.disabled = true;
    elements.testMicBtn.disabled = true;
    showSupportMessage(issues.join(" "));
    return;
  }

  showSupportMessage("Bấm ghi, nói một câu ngắn rõ ràng, rồi chờ 1 đến 2 giây để trình duyệt xử lý. Nếu vẫn lỗi, bấm Kiểm tra mic để xem Chrome có đang lấy đúng microphone không.");
}

function analyzeTranscript() {
  const transcript = elements.transcriptInput.value.trim();
  state.draftTranscript = transcript;
  state.suggestedReminder = reminderParser.extractReminder(transcript);
  renderer.renderSuggestion(elements, state.suggestedReminder);
}

function saveNote() {
  const transcript = elements.transcriptInput.value.trim();
  if (!transcript) {
    alert("Cần có nội dung trước khi lưu.");
    return;
  }

  const note = {
    id: crypto.randomUUID(),
    transcript,
    createdAt: new Date().toISOString(),
    reminderId: null,
  };

  if (state.suggestedReminder) {
    const reminder = {
      id: crypto.randomUUID(),
      noteId: note.id,
      title: state.suggestedReminder.title,
      dueAt: state.suggestedReminder.dueAt,
      createdAt: new Date().toISOString(),
      status: "scheduled",
    };
    note.reminderId = reminder.id;
    state.reminders = storage.saveReminder(reminder);
    notifications.schedule(reminder);
  }

  state.notes = storage.saveNote(note);
  elements.transcriptInput.value = "";
  state.draftTranscript = "";
  state.suggestedReminder = null;
  renderer.renderSuggestion(elements, null);
  renderLists();
}

function renderLists() {
  const visibleNotes = renderer.filterNotes(state.notes, state.searchTerm);
  const visibleReminders = renderer.filterReminders(state.reminders, state.searchTerm);
  renderer.renderNotes(elements.notesList, visibleNotes);
  renderer.renderReminders(elements.remindersList, visibleReminders);
}

elements.recordBtn.addEventListener("click", async () => {
  if (recorder.isRecording()) {
    recorder.stop();
    return;
  }

  try {
    micDiagnostics.stop();
    updateMicButton();
    await recorder.start();
  } catch (error) {
    const message = error?.message || "Không thể bắt đầu ghi âm.";
    showSupportMessage(message);
    alert(message);
  }
});

elements.testMicBtn.addEventListener("click", async () => {
  if (micDiagnostics.isRunning()) {
    micDiagnostics.stop();
    elements.micStatus.textContent = "Đã tắt kiểm tra mic.";
    updateMicButton();
    return;
  }

  const started = await micDiagnostics.start();
  updateMicButton();
  if (started) {
    showSupportMessage("Nếu thanh mức âm nhảy mạnh khi bạn nói mà transcript vẫn trống, hãy đổi microphone trong Chrome hoặc Windows rồi thử lại.");
  }
});

elements.analyzeBtn.addEventListener("click", analyzeTranscript);
elements.saveBtn.addEventListener("click", saveNote);
elements.searchInput.addEventListener("input", (event) => {
  state.searchTerm = event.target.value.trim().toLowerCase();
  renderLists();
});
elements.transcriptInput.addEventListener("input", analyzeTranscript);
elements.notificationBtn.addEventListener("click", async () => {
  const granted = await notifications.requestPermission();
  alert(granted ? "Thông báo đã được bật." : "Trình duyệt chưa cấp quyền thông báo.");
});

notifications.restoreScheduledChecks(() => {
  state.reminders = storage.getReminders();
  renderLists();
});

window.addEventListener("beforeunload", () => {
  micDiagnostics.stop();
});

checkEnvironment();
updateMicButton();
renderLists();
