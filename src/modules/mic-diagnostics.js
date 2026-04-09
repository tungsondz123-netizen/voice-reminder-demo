export function createMicDiagnostics({ onLevelChange, onStatusChange }) {
  let stream = null;
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let animationFrameId = null;
  let running = false;

  function stop() {
    running = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    analyser = null;
    dataArray = null;
    onLevelChange(0);
  }

  function renderLevel() {
    if (!running || !analyser || !dataArray) {
      return;
    }

    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let index = 0; index < dataArray.length; index += 1) {
      const normalized = (dataArray[index] - 128) / 128;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / dataArray.length);
    const level = Math.min(100, Math.round(rms * 300));
    onLevelChange(level);
    animationFrameId = requestAnimationFrame(renderLevel);
  }

  return {
    isRunning() {
      return running;
    },
    async start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        onStatusChange("Trình duyệt không hỗ trợ microphone.");
        return false;
      }

      stop();

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        onStatusChange("Không mở được microphone. Hãy kiểm tra quyền mic trong Chrome.");
        return false;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        onStatusChange("Đã mở mic nhưng trình duyệt không hỗ trợ đo mức âm.");
        return true;
      }

      audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.fftSize);
      source.connect(analyser);

      running = true;
      onStatusChange("Mic đang mở. Hãy nói thử, nếu thanh không nhảy thì Chrome đang lấy sai mic hoặc mic quá nhỏ.");
      renderLevel();
      return true;
    },
    stop,
  };
}
