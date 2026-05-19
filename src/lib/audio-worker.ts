// Dedicated Audio Pipeline
export function createAudioWorker() {
  const workerCode = `
    self.onmessage = async (e) => {
      const { rawAudioBase64, safeBaseName } = e.data;
      try {
        const byteCharacters = atob(rawAudioBase64);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
        
        const blob = new Blob([byteArray], { type: 'audio/mp3' });
        const reader = new FileReader();
        reader.onloadend = () => {
          self.postMessage({ type: 'done', base64: reader.result.split(',')[1], name: "ZabPlay_" + safeBaseName + ".mp3" });
        };
        reader.readAsDataURL(blob);
      } catch (err) { self.postMessage({ type: 'error', error: err.message }); }
    };
  `;
  return new Worker(URL.createObjectURL(new Blob([workerCode], { type: "application/javascript" })));
}

