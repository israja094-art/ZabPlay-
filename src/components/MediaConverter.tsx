import { useState } from "react";
import { Music, Video, Check, AlertCircle, ChevronDown } from "lucide-react";
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
    { label: "480p (Medium)", val: "480p" },
    { label: "360p (Low Quality)", val: "360p" },
    { label: "240p (Super Saver)", val: "240p" },
  ];

  const startConversion = async (mode: "MP3" | "Video", resLabel = "") => {
    try {
      setCurrentMode(mode);
      setSelectedRes(resLabel);
      setShowResolutions(false);
      setStatus("processing");
      setProgress(0);

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

          // Real download bridge anchor to enforce system storage pipe writing
          const downloadUrl = URL.createObjectURL(data.blob);
          const downloadLink = document.createElement("a");
          downloadLink.href = downloadUrl;
          downloadLink.download = data.name;
          
          // Appending node safely to document DOM scope for programmatic click execution
          document.body.appendChild(downloadLink);
          downloadLink.click();
          
          // Garbage collection cleanup to avoid memory leaks on big files
          setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(downloadUrl);
          }, 150);

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

  // Circular Loader Geometry Calculations
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-full px-4 py-3 bg-background/95 border-b border-border/40 backdrop-blur-sm">
      {/* Idle Mode: Selection Layout Buttons */}
      {status === "idle" && (
        <div className="relative flex gap-2 w-full">
          <div className="relative flex-1">
            <button
              onClick={() => setShowResolutions(!showResolutions)}
              className="w-full flex items-center justify-between py-2.5 px-3.5 bg-secondary/70 text-foreground text-xs font-semibold rounded-xl border border-border/50 active:scale-95 transition-all"
            >
              <span className="flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" /> Low Quality Video
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${showResolutions ? "rotate-180" : ""}`} />
            </button>

            {/* Premium Absolute Options Popover Panel */}
            {showResolutions && (
              <div className="absolute left-0 right-0 bottom-12 z-50 bg-popover/95 border border-border rounded-xl shadow-2xl py-1 overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
                {resolutions.map((r) => (
                  <button
                    key={r.val}
                    onClick={() => startConversion("Video", r.val)}
                    className="w-full text-left px-4 py-2.5 text-xs text-foreground font-medium hover:bg-primary/10 active:bg-primary/20 border-b border-border/30 last:border-0 transition-colors"
                  >
                    Convert to <span className="text-primary font-bold">{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => startConversion("MP3")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-primary/10"
          >
            <Music className="h-4 w-4" /> Convert to MP3
          </button>
        </div>
      )}

      {/* Processing Mode: High Tech Circular Ring Gola Indicator */}
      {status === "processing" && (
        <div className="flex flex-col items-center justify-center py-3 bg-secondary/20 border border-border/30 rounded-2xl animate-in fade-in duration-200">
          <div className="relative flex items-center justify-center h-16 w-16">
            <svg className="absolute transform -rotate-90 w-full h-full">
              {/* Track Ring */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="text-muted-foreground/15"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Dynamic Progress Active Fill Ring */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="text-primary transition-all duration-150 ease-out"
                strokeWidth="3.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>
            <span className="text-xs font-black text-foreground">{progress}%</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-bold mt-2 tracking-wide uppercase">
            Processing {currentMode} {selectedRes && `• ${selectedRes}`}
          </p>
        </div>
      )}

      {/* Success View State: Clean Emerald Success Frame */}
      {status === "success" && (
        <div className="flex flex-col items-center justify-center py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center animate-in scale-in duration-200">
          <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center text-white mb-2 shadow-md shadow-emerald-500/20">
            <Check className="h-5 w-5 stroke-[3]" />
          </div>
          <h4 className="text-xs font-bold text-emerald-500">File Processed Successfully!</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5 px-6">Check your notification panel or system Downloads folder</p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-3 px-4 py-1.5 bg-background border border-border rounded-lg text-[10px] font-black text-foreground uppercase tracking-wider active:scale-95 transition-all"
          >
            Convert Another File
          </button>
        </div>
      )}

      {/* Error View State Handling Panel */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center py-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-center">
          <div className="h-8 w-8 rounded-full bg-destructive/20 flex items-center justify-center text-destructive mb-2">
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-destructive">Storage pipe writing aborted</p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-2.5 px-3 py-1 bg-destructive text-destructive-foreground font-bold rounded-lg text-[10px] uppercase active:scale-95"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
