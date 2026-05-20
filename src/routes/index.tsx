import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { CheckCircle2, Circle, FolderPlus, Share2, Trash2, X, Folder } from "lucide-react";
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
  const fileRef = useRef<HTMLInputElement>(null);

  // Naye feature ke liye states: Active tab aur selected folder tracking
  const [activeTab, setActiveTab] = useState<"all" | "folders">("all");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  // --- SCROLL POSITION FEATURE SHURU ---
  useEffect(() => {
    const savedScrollY = sessionStorage.getItem("homepage_scroll_pos");
    if (savedScrollY) {
      const timer = setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollY, 10));
        sessionStorage.removeItem("homepage_scroll_pos");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [videos, q, activeTab, currentFolder]);
  // --- SCROLL POSITION FEATURE KHATAM ---

  useEffect(() => {
    const triggerFirstScan = async () => {
      try {
        console.log("App mounted: Dispatching non-blocking storage bridge authorization...");
        await runNativeScan(true);
      } catch (err) {
        console.warn("Deferred permission bridge route bypass executed", err);
      }
    };
    
    const timer = setTimeout(() => {
      void triggerFirstScan();
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  // Videos filtering based on search query
  const filteredVideos = videos.filter((v) => v.title.toLowerCase().includes(q.toLowerCase()));

  // Folders logic: Video ke 'src' path se folder ka naam nikalna
  const foldersMap: Record<string, typeof videos> = {};
  filteredVideos.forEach((video) => {
    let folderName = "Internal Storage";
    if (video.src && video.src.includes("/")) {
      const parts = video.src.split("/");
      if (parts.length > 1) {
        // File name se theek pehle waale folder ka naam nikalna
        folderName = parts[parts.length - 2] || "Internal Storage";
      }
    }
    // Kuch common standard names ko clean format mein dikhane ke liye
    if (folderName.toLowerCase() === "0" || folderName === "") {
      folderName = "Main Storage";
    }
    if (!foldersMap[folderName]) {
      foldersMap[folderName] = [];
    }
    foldersMap[folderName].push(video);
  });

  // Final list jo screen par dikhegi (All videos, Folder view, ya Folder ke andar ki list)
  let contentLayout;

  if (activeTab === "all") {
    contentLayout = (
      <ul className="px-3 pt-3 space-y-2">
        {filteredVideos.map((v) => (
          <VideoRow
            key={v.id}
            video={v}
            selectMode={selectMode}
            selected={selected.has(v.id)}
            onOpen={() => {
              sessionStorage.setItem("homepage_scroll_pos", window.scrollY.toString());
              navigate({ to: "/video/$id", params: { id: v.id } });
            }}
            onToggle={() => toggle(v.id)}
            onLongPress={() => enterSelect(v.id)}
          />
        ))}
      </ul>
    );
  } else {
    // Folders Tab selected hai
    if (currentFolder) {
      // Kisi folder ke andar ki videos dikhana
      const folderVideos = foldersMap[currentFolder] || [];
      contentLayout = (
        <div className="space-y-2">
          <div className="px-4 py-2 flex items-center justify-between bg-secondary/30 border-b border-border/30">
            <span className="text-sm font-semibold text-primary truncate">Folder: {currentFolder}</span>
            <button 
              onClick={() => setCurrentFolder(null)}
              className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md font-medium"
            >
              Back to Folders
            </button>
          </div>
          <ul className="px-3 pt-1 space-y-2">
            {folderVideos.map((v) => (
              <VideoRow
                key={v.id}
                video={v}
                selectMode={selectMode}
                selected={selected.has(v.id)}
                onOpen={() => {
                  sessionStorage.setItem("homepage_scroll_pos", window.scrollY.toString());
                  navigate({ to: "/video/$id", params: { id: v.id } });
                }}
                onToggle={() => toggle(v.id)}
                onLongPress={() => enterSelect(v.id)}
              />
            ))}
          </ul>
        </div>
      );
    } else {
      // Saare folders ki beautiful grid/list list dikhana
      const folderNames = Object.keys(foldersMap);
      if (folderNames.length === 0) {
        contentLayout = (
          <div className="px-6 py-16 text-center text-muted-foreground text-sm">No folders found.</div>
        );
      } else {
        contentLayout = (
          <div className="px-4 pt-3 grid grid-cols-2 gap-3">
            {folderNames.map((name) => (
              <button
                key={name}
                onClick={() => setCurrentFolder(name)}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 active:bg-secondary/50 transition-all text-center gap-2"
              >
                <div className="relative p-3 bg-primary/10 rounded-xl text-primary">
                  <Folder className="h-8 w-8 fill-primary/20" />
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] px-1.5 min-w-[18px] h-4 flex items-center justify-center rounded-full font-bold">
                    {foldersMap[name].length}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground line-clamp-1 w-full px-1">
                  {name}
                </span>
              </button>
            ))}
          </div>
        );
      }
    }
  }

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const enterSelect = (id: string) => {
    setSelectMode(true);
    setSelected(new Set([id]));
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const onDelete = () => {
    if (selected.size === 0) return;
    if (confirm(`Delete ${selected.size} video(s)?`)) {
      deleteVideos([...selected]);
      exitSelect();
    }
  };

  const onShare = () => {
    const items = videos.filter((v) => selected.has(v.id)).map((v) => ({ title: v.title, src: v.src }));
    if (items.length === 0) return;
    shareItems(items);
  };

  const allSelected = filteredVideos.length > 0 && filteredVideos.every((v) => selected.has(v.id));

  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-20">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) importVideoFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="px-4 pt-5 pb-3 space-y-4 sticky top-0 bg-background/95 backdrop-blur z-30 border-b border-border/50">
        {selectMode ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={exitSelect} className="p-2 -ml-2" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
              <span className="text-base font-semibold">{selected.size} selected</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelected(allSelected ? new Set() : new Set(filteredVideos.map((v) => v.id)))}
                className="text-xs px-2 py-1 rounded-md bg-secondary"
              >
                {allSelected ? "Clear" : "All"}
              </button>
              <button onClick={onShare} className="p-2" aria-label="Share">
                <Share2 className="h-5 w-5" />
              </button>
              <button onClick={onDelete} className="p-2 text-destructive" aria-label="Delete">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-1 -mr-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="p-2 text-foreground/80"
                aria-label="Import from gallery"
              >
                <FolderPlus className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  const items = videos.map((v) => ({ title: v.title, src: v.src }));
                  shareItems(items.slice(0, 5));
                }}
                className="p-2 text-foreground/80"
                aria-label="Share"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSelectMode(true)}
                className="p-2 text-foreground/80"
                aria-label="Select"
              >
                <CheckCircle2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
        <SearchBar value={q} onChange={setQ} placeholder="Search videos..." />

        {/* --- DUB TAB SYSTEM DESIGN SHURU --- */}
        {!selectMode && (
          <div className="flex bg-secondary/40 p-1 rounded-xl w-full border border-border/30">
            <button
              onClick={() => {
                setActiveTab("all");
                setCurrentFolder(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center ${
                activeTab === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Videos
            </button>
            <button
              onClick={() => setActiveTab("folders")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center ${
                activeTab === "folders"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Folders
            </button>
          </div>
        )}
        {/* --- DUB TAB SYSTEM DESIGN KHATAM --- */}
      </div>

      {filteredVideos.length === 0 ? (
        <div className="px-6 py-16 text-center text-muted-foreground text-sm">
          No videos yet. Tap{" "}
          <FolderPlus className="inline h-4 w-4 align-text-bottom" /> to add from your gallery.
        </div>
      ) : (
        contentLayout
      )}

      <BottomTabs />
    </div>
  );
}

function VideoRow({
  video,
  selectMode,
  selected,
  onOpen,
  onToggle,
  onLongPress,
}: {
  video: { id: string; title: string; duration: string; thumb: string; src: string };
  selectMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const { didTrigger, ...pressHandlers } = useLongPress(onLongPress, 450);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(`history_${video.src}`);
    if (saved) {
      const parts = video.duration.split(':').map(Number);
      const totalSec = parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
      if (totalSec > 0) {
        const p = (parseFloat(saved) / totalSec) * 100;
        setProgress(Math.min(p, 100));
      }
    }
  }, [video.src, video.duration]);

  return (
    <li>
      <button
        {...pressHandlers}
        onClick={() => {
          if (didTrigger()) return;
          if (selectMode) onToggle();
          else onOpen();
        }}
        className={`w-full flex gap-3 items-center p-2 rounded-xl text-left transition-colors ${
          selected ? "bg-primary/15" : "active:bg-secondary"
        }`}
      >
        {selectMode && (
          <div className="flex-shrink-0">
            {selected ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        )}
        <div className="relative h-20 w-32 overflow-hidden rounded-lg border border-border/60 bg-secondary/70 flex-shrink-0">
          <img src={video.thumb} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
          {progress > 5 && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          )}
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
