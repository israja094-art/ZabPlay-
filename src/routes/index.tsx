import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
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
  Edit3,
  HardDrive,
  Music,
  Settings2
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
  renameVideoFile,
  moveVideosToPrivacy,
  getPrivacyVideos,
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
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [activeCardMenuId, setActiveCardMenuId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"all" | "folders">("all");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  
  const [watchingHistory, setWatchingHistory] = useState<HistoryItem[]>([]);

  // --- POPUPS & DIALOGS REAL STATES ---
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [newTitleValue, setNewTitleValue] = useState("");
  
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyVideosList, setPrivacyVideosList] = useState<any[]>([]);

  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // --- 🔐 SECURITY PASSWORD SYSTEM STATES ---
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState<"setup" | "unlock_hide" | "unlock_view">("setup");
  const [inputPin, setInputPin] = useState("");
  const [savedPin, setSavedPin] = useState<string | null>(null);
  
  const pinInputRef = useRef<HTMLInputElement>(null);

  // 1. ऑटोमेटिकली मेनू बंद करें जब यूजर स्क्रीन स्क्रॉल करे
  useEffect(() => {
    const handleScrollClose = () => {
      setShowMenuDropdown(false);
      setActiveCardMenuId(null);
    };

    window.addEventListener("scroll", handleScrollClose, true);
    return () => window.removeEventListener("scroll", handleScrollClose, true);
  }, []);

  useEffect(() => {
    const pin = localStorage.getItem("zabplay_privacy_pin");
    if (pin) {
      setSavedPin(pin);
    }
  }, []);

  useEffect(() => {
    if (showPinModal) {
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 150);
    }
  }, [showPinModal]);

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

  useEffect(() => {
    if (!showMenuDropdown) return;
    const closeMenu = () => setShowMenuDropdown(false);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [showMenuDropdown]);

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
      <ul className="grid grid-cols-2 gap-3 px-3 pt-3">
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
            activeCardMenuId={activeCardMenuId}
            setActiveCardMenuId={setActiveCardMenuId}
          />
        ))}
      </ul>
    );
  } else {
    if (currentFolder) {
      const folderVideos = foldersMap[currentFolder] || [];
      contentLayout = (
        <div className="space-y-2">
          <div className="px-4 py-2 flex items-center justify-between bg-zinc-900 border-b border-zinc-800">
            <span className="text-sm font-semibold text-blue-400 truncate">Folder: {currentFolder}</span>
            <button 
              onClick={() => setCurrentFolder(null)}
              className="text-xs bg-zinc-850 text-blue-400 px-2 py-1 rounded-md font-medium border border-zinc-700 active:bg-zinc-800"
            >
              Back to Folders
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-3 px-3 pt-1">
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
                activeCardMenuId={activeCardMenuId}
                setActiveCardMenuId={setActiveCardMenuId}
              />
            ))}
          </ul>
        </div>
      );
    } else {
      const folderNames = Object.keys(foldersMap);
      if (folderNames.length === 0) {
        contentLayout = (
          <div className="px-6 py-16 text-center text-zinc-500 text-sm">No folders found.</div>
        );
      } else {
        contentLayout = (
          <div className="px-4 pt-3 grid grid-cols-2 gap-3">
            {folderNames.map((name) => (
              <button
                key={name}
                onClick={() => {
                  if (selectMode) return;
                  setCurrentFolder(name);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-zinc-900 bg-zinc-950 active:bg-zinc-900 transition-all text-center gap-2"
              >
                <div className="relative p-3 bg-zinc-900 rounded-xl text-blue-400">
                  <Folder className="h-8 w-8 fill-blue-500/10 text-blue-400" />
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] px-1.5 min-w-[18px] h-4 flex items-center justify-center rounded-full font-bold">
                    {foldersMap[name].length}
                  </span>
                </div>
                <span className="text-sm font-medium text-blue-400 line-clamp-1 w-full px-1">
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

  const onDelete = async () => {
    if (selected.size === 0) return;
    await deleteVideos([...selected]);
    exitSelect();
  };

  const onShare = () => {
    const items = videos
      .filter((v) => selected.has(v.id))
      .map((v) => ({ id: v.id, title: v.title, src: v.src }));
    if (items.length === 0) return;
    shareItems(items);
    exitSelect();
  };

  const onPrivacySecure = () => {
    if (selected.size === 0) return;
    setInputPin("");
    if (!savedPin) {
      setPinMode("setup");
    } else {
      setPinMode("unlock_hide");
    }
    setShowPinModal(true);
  };

  const executePrivacyLock = () => {
    moveVideosToPrivacy([...selected]);
    alert(`${selected.size} Video(s) successfully locked in Privacy Folder!`);
    exitSelect();
  };

  const onRename = () => {
    if (selected.size === 0) return;
    const firstId = Array.from(selected)[0];
    const itemToRename = videos.find(v => v.id === firstId);
    if (itemToRename) {
      setRenameTargetId(firstId);
      setNewTitleValue(itemToRename.title);
      setShowRenameModal(true);
    }
  };

  const saveRenameAction = async () => {
    if (renameTargetId && newTitleValue.trim()) {
      await renameVideoFile(renameTargetId, newTitleValue.trim());
      setShowRenameModal(false);
      exitSelect();
    }
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

  const handleDropdownAction = async (actionName: string) => {
    if (actionName === "Settings") {
      alert(`Opening feature: ${actionName}`);
    } else if (actionName === "File Transfer") {
      alert(`Opening feature: ${actionName}`);
    } else if (actionName === "MP3 Converter") {
      alert(`Opening feature: ${actionName}`);
    } else if (actionName === "Storage Info") {
      setShowStorageModal(true);
    } else if (actionName === "History") {
      setShowHistoryModal(true);
    } else if (actionName === "Privacy Folder") {
      setInputPin("");
      if (!savedPin) {
        setPinMode("setup");
      } else {
        setPinMode("unlock_view");
      }
      setShowPinModal(true);
    }
  };

  const handlePinSubmit = () => {
    if (inputPin.length !== 4) {
      alert("Please enter a valid 4-digit PIN.");
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (pinMode === "setup") {
      localStorage.setItem("zabplay_privacy_pin", inputPin);
      setSavedPin(inputPin);
      setShowPinModal(false);
      setTimeout(() => {
        alert("Privacy PIN successfully set!");
      }, 100);

    } else if (pinMode === "unlock_hide") {
      if (inputPin === savedPin) {
        setShowPinModal(false);
        setTimeout(() => {
          executePrivacyLock();
        }, 150);
      } else {
        alert("Incorrect PIN! Please try again.");
        setInputPin("");
        setTimeout(() => pinInputRef.current?.focus(), 100);
      }

    } else if (pinMode === "unlock_view") {
      if (inputPin === savedPin) {
        setShowPinModal(false);
        setTimeout(async () => {
          try {
            const data = await getPrivacyVideos();
            setPrivacyVideosList(data || []);
            setShowPrivacyModal(true);
          } catch (err) {
            console.error("Native storage read crash protected:", err);
            setPrivacyVideosList([]);
            setShowPrivacyModal(true);
          }
        }, 150);
      } else {
        alert("Incorrect PIN! Please try again.");
        setInputPin("");
        setTimeout(() => pinInputRef.current?.focus(), 100);
      }
    }
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

  const isAnyMenuOpen = showMenuDropdown || activeCardMenuId !== null;

  return (
    <div className="min-h-screen bg-black mx-auto max-w-md pb-32 relative">
      {/* स्क्रीन लॉक और बैकड्रॉप ओवरले */}
      {isAnyMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-transparent cursor-default"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenuDropdown(false);
            setActiveCardMenuId(null);
          }}
        />
      )}

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

      {/* --- STICKY TOP HEADER ZONE (SOLID BLACK BACKGROUND FOR OVERLAP FIX) --- */}
      <div className="px-4 pt-5 pb-3 space-y-4 sticky top-0 bg-black z-50 border-b border-zinc-900">
        {selectMode ? (
          <div className="flex items-center justify-between h-10 animate-fadeIn">
            <div className="flex items-center gap-3">
              <button onClick={handleSelectAllToggle} className="text-white active:scale-90 transition-transform" aria-label="Select All Toggle">
                {allSelected ? (
                  <CheckSquare className="h-6 w-6 fill-white/10" />
                ) : (
                  <Square className="h-6 w-6 text-zinc-500" />
                )}
              </button>
              <span className="text-base font-semibold text-white">
                {selected.size} / {currentTabVideos.length} Selected
              </span>
            </div>
            <button onClick={exitSelect} className="p-2 rounded-full bg-zinc-900 text-white active:scale-90 transition-transform">
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between h-10">
              <Logo />
              <div className="flex items-center gap-1 relative z-50">
                <button
                  onClick={() => setShowSearchInput(!showSearchInput)}
                  className={`p-2 rounded-full transition-colors ${showSearchInput ? "bg-zinc-800 text-white" : "text-white/80 active:bg-zinc-900"}`}
                  aria-label="Toggle search input"
                >
                  <Search className="h-5 w-5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenuDropdown(!showMenuDropdown);
                    setActiveCardMenuId(null);
                  }}
                  className={`p-2 rounded-full transition-colors ${showMenuDropdown ? "bg-zinc-800 text-white" : "text-white/80 active:bg-zinc-900"}`}
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5 font-bold scale-y-110" />
                </button>

                {showMenuDropdown && (
                  <div className="absolute right-0 top-12 w-52 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl z-50 py-2 animate-scaleUp backdrop-blur-md">
                    <button onClick={() => handleDropdownAction("File Transfer")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 active:bg-zinc-900 transition-colors text-left">
                      <ArrowRightLeft className="h-4 w-4 text-white -rotate-90" />
                      <span className="font-medium">File Transfer</span>
                    </button>
                    <button onClick={() => handleDropdownAction("Storage Info")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 active:bg-zinc-900 transition-colors text-left">
                      <HardDrive className="h-4 w-4 text-white" />
                      <span className="font-medium">Storage Info</span>
                    </button>
                    <button onClick={() => handleDropdownAction("Privacy Folder")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 active:bg-zinc-900 transition-colors text-left">
                      <Lock className="h-4 w-4 text-white" />
                      <span className="font-medium">Privacy Folder</span>
                    </button>
                    <button onClick={() => handleDropdownAction("History")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 active:bg-zinc-900 transition-colors text-left">
                      <History className="h-4 w-4 text-white" />
                      <span className="font-medium">History</span>
                    </button>
                    <button onClick={() => handleDropdownAction("MP3 Converter")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 active:bg-zinc-900 transition-colors text-left">
                      <Music className="h-4 w-4 text-white" />
                      <span className="font-medium">MP3 Converter</span>
                    </button>
                    <button onClick={() => handleDropdownAction("Settings")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 active:bg-zinc-900 transition-colors text-left border-t border-zinc-800 mt-1 pt-2">
                      <Settings2 className="h-4 w-4 text-white" />
                      <span className="font-medium">Settings</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {showSearchInput && (
              <div className="relative animate-slideDown w-full">
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search videos..."
                  className="w-full bg-zinc-900 text-sm text-white placeholder:text-zinc-500 pl-4 pr-10 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-zinc-700 transition-all"
                  autoFocus
                />
                {q && (
                  <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TAB SYSTEM DESIGN --- */}
        {!selectMode && (
          <div className="flex bg-zinc-900 p-1 rounded-xl w-full border border-zinc-800">
            <button
              onClick={() => {
                setActiveTab("all");
                setCurrentFolder(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center ${
                activeTab === "all"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              All Videos
            </button>
            <button
              onClick={() => setActiveTab("folders")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center ${
                activeTab === "folders"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Folders
            </button>
          </div>
        )}
      </div>

      {/* --- WATCHING HISTORY HORIZONTAL SLIDER BLOCK --- */}
      {!selectMode && watchingHistory.length > 0 && !currentFolder && (
        <div className="mt-2 mb-4 border-b border-zinc-900 pb-4">
          <div className="px-4 mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-white">
            <History className="h-4 w-4 text-white" />
            <span>Watching History</span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 scrollbar-none snap-x">
            {watchingHistory.map((item) => (
              <button
                key={`hist-${item.id}`}
                onClick={() => {
                  if (isAnyMenuOpen) return;
                  sessionStorage.setItem("homepage_scroll_pos", window.scrollY.toString());
                  navigate({ to: "/video/$id", params: { id: item.id } });
                }}
                className="w-40 flex-shrink-0 text-left snap-start space-y-1.5 group active:opacity-70 transition-opacity"
              >
                <div className="relative h-24 w-40 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                  <img src={item.thumb} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-black/40">
                    <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${item.progress}%` }} />
                  </div>
                  <div className="absolute inset-x-0 bottom-1.5 px-2 py-0.5 text-right">
                    <span className="text-[9px] text-white font-medium bg-black/60 px-1 rounded">{item.duration}</span>
                  </div>
                </div>
                <p className="text-xs font-medium text-white line-clamp-1 group-hover:text-zinc-300 transition-colors">{item.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- MAIN CONTENT DISPLAY AREA --- */}
      {filteredVideos.length === 0 ? (
        <div className="px-6 py-16 text-center text-zinc-500 text-sm">
          No videos yet. Drop videos into your storage to start playing.
        </div>
      ) : (
        contentLayout
      )}

      {/* --- 🔐 PRIVACY PIN SETUP & UNLOCK ENGINE --- */}
      {showPinModal && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[99999] pointer-events-auto"
          onClick={() => pinInputRef.current?.focus()}
        >
          <div 
            className="bg-zinc-950 w-[290px] rounded-[24px] p-6 border border-zinc-800 shadow-2xl text-center relative space-y-5 pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              pinInputRef.current?.focus();
            }}
          >
            <div className="w-12 h-12 rounded-full bg-zinc-900 text-white flex items-center justify-center mx-auto border border-zinc-800">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {pinMode === "setup" ? "Set Privacy Password" : "Enter Privacy PIN"}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 px-2">
                {pinMode === "setup" 
                  ? "Create a 4-digit PIN to secure your hidden videos" 
                  : "Please enter verification code to continue"}
              </p>
            </div>
            
            <div className="relative w-full max-w-[210px] mx-auto h-12 mt-2 pointer-events-auto">
              <input 
                ref={pinInputRef}
                type="text" 
                maxLength={4}
                pattern="[0-9]*"
                inputMode="numeric"
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ""))}
                className="absolute inset-0 w-full h-full opacity-0 z-50 cursor-pointer text-center pointer-events-auto"
                autoFocus
              />

              <div className="absolute inset-0 flex justify-between items-center gap-3 z-10 pointer-events-none">
                {[0, 1, 2, 3].map((index) => {
                  const isFocused = inputPin.length === index;
                  const hasValue = inputPin.length > index;
                  return (
                    <div 
                      key={index} 
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                        isFocused 
                          ? "border-white bg-zinc-900 scale-105" 
                          : "border-zinc-800 bg-zinc-900/40"
                      }`}
                    >
                      {hasValue ? (
                        <span className="text-white text-sm font-bold">{inputPin[index]}</span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 text-xs font-semibold pt-2 relative z-[99999] pointer-events-auto">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPinModal(false);
                }} 
                className="flex-1 py-3 rounded-xl bg-zinc-900 text-white/90 active:bg-zinc-800 transition-colors cursor-pointer pointer-events-auto border border-zinc-800"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePinSubmit();
                }} 
                disabled={inputPin.length !== 4}
                className="flex-1 py-3 rounded-xl bg-white text-black disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-transform font-bold cursor-pointer pointer-events-auto"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FIXED REAL MODAL: RENAME POPUP ENGINE --- */}
      {showRenameModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[99999] pointer-events-auto animate-fadeIn"
          onClick={() => setShowRenameModal(false)}
        >
          <div 
            className="bg-zinc-950 w-full max-w-xs rounded-2xl p-6 border border-zinc-800 shadow-2xl space-y-4 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-white">Rename Video</h3>
            <input 
              type="text" 
              value={newTitleValue}
              onChange={(e) => setNewTitleValue(e.target.value)}
              className="w-full bg-zinc-900 px-3 py-2 text-sm rounded-xl border border-zinc-800 focus:outline-none focus:border-zinc-700 text-white"
              autoFocus
            />
            <div className="flex gap-3 justify-end text-xs font-semibold">
              <button 
                onClick={() => setShowRenameModal(false)} 
                className="px-4 py-2 rounded-xl bg-zinc-900 text-white border border-zinc-800 active:scale-95"
              >
                Cancel
              </button>
              <button 
                onClick={saveRenameAction} 
                className="px-4 py-2 rounded-xl bg-white text-black active:scale-95"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- REAL MODAL: PRIVACY FOLDER VIEWER --- */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black flex flex-col z-50 p-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-3">
            <div className="flex items-center gap-2 font-bold text-white">
              <Lock className="h-5 w-5" />
              <span>Secure Privacy Storage</span>
            </div>
            <button onClick={() => setShowPrivacyModal(false)} className="p-1 rounded-full bg-zinc-900 text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {privacyVideosList.length === 0 ? (
              <p className="text-center text-xs text-zinc-500 mt-10">No videos inside secure privacy folder.</p>
            ) : (
              privacyVideosList.map(v => (
                <div key={`priv-${v.id}`} className="flex items-center gap-3 p-2 bg-zinc-900/50 rounded-xl border border-zinc-900">
                  <img src={v.thumb} className="h-12 w-20 object-cover rounded-lg" />
                  <span className="text-xs font-medium truncate flex-1 text-white">{v.title}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- REAL MODAL: STORAGE INFO VIEW --- */}
      {showStorageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 w-full max-w-xs rounded-2xl p-4 border border-zinc-800 shadow-2xl space-y-4 text-center">
            <HardDrive className="h-8 w-8 text-white mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-white">Storage Analyzer</h3>
              <p className="text-xs text-zinc-500 mt-1">ZabPlay Local Database Sync Status</p>
            </div>
            <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden">
              <div className="bg-white h-full w-[45%]" />
            </div>
            <p className="text-[11px] font-semibold text-white/80">IndexedDB: {videos.length} Registered System Tracks</p>
            <button onClick={() => setShowStorageModal(false)} className="w-full py-2 text-xs font-semibold bg-zinc-900 text-white border border-zinc-800 rounded-xl">Close</button>
          </div>
        </div>
      )}

      {/* --- REAL MODAL: ALL HISTORY LIST VIEWER --- */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black flex flex-col z-50 p-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-3">
            <div className="flex items-center gap-2 font-bold text-white">
              <History className="h-5 w-5" />
              <span>Full Watching History ({watchingHistory.length})</span>
            </div>
            <button onClick={() => setShowHistoryModal(false)} className="p-1 rounded-full bg-zinc-900 text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {watchingHistory.length === 0 ? (
              <p className="text-center text-xs text-zinc-500 mt-10">No history found.</p>
            ) : (
              watchingHistory.map(h => (
                <div key={`fullhist-${h.id}`} className="flex items-center gap-3 p-2 bg-zinc-900/50 rounded-xl border border-zinc-900">
                  <img src={h.thumb} className="h-12 w-20 object-cover rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-white">{h.title}</p>
                    <p className="text-[10px] text-red-500 font-bold mt-0.5">Watched {h.progress.toFixed(0)}%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* BOTTOM ACTION BAR PATTI (DARK BLUE COLOR APPLIED TO MATCH THE APP HEAD BRAND) */}
      {selectMode && (
        <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md bg-[#002fff] border-t border-blue-900 backdrop-blur-md shadow-2xl z-50 animate-slideUp">
          <div className="flex items-center justify-around py-3 px-2">
            <button onClick={onShare} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-white disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Share2 className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-white/90">Share</span>
            </button>
            <button onClick={onPrivacySecure} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-white disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Lock className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-white/90">Privacy</span>
            </button>
            <button onClick={onDelete} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-red-200 disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Trash2 className="h-5 w-5 mb-1 text-red-200" />
              <span className="text-[10px] font-medium text-white/90">Delete</span>
            </button>
            <button onClick={onFileTransfer} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-white disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <ArrowRightLeft className="h-5 w-5 mb-1 -rotate-90" />
              <span className="text-[10px] font-medium text-white/90">Transfer</span>
            </button>
            <button onClick={onVideoCut} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-white disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Scissors className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-white/90">Cut Video</span>
            </button>
            <button onClick={onRename} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-white disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Edit3 className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-white/90">Rename</span>
            </button>
          </div>
        </div>
      )}

      {/* --- SOLID BLACK BOTTOM NAV WITH CENTER ROUNDED GREEN FILE TRANSFER BUTTON --- */}
      {!selectMode && (
        <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md bg-black border-t border-zinc-900 z-50 h-16 flex items-center justify-between px-6">
          <BottomTabs />
          
          {/* Center Floating Green File Transfer Icon (Icon straightened, made bigger & elevated upwards) */}
          <div className="absolute left-1/2 bottom-5 -translate-x-1/2 z-50">
            <button 
              onClick={() => handleDropdownAction("File Transfer")}
              className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-green-900/40 border border-green-500/30 transition-all"
              aria-label="File Transfer"
            >
              <ArrowRightLeft className="h-6 w-6 stroke-[2.5] -rotate-90" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoRow({
  video,
  selectMode,
  selected,
  onOpen,
  onToggle,
  activeCardMenuId,
  setActiveCardMenuId,
}: {
  video: { id: string; title: string; duration: string; thumb: string; src: string };
  selectMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onLongPress: () => void;
  activeCardMenuId: string | null;
  setActiveCardMenuId: (id: string | null) => void;
}) {
  const { didTrigger, ...pressHandlers } = useLongPress(() => {}, 450);
  const [progress, setProgress] = useState(0);
  const showCardMenu = activeCardMenuId === video.id;

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

  const handleCardAction = (action: "share" | "transfer" | "privacy") => {
    setActiveCardMenuId(null);
    if (action === "share") {
      shareItems([{ id: video.id, title: video.title, src: video.src }]);
    } else if (action === "transfer") {
      alert(`Transferring file: ${video.title}`);
    } else if (action === "privacy") {
      const pin = localStorage.getItem("zabplay_privacy_pin");
      if (!pin) {
        alert("Please set up your Privacy Folder PIN from the main top menu first.");
      } else {
        moveVideosToPrivacy([video.id]);
        alert(`Video successfully locked in Privacy Folder!`);
      }
    }
  };

  return (
    <li className="relative">
      <button
        {...pressHandlers}
        onClick={() => {
          if (didTrigger()) return;
          if (selectMode) onToggle();
          else onOpen();
        }}
        className={`w-full flex flex-col gap-2 p-2 rounded-xl text-left transition-colors ${
          selected ? "bg-zinc-900" : "active:bg-zinc-900"
        }`}
      >
        {/* Thumbnail Layer */}
        <div className="relative h-28 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 flex-shrink-0">
          <img src={video.thumb} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
          {selectMode && (
            <div className="absolute top-1.5 left-1.5 bg-black/60 rounded-full p-0.5 backdrop-blur-sm z-10">
              {selected ? (
                <CheckCircle2 className="h-4 w-4 text-white fill-black" />
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
        
        {/* Title Layer with Inline Three-Dots Option Menu */}
        <div className="w-full px-1 flex items-start justify-between gap-1">
          <p className="text-xs text-white line-clamp-1 font-medium flex-1">{video.title}</p>
          {!selectMode && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setActiveCardMenuId(showCardMenu ? null : video.id);
              }}
              className="p-1 -mt-1 -mr-1 rounded-full text-white active:bg-zinc-800 cursor-pointer z-50"
            >
              <MoreVertical className="h-3.5 w-3.5 text-white" />
            </div>
          )}
        </div>
      </button>

      {/* --- IN-CARD ACTIONS DROPDOWN OVERLAY --- */}
      {showCardMenu && (
        <div 
          className="absolute right-2 bottom-12 w-36 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-50 py-1 animate-scaleUp"
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => handleCardAction("share")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white active:bg-zinc-900 transition-colors text-left"
          >
            <Share2 className="h-3.5 w-3.5 text-blue-500" />
            <span className="font-medium">Share</span>
          </button>
          <button 
            onClick={() => handleCardAction("transfer")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white active:bg-zinc-900 transition-colors text-left border-t border-zinc-900"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500 -rotate-90" />
            <span className="font-medium">Transfer</span>
          </button>
          <button 
            onClick={() => handleCardAction("privacy")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white active:bg-zinc-900 transition-colors text-left border-t border-zinc-900"
          >
            <Lock className="h-3.5 w-3.5 text-blue-500" />
            <span className="font-medium">Privacy</span>
          </button>
        </div>
      )}
    </li>
  );
}
