import { useState } from "react";
import { Music, Video, Check, AlertCircle, ChevronDown } from "lucide-react";
// Humne yahan do alag workers import kiye hain
import { createAudioWorker } from "@/lib/audio-worker";
import { createVideoWorker } from "@/lib/video-worker";
import { Filesystem, Directory } from "@capacitor/filesystem";

interface MediaConverterProps {
  videoSrc: string;
  videoTitle: string;
}

export function MediaConverter({ videoSrc, videoTitle }: MediaConverterProps) {
  const [showResolutions, setShowResolutions] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [currentMode, setCurrentMode] = useState<"MP3" | "Video">("Video");

  const startConversion = async (mode: "MP3" | "Video", resLabel = "") => {
    try {
      setCurrentMode(mode);
      setStatus("processing");
      setProgress(20);

      const response = await fetch(videoSrc);
      const blob = await response.blob();
      const fileObj = new File([blob], videoTitle || "video.mp4", { type: blob.type });
      const safeBaseName = videoTitle.replace(/[^a-zA-Z0-9_-]/g, "_");

      if (mode === "MP3") {
        // AUDIO PIPELINE
        const audioWorker = createAudioWorker();
        const audioData = await extractAudioTrackDirectly(blob);
        audioWorker.postMessage({ rawAudioBase64: audioData, safeBaseName });
        
        audioWorker.onmessage = (e) => handleWorkerDone(e.data);
      } else {
        // VIDEO PIPELINE
        const videoWorker = createVideoWorker();
        videoWorker.postMessage({ file: fileObj, resolution: resLabel, safeBaseName });
        
        videoWorker.onmessage = (e) => handleWorkerDone(e.data);
      }
    } catch {
      setStatus("error");
    }
  };

  const handleWorkerDone = async (data: any) => {
    if (data.type === "done") {
      try {
        await Filesystem.writeFile({
          path: data.name,
          data: data.base64,
          directory: Directory.Documents,
          recursive: true
        });
        setStatus("success");
      } catch {
        setStatus("error");
      }
    } else {
      setStatus("error");
    }
  };

  // ... (Baaki UI code wahi rahega jo pehle tha)

