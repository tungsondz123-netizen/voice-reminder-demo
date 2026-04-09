function chooseMimeType() {
  const candidates = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];

  for (const candidate of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(candidate)) {
      return candidate;
    }
  }

  return "";
}

export function createAudioRecorder({ onLevel, onStatus, onError, onRecorded }) {
  let stream = null;
  let recorder = null;
  let chunks = [];
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let animationFrameId = null;
  let startedAt = 0;

  function stopMeter() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    onLevel(0);
  }

  function stopTracks() {
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
  }

  function renderLevel() {
    if (!analyser || !dataArray) {
      return;
    }

    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let index = 0; index < dataArray.length; index += 1) {
      const normalized = (dataArray[index] - 128) / 128;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / dataArray.length);
    const percent = Math.min(100, Math.round(rms * 320));
    onLevel(percent);
    animationFrameId = requestAnimationFrame(renderLevel);
  }

  async function prepareStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Trình duyệt không hỗ trợ microphone.");
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      renderLevel();
    }
  }

  return {
    isRecording() {
      return Boolean(recorder && recorder.state === "recording");
    },
    supportsRecording() {
      return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
    },
    async start() {
      if (this.isRecording()) {
        return;
      }

      chunks = [];
      startedAt = Date.now();

      try {
        await prepareStream();
      } catch (error) {
        onError(error instanceof Error ? error.message : "Không mở được microphone.");
        stopMeter();
        stopTracks();
        return false;
      }

      const mimeType = chooseMimeType();
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        stopMeter();
        const blob = new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/mp4",
        });
        const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        onRecorded({
          blob,
          url: URL.createObjectURL(blob),
          mimeType: recorder.mimeType || mimeType || "audio/mp4",
          durationSeconds: seconds,
        });
        stopTracks();
      });

      recorder.start();
      if (recorder.state !== "recording") {
        onError("Safari đã mở microphone nhưng không thực sự bắt đầu ghi. Hãy dùng nút bộ ghi âm của iPhone để fallback.");
        stopMeter();
        stopTracks();
        return false;
      }
      onStatus("Đang ghi. Hãy nói gần microphone trên điện thoại.");
      return true;
    },
    stop() {
      if (!this.isRecording()) {
        return;
      }
      onStatus("Đang hoàn tất bản ghi...");
      recorder.stop();
    },
    destroy() {
      stopMeter();
      stopTracks();
    },
  };
}
