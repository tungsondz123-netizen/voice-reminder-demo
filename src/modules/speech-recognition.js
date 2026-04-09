function getSpeechRecognitionClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function mapRecognitionError(errorCode) {
  switch (errorCode) {
    case "audio-capture":
      return "Khong lay duoc microphone cho speech-to-text.";
    case "network":
      return "Speech-to-text dang gap loi dich vu hoac mang.";
    case "not-allowed":
    case "service-not-allowed":
      return "Safari dang chan quyen speech-to-text hoac microphone.";
    case "no-speech":
      return "Khong nghe thay giong noi. Hay noi ro hon.";
    default:
      return "Khong the chuyen giong noi thanh chu tren trinh duyet hien tai.";
  }
}

export function createSpeechRecognition({ onStateChange, onTranscript, onError }) {
  let recognition = null;
  let active = false;
  let baseTranscript = "";

  function emitState(statusText) {
    onStateChange({
      isListening: active,
      statusText,
    });
  }

  return {
    isSupported() {
      return Boolean(getSpeechRecognitionClass());
    },
    isListening() {
      return active;
    },
    start(initialTranscript = "") {
      if (active) {
        return true;
      }

      const SpeechRecognitionClass = getSpeechRecognitionClass();
      if (!SpeechRecognitionClass) {
        onError("Speech-to-text chua duoc ho tro tren trinh duyet nay.");
        return false;
      }

      baseTranscript = initialTranscript.trim();
      recognition = new SpeechRecognitionClass();
      recognition.lang = "vi-VN";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        active = true;
        emitState("Dang nghe de chuyen thanh chu...");
      };

      recognition.onspeechstart = () => {
        emitState("Da nghe thay giong noi.");
      };

      recognition.onspeechend = () => {
        emitState("Dang xu ly cau vua noi...");
      };

      recognition.onresult = (event) => {
        const nextTranscript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join(" ")
          .trim();

        const mergedTranscript = [baseTranscript, nextTranscript]
          .filter(Boolean)
          .join(baseTranscript && nextTranscript ? " " : "")
          .trim();

        onTranscript(mergedTranscript);
      };

      recognition.onerror = (event) => {
        onError(mapRecognitionError(event.error));
      };

      recognition.onend = () => {
        active = false;
        recognition = null;
        emitState("Speech-to-text da dung.");
      };

      try {
        recognition.start();
        return true;
      } catch {
        onError("Khong the bat dau speech-to-text. Tren iPhone, hay kiem tra Safari va Siri.");
        recognition = null;
        return false;
      }
    },
    stop() {
      if (!recognition || !active) {
        return;
      }
      recognition.stop();
    },
  };
}
