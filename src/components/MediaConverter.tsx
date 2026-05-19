import { useState } from "react";
import { Music, Video, Check, AlertCircle } from "lucide-react";
import { createFFmpegWorker } from "@/lib/ffmpeg-worker";

interface MediaConverterProps {
  videoSrc: string;
  videoTitle: string;
}

export function MediaConverter({ videoSrc, videoTitle }: MediaConverterProps) {
  const [showResolutions, setShowResolutions] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [currentMode, setCurrentMode] = useState<"MP3" | "Video">("Video");
  const [selectedRes, setSelectedRes] = useState("");

  const resolutions = [
    { label: "480p (Medium Quality)", val: "480p" },
    { label: "360p (Low Quality)", val: "360p" },
    { label: "240p (Very Low Quality)", val: "240p" },
  ];

  const startConversion = async (mode: "MP3" | "Video", resLabel = "") => {
    try {
      setCurrentMode(mode);
      setSelectedRes(resLabel);
      setShowResolutions(false);
      setStatus("processing");
      setProgress(0);

      // Fetch local blob offline
      const response = await fetch(videoSrc);
      const blob = await response.blob();
      const fileObj = new File([blob], videoTitle || "video.mp4", { type: blob.type });

      const worker = createFFmpegWorker();
      worker.postMessage({
        action: mode === "MP3" ? "mp3" : "compress",
        file: fileObj,
        resolution: resLabel,
      });

      worker.onmessage = (e) => {
        const data = e.data;
        if (data.type === "progress") {
          setProgress(data.progress);
        } else if (data.type === "done") {
          setStatus("success");
          setProgress(100);

          // Automatic system browser anchor trigger file save down to gallery/downloads
          const downloadUrl = URL.createObjectURL(data.blob);
          const downloadLink = document.createElement("a");
          downloadLink.href = downloadUrl;
          downloadLink.download = data.name;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);

          worker.terminate();
        } else if (data.type === "error") {
          setStatus("error");
          worker.terminate();
        }
      };
    } catch {
      setStatus("error");
    }
  };

  // Circular Progress Math Parameters
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-full px-4 pt-2 pb-3 bg-background border-b border-border/40">
      {/* Action Buttons Row */}
      {status === "idle" && (
        <div className="relative flex gap-2">
          <button
            onClick={() => {
              setShowResolutions(!showResolutions);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-secondary/80 text-foreground text-xs font-semibold rounded-xl border border-border/50 active:scale-95 transition-all"
          >
            <Video className="h-4 w-4 text-primary" /> Low Quality Video
          </button>

          <button
            onClick={() => startConversion("MP3")}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-primary text-primary-foreground text-xs font-semibold rounded-xl active:scale-95 transition-all shadow-md shadow-primary/10"
          >
            <Music className="h-4 w-4" /> Convert to MP3
          </button>

          {/* Resolution Options Popover Drawer */}
          {showResolutions && (
            <div className="absolute left-0 right-0 bottom-12 z-50 bg-popover border border-border rounded-xl shadow-xl py-1.5 flex flex-col backdrop-blur-md">
              {resolutions.map((r) => (
                <button
                  key={r.val}
                  onClick={() => startConversion("Video", r.val)}
                  className="w-full text-left px-4 py-2.5 text-xs text-foreground font-medium hover:bg-accent/40 active:bg-accent border-b border-border/30 last:border-0"
                >
                  Convert to {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stylish Circular Progress Panel Layout */}
      {status === "processing" && (
        <div className="flex flex-col items-center justify-center py-2 bg-secondary/20 border border-border/40 rounded-xl">
          <div className="relative flex items-center justify-center h-20 w-20">
            {/* SVG Circular Ring Track */}
            <svg className="absolute transform -rotate-90 w-full h-full">
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="text-muted-foreground/20"
                strokeWidth="4"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="text-primary transition-all duration-200"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>
            {/* Center Percentage Display Text */}
            <div className="text-center z-10">
              <span className="text-sm font-bold text-foreground">{progress}%</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium mt-1 animate-pulse">
            Extracting {currentMode} offline {selectedRes && `(${selectedRes})`}...
          </p>
        </div>
      )}

      {/* Success State with Checkmark Icon Ring */}
      {status === "success" && (
        <div className="flex flex-col items-center justify-center py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
          <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white mb-1.5 shadow-lg shadow-emerald-500/20 animate-scaleIn">
            <Check className="h-5 w-5 stroke-[3]" />
          </div>
          <h4 className="text-xs font-bold text-emerald-500">Conversion Finished Successfully!</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">File saved directly into your system storage</p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-2 px-3 py-1 bg-background border border-border/60 rounded-lg text-[10px] font-bold text-foreground uppercase active:scale-95"
          >
            Convert More
          </button>
        </div>
      )}

      {/* Error State Handler */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
          <div className="h-9 w-9 rounded-full bg-destructive/20 flex items-center justify-center text-destructive mb-1.5">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-destructive">Offline processing interrupted</p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-2 px-2.5 py-1 bg-destructive text-destructive-foreground rounded-lg text-[10px] font-bold uppercase active:scale-95"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

