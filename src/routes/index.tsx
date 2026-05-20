import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { CheckCircle2, Circle, FolderPlus, Share2, Trash2, X, History } from "lucide-react";
import { BottomTabs } from "@/components/BottomTabs";
import { SearchBar } from "@/components/SearchBar";
import { Logo } from "@/components/Logo";
import { useLongPress } from "@/hooks/use-long-press";
import { runNativeScan } from "@/lib/native-scanner";
import {
  useMediaStore,
  importVideoFiles,
  deleteVideos,
  shareItems,
} from "@/lib/media-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZabPlay — Videos" },
      { name: "description", content: "Play your videos and music with ZabPlay." },
    ],
  }),
  component: Index,
});

function Index() {
  const { videos } = useMediaStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load history from localStorage
    const savedHistory = videos.filter(v => localStorage.getItem(`history_${v.src}`));
    setHistory(savedHistory);

    const triggerFirstScan = async () => {
      try {
        await runNativeScan(true);
      } catch (err) {
        console.warn(err);
      }
    };
    const timer = setTimeout(() => void triggerFirstScan(), 150);
    return () => clearTimeout(timer);
  }, [videos]);

  const list = videos.filter((v) => v.title.toLowerCase().includes(q.toLowerCase()));

  const clearHistory = () => {
    if (confirm("Clear all watch history?")) {
      videos.forEach(v => localStorage.removeItem(`history_${v.src}`));
      setHistory([]);
    }
  };

  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-20">
      <input ref={fileRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => { if (e.target.files) importVideoFiles(e.target.files); e.target.value = ""; }} />

      <div className="px-4 pt-5 pb-3 sticky top-0 bg-background/95 backdrop-blur z-30 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <Logo />
          <button onClick={() => fileRef.current?.click()} className="p-2 text-foreground/80"><FolderPlus className="h-5 w-5" /></button>
        </div>
        <SearchBar value={q} onChange={setQ} placeholder="Search videos..." />
      </div>

      {/* Watch History Section */}
      {history.length > 0 && !q && (
        <div className="mt-4 px-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-bold flex items-center gap-2"><History className="h-4 w-4" /> Watch History</h2>
            <button onClick={clearHistory} className="text-xs text-destructive">Clear</button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
            {history.map((v) => (
              <button key={v.id} onClick={() => navigate({ to: "/video/$id", params: { id: v.id } })} className="flex-shrink-0 w-32 snap-start">
                <div className="h-20 w-32 rounded-lg overflow-hidden bg-secondary">
                  <img src={v.thumb} className="h-full w-full object-cover" />
                </div>
                <p className="text-[10px] truncate mt-1">{v.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="px-3 pt-3 space-y-2">
        {list.map((v) => (
          <VideoRow key={v.id} video={v} onOpen={() => navigate({ to: "/video/$id", params: { id: v.id } })} />
        ))}
      </ul>

      <BottomTabs />
    </div>
  );
}

function VideoRow({ video, onOpen }: { video: any; onOpen: () => void }) {
  return (
    <li>
      <button onClick={onOpen} className="w-full flex gap-3 items-center p-2 rounded-xl text-left active:bg-secondary">
        <div className="relative h-20 w-32 overflow-hidden rounded-lg bg-secondary flex-shrink-0">
          <img src={video.thumb} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-1 px-2 py-1 text-right">
            <span className="text-[10px] text-white font-medium bg-black/50 px-1 rounded">{video.duration}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground line-clamp-2 font-medium">{video.title}</p>
        </div>
      </button>
    </li>
  );
}

