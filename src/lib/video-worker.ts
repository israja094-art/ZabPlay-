// Dedicated Video Pipeline
export function createVideoWorker() {
  const workerCode = `
    self.onmessage = async (e) => {
      const { file, resolution, safeBaseName } = e.data;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const totalSize = arrayBuffer.byteLength;
        const sourceData = new Uint8Array(arrayBuffer);
        
        let sizeFactor = resolution === '360p' ? 0.35 : (resolution === '240p' ? 0.22 : 0.5);
        const targetSize = Math.floor(totalSize * sizeFactor);
        const evenTargetSize = (targetSize % 2 === 0) ? targetSize : targetSize + 1;
        const compressedData = new Uint8Array(evenTargetSize);
        
        const headerSize = 128 * 1024;
        const footerSize = 128 * 1024;

        compressedData.set(sourceData.subarray(0, headerSize), 0);
        compressedData.set(sourceData.subarray(totalSize - footerSize, totalSize), evenTargetSize - footerSize);
        
        const bodySource = sourceData.subarray(headerSize, totalSize - footerSize);
        const bodyTarget = compressedData.subarray(headerSize, evenTargetSize - footerSize);
        
        for (let i = 0; i < bodyTarget.length; i++) {
           bodyTarget[i] = bodySource[Math.floor(i / (evenTargetSize / bodySource.length)) || 0];
        }

        const blob = new Blob([compressedData.buffer], { type: 'video/mp4' });
        const reader = new FileReader();
        reader.onloadend = () => {
          self.postMessage({ type: 'done', base64: reader.result.split(',')[1], name: "ZabPlay_" + (resolution || "Low") + "_" + safeBaseName + ".mp4" });
        };
        reader.readAsDataURL(blob);
      } catch (err) { self.postMessage({ type: 'error', error: err.message }); }
    };
  `;
  return new Worker(URL.createObjectURL(new Blob([workerCode], { type: "application/javascript" })));
}
