function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${pad(minutes)}:${pad(remainder)}`;
}

function getRecognitionClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function mapRecognitionError(errorCode) {
  switch (errorCode) {
    case "no-speech":
      return "Không nghe rõ giọng nói. Hãy nói gần microphone hơn và thử lại.";
    case "audio-capture":
      return "Trình duyệt không lấy được tín hiệu microphone.";
    case "not-allowed":
    case "service-not-allowed":
      return "Trình duyệt đang chặn quyền microphone hoặc speech recognition.";
    case "network":
      return "Speech recognition của trình duyệt bị lỗi mạng hoặc dịch vụ nhận dạng không sẵn sàng.";
    default:
      return "Không thể chuyển giọng nói thành chữ trên trình duyệt hiện tại.";
  }
}

export function createRecorder({ onStateChange, onTranscript, onError }) {
  let isActive = false;
  let startedAt = 0;
  let timerId = null;
  let recognition = null;
  let isStopping = false;
  let transcriptCache = "";
  let heardAudio = false;
  let heardSpeech = false;

  function emitState(statusOverride) {
    const seconds = (isActive || isStopping) ? Math.floor((Date.now() - startedAt) / 1000) : 0;
    onStateChange({
      isRecording: isActive,
      durationLabel: formatDuration(seconds),
      statusText: statusOverride || (isActive ? "Đang nghe bạn nói..." : "Sẵn sàng ghi âm"),
    });
  }

  function setupRecognition() {
    const SpeechRecognition = getRecognitionClass();
    if (!SpeechRecognition) {
      return null;
    }
    const instance = new SpeechRecognition();
    instance.lang = "vi-VN";
    instance.continuous = false;
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    instance.onstart = () => {
      emitState("Microphone đã bật. Hãy nói rõ ràng.");
    };
    instance.onaudiostart = () => {
      heardAudio = true;
      emitState("Đã mở microphone. Hãy bắt đầu nói.");
    };
    instance.onsoundstart = () => {
      heardAudio = true;
      emitState("Đã phát hiện âm thanh.");
    };
    instance.onspeechstart = () => {
      heardSpeech = true;
      emitState("Đã nghe thấy giọng nói. Bạn cứ nói tiếp.");
    };
    instance.onspeechend = () => {
      emitState("Đang xử lý câu bạn vừa nói...");
      if (isActive) {
        isActive = false;
        isStopping = true;
      }
    };
    instance.onresult = (event) => {
      transcriptCache = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();
      onTranscript(transcriptCache);
      emitState("Đã nhận được lời nói, có thể bấm dừng.");
    };
    instance.onnomatch = () => {
      onError?.("Có âm thanh nhưng trình duyệt chưa nhận ra câu nói. Hãy nói chậm và rõ hơn.");
    };
    instance.onerror = (event) => {
      onError?.(mapRecognitionError(event.error));
    };
    instance.onend = () => {
      const hasTranscript = Boolean(transcriptCache.trim());
      isActive = false;
      isStopping = false;
      recognition = null;
      window.clearInterval(timerId);
      if (hasTranscript) {
        emitState("Đã dừng ghi âm.");
        return;
      }
      emitState("Không nhận được chữ nào từ giọng nói.");
      if (!heardAudio) {
        onError?.("Không phát hiện âm thanh từ microphone. Kiểm tra mic mặc định của Windows và quyền mic trong trình duyệt.");
        return;
      }
      if (!heardSpeech) {
        onError?.("Trình duyệt có nghe âm thanh nhưng chưa nhận ra giọng nói. Hãy nói chậm, gần mic hơn, và dùng Chrome hoặc Edge.");
        return;
      }
      onError?.("Đã nghe giọng nói nhưng không chuyển được thành chữ. Hãy thử nói ngắn một câu rồi chờ trình duyệt tự xử lý.");
    };
    return instance;
  }

  return {
    isRecording() {
      return isActive;
    },
    supportsSpeechRecognition() {
      return Boolean(getRecognitionClass());
    },
    async start() {
      if (isActive) {
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Trình duyệt chưa cấp hoặc không hỗ trợ microphone.");
      }
      if (!getRecognitionClass()) {
        throw new Error("Trình duyệt hiện tại không hỗ trợ chuyển giọng nói thành chữ. Hãy thử Chrome hoặc Edge mới.");
      }
      transcriptCache = "";
      heardAudio = false;
      heardSpeech = false;
      recognition = setupRecognition();
      if (!recognition) {
        throw new Error("Không khởi tạo được speech recognition.");
      }
      try {
        recognition.start();
      } catch {
        throw new Error("Không thể bắt đầu nhận giọng nói. Hãy thử tải lại trang rồi cho phép microphone.");
      }
      isActive = true;
      isStopping = false;
      startedAt = Date.now();
      emitState("Đang khởi động microphone...");
      timerId = window.setInterval(emitState, 500);
    },
    stop() {
      if (!isActive) {
        return;
      }
      isActive = false;
      isStopping = true;
      recognition?.stop();
      window.clearInterval(timerId);
      emitState("Đang xử lý giọng nói...");
    },
  };
}
