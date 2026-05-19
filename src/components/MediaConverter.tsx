import { useState } from "react";
import { Music, Video, Check, AlertCircle, ChevronDown } from "lucide-react";
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

  const startConversion = async (mode: "MP3" | "Video", resLabel = "") => {
    try {
      setStatus("processing");
      setProgress(20);
      
      const response = await fetch(videoSrc);
      const blob = await response.blob();
      const safeBaseName = videoTitle.replace(/[^a-zA-Z0-9_-]/g, "_");

      if (mode === "MP3") {
        // Yahan tumhara existing extractAudioTrackDirectly function call hoga
        const rawAudioData = await extractAudioTrackDirectly(blob);
        const worker = createAudioWorker();
        worker.postMessage({ rawAudioBase64: rawAudioData, safeBaseName });
        worker.onmessage = (e) => handleWorkerResult(e.data);
      } else {
        const fileObj = new File([blob], videoTitle || "video.mp4", { type: blob.type });
        const worker = createVideoWorker();
        worker.postMessage({ file: fileObj, resolution: resLabel, safeBaseName });
        worker.onmessage = (e) => handleWorkerResult(e.data);
      }
    } catch {
      setStatus("error");
    }
  };

  const handleWorkerResult = async (data: any) => {
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

  // ExtractAudioTrackDirectly function yahan pehle ki tarah paste kar do...
  const extractAudioTrackDirectly = async (videoBlob: Blob): Promise<string> => {
      // (Aapka purana audio code yahan paste kar dena)
      return ""; 
  };

  return (
    <div className="w-full px-4 py-3">
       {/* (Aapka UI code wahi rahega) */}
       {status === "idle" && (
         <div className="flex gap-2">
            <button onClick={() => startConversion("Video", "360p")}>Convert Video</button>
            <button onClick={() => startConversion("MP3")}>Convert MP3</button>
         </div>
       )}
    </div>
  );
}
