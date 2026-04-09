import { createAudioRecorder } from "./modules/audio-recorder.js";

const elements = {
  startBtn: document.querySelector("#startBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  statusBox: document.querySelector("#statusBox"),
  warningBox: document.querySelector("#warningBox"),
  meterFill: document.querySelector("#meterFill"),
  meterText: document.querySelector("#meterText"),
  playback: document.querySelector("#playback"),
  recordDetails: document.querySelector("#recordDetails"),
};

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
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;
  },
  onRecorded: ({ url, mimeType, durationSeconds, blob }) => {
    elements.playback.src = url;
    elements.recordDetails.textContent = `Đã thu xong ${durationSeconds} giây, định dạng ${mimeType}, dung lượng ${(blob.size / 1024).toFixed(1)} KB.`;
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;
    setStatus("Bản ghi đã sẵn sàng. Hãy bấm Play để nghe lại.");
  },
});

function checkEnvironment() {
  if (!window.isSecureContext) {
    setWarning("Trang test mic trên điện thoại phải mở bằng HTTPS. Nếu bạn mở từ máy tính qua IP nội bộ bằng http://192.168.x.x thì iPhone sẽ không cho dùng microphone.");
  }

  if (!recorder.supportsRecording()) {
    elements.startBtn.disabled = true;
    setWarning("Trình duyệt hiện tại không hỗ trợ ghi âm web. Trên iPhone nên dùng Safari mới.");
    setStatus("Không thể bắt đầu test mic.");
    return;
  }

  setStatus("Sẵn sàng test. Bấm Bắt đầu test mic rồi cho phép quyền microphone.");
}

elements.startBtn.addEventListener("click", async () => {
  setWarning("");
  const started = await recorder.start();
  if (!started) {
    return;
  }
  elements.startBtn.disabled = true;
  elements.stopBtn.disabled = false;
});

elements.stopBtn.addEventListener("click", () => {
  recorder.stop();
});

window.addEventListener("beforeunload", () => {
  recorder.destroy();
});

checkEnvironment();
