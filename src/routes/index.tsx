import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  FolderPlus,
  Share2,
  Trash2,
  X,
  Folder,
  History,
  Search,
  MoreVertical,
  Square,
  CheckSquare,
  Lock,
  ArrowRightLeft,
  Scissors,
  Edit3
} from "lucide-react";
import { BottomTabs } from "@/components/BottomTabs";
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

type HistoryItem = {
  id: string;
  title: string;
  thumb: string;
  duration: string;
  progress: number;
  lastPlayed: number;
};

function Index() {
  const { videos } = useMediaStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false); // Search input toggle karne ke liye state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"all" | "folders">("all");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  
  const [watchingHistory, setWatchingHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const loadHistory = () => {
      try {
        const raw = localStorage.getItem("zabplay_watching_history");
        if (raw) {
          const parsed: HistoryItem[] = JSON.parse(raw);
          const validHistory = parsed.filter(h => videos.some(v => v.id === h.id));
          validHistory.sort((a, b) => b.lastPlayed - a.lastPlayed);
          setWatchingHistory(validHistory);
        }
      } catch (e) {
        console.error("Error loading history:", e);
      }
    };

    loadHistory();
  }, [videos, activeTab]);

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

  const filteredVideos = videos.filter((v) => v.title.toLowerCase().includes(q.toLowerCase()));

  const foldersMap: Record<string, typeof videos> = {};
  filteredVideos.forEach((video) => {
    let folderName = "Internal Storage";
    if (video.src && video.src.includes("/")) {
      const parts = video.src.split("/");
      if (parts.length > 1) {
        folderName = parts[parts.length - 2] || "Internal Storage";
      }
    }
    if (folderName.toLowerCase() === "0" || folderName === "") {
      folderName = "Main Storage";
    }
    if (!foldersMap[folderName]) {
      foldersMap[folderName] = [];
    }
    foldersMap[folderName].push(video);
  });

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
    if (currentFolder) {
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
                onClick={() => {
                  if (selectMode) return; // Select mode mein folder khulega nahi
                  setCurrentFolder(name);
                }}
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

  // Naye feature placeholders (Aapke bataye mutabik icons ke functions)
  const onPrivacySecure = () => {
    if (selected.size === 0) return;
    alert(`Moving ${selected.size} video(s) to Privacy Folder Securely.`);
    exitSelect();
  };

  const onFileTransfer = () => {
    if (selected.size === 0) return;
    alert(`Transferring ${selected.size} video file(s)...`);
    exitSelect();
  };

  const onVideoCut = () => {
    if (selected.size === 0) return;
    alert("Opening Video Cutter tool for selected file.");
    exitSelect();
  };

  const onRename = () => {
    if (selected.size === 0) return;
    alert("Opening Rename dialog for the selected video.");
    exitSelect();
  };

  const currentTabVideos = activeTab === "all" 
    ? filteredVideos 
    : (currentFolder ? foldersMap[currentFolder] || [] : filteredVideos);

  const allSelected = currentTabVideos.length > 0 && currentTabVideos.every((v) => selected.has(v.id));

  const handleSelectAllToggle = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(currentTabVideos.map((v) => v.id)));
    }
  };

  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-32">
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

      {/* --- STICKY TOP HEADER ZONE --- */}
      <div className="px-4 pt-5 pb-3 space-y-4 sticky top-0 bg-background/95 backdrop-blur z-30 border-b border-border/50">
        {selectMode ? (
          /* 👑 SELECT MODE ACTIVATED HEADER (Aapke photo aur description ke mutabik box aur numbers) */
          <div className="flex items-center justify-between h-10 animate-fadeIn">
            <div className="flex items-center gap-3">
              <button onClick={handleSelectAllToggle} className="text-primary active:scale-90 transition-transform" aria-label="Select All Toggle">
                {allSelected ? (
                  <CheckSquare className="h-6 w-6 fill-primary/10" />
                ) : (
                  <Square className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <span className="text-base font-semibold text-foreground">
                {selected.size} / {currentTabVideos.length} Selected
              </span>
            </div>
            <button onClick={exitSelect} className="p-2 rounded-full bg-secondary/50 text-foreground active:scale-90 transition-transform">
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          /* 👑 NORMAL MODE HEADER (Chhota Search Bar, Custom Layout Icons aur Three-Dots Menu) */
          <div className="space-y-3">
            <div className="flex items-center justify-between h-10">
              <Logo />
              <div className="flex items-center gap-1">
                {/* Search icon trigger button */}
                <button
                  onClick={() => setShowSearchInput(!showSearchInput)}
                  className={`p-2 rounded-full transition-colors ${showSearchInput ? "bg-primary/20 text-primary" : "text-foreground/80 active:bg-secondary"}`}
                  aria-label="Toggle search input"
                >
                  <Search className="h-5 w-5" />
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="p-2 text-foreground/80 active:bg-secondary rounded-full"
                  aria-label="Import from gallery"
                >
                  <FolderPlus className="h-5 w-5" />
                </button>
                {/* Stylish Design ke liye custom Three-Dots (Teen Lambe Dot) Menu */}
                <button
                  onClick={() => alert("Settings & Sorting Options Menu")}
                  className="p-2 text-foreground/80 active:bg-secondary rounded-full ml-0.5"
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5 text-foreground/90 font-bold" />
                </button>
              </div>
            </div>

            {/* Chhota input box jo icon click karne par hi khulega */}
            {showSearchInput && (
              <div className="relative animate-slideDown w-full">
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search videos..."
                  className="w-full bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground pl-4 pr-10 py-2 rounded-xl border border-border/40 focus:outline-none focus:border-primary/50 transition-all"
                  autoFocus
                />
                {q && (
                  <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TAB SYSTEM SYSTEM DESIGN --- */}
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
      </div>

      {/* --- WATCHING HISTORY HORIZONTAL SLIDER BLOCK --- */}
      {!selectMode && watchingHistory.length > 0 && !currentFolder && (
        <div className="mt-2 mb-4 border-b border-border/20 pb-4">
          <div className="px-4 mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <History className="h-3.5 w-3.5 text-primary" />
            <span>Watching History</span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 scrollbar-none snap-x">
            {watchingHistory.map((item) => (
              <button
                key={`hist-${item.id}`}
                onClick={() => {
                  sessionStorage.setItem("homepage_scroll_pos", window.scrollY.toString());
                  navigate({ to: "/video/$id", params: { id: item.id } });
                }}
                className="w-32 flex-shrink-0 text-left snap-start space-y-1.5 group active:opacity-70 transition-opacity"
              >
                <div className="relative h-20 w-32 overflow-hidden rounded-lg border border-border/50 bg-secondary/60">
                  <img
                    src={item.thumb}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-black/40">
                    <div 
                      className="h-full bg-red-500 transition-all duration-300" 
                      style={{ width: `${item.progress}%` }} 
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-1.5 px-2 py-0.5 text-right">
                    <span className="text-[9px] text-white font-medium bg-black/60 px-1 rounded">
                      {item.duration}
                    </span>
                  </div>
                </div>
                <p className="text-xs font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {item.title}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- MAIN CONTENT DISPLAY AREA --- */}
      {filteredVideos.length === 0 ? (
        <div className="px-6 py-16 text-center text-muted-foreground text-sm">
          No videos yet. Tap{" "}
          <FolderPlus className="inline h-4 w-4 align-text-bottom" /> to add from your gallery.
        </div>
      ) : (
        contentLayout
      )}

      {/* 👑 BOTTOM ACTION BAR PATTI (Long Press Selection Mode par auto-pop hoga niche se) */}
      {selectMode && (
        <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md bg-background/95 border-t border-border/60 backdrop-blur-md shadow-2xl z-50 animate-slideUp">
          <div className="flex items-center justify-around py-3 px-2">
            
            {/* 1. Share Icon */}
            <button onClick={onShare} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-primary disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Share2 className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Share</span>
            </button>

            {/* 2. Privacy Folder Lock Icon */}
            <button onClick={onPrivacySecure} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-primary disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Lock className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Privacy</span>
            </button>

            {/* 3. Delete Icon */}
            <button onClick={onDelete} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-destructive disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Trash2 className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Delete</span>
            </button>

            {/* 4. File Transfer Icon */}
            <button onClick={onFileTransfer} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-primary disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <ArrowRightLeft className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Transfer</span>
            </button>

            {/* 5. Video Cut/Trim Icon */}
            <button onClick={onVideoCut} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-primary disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Scissors className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Cut Video</span>
            </button>

            {/* 6. Rename Icon */}
            <button onClick={onRename} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-primary disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Edit3 className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Rename</span>
            </button>

          </div>
        </div>
      )}

      {/* Normal tabs ko select mode mein chipa denge taaki niche ki patti clean dikhe */}
      {!selectMode && <BottomTabs />}
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
    try {
      const raw = localStorage.getItem("zabplay_watching_history");
      if (raw) {
        const parsed: HistoryItem[] = JSON.parse(raw);
        const currentItem = parsed.find(h => h.id === video.id);
        if (currentItem) {
          setProgress(currentItem.progress);
        }
      }
    } catch {
      const saved = localStorage.getItem(`history_${video.src}`);
      if (saved) {
        const parts = video.duration.split(':').map(Number);
        const totalSec = parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
        if (totalSec > 0) {
          const p = (parseFloat(saved) / totalSec) * 100;
          setProgress(Math.min(p, 100));
        }
      }
    }
  }, [video.id, video.src, video.duration]);

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
        <div className="relative h-20 w-32 overflow-hidden rounded-lg border border-border/60 bg-secondary/70 flex-shrink-0">
          <img src={video.thumb} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
          
          {/* Real-time multi-select state overlay checkbox inside image block */}
          {selectMode && (
            <div className="absolute top-1.5 left-1.5 bg-black/40 rounded-full p-0.5 backdrop-blur-sm z-10">
              {selected ? (
                <CheckCircle2 className="h-4 w-4 text-primary fill-background" />
              ) : (
                <Circle className="h-4 w-4 text-white/80" />
              )}
            </div>
          )}

          {progress > 2 && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
              <div className="h-full bg-red-500" style={{ width: `${progress}%` }} />
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

