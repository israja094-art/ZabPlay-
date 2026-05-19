import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { CheckCircle2, Circle, FolderPlus, Share2, Trash2, X, Scissors, History, Eye } from "lucide-react";
import { BottomTabs } from "@/components/BottomTabs";
import { SearchBar } from "@/components/SearchBar";
import { Logo } from "@/components/Logo";
import { useLongPress } from "@/hooks/use-long-press";
import { runNativeScan } from "@/lib/native-scanner";
import { useMediaStore, deleteVideos, shareItems } from "@/lib/media-store";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { videos } = useMediaStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const list = videos.filter((v) => v.title.toLowerCase().includes(q.toLowerCase()));
  
  // Demo Logic: Continue watching (Assuming first 3 are history)
  const historyList = list.slice(0, 3); 

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white pb-20">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 sticky top-0 bg-[#050508]/90 backdrop-blur z-30">
        <div className="flex items-center justify-between mb-4">
          <Logo />
          {!selectMode && (
             <button onClick={() => fileRef.current?.click()} className="p-2">
                <FolderPlus className="h-6 w-6" />
             </button>
          )}
        </div>
        <SearchBar value={q} onChange={setQ} placeholder="Search videos..." />
      </div>

      {/* Continue Watching Section */}
      {!selectMode && !q && (
        <div className="px-4 py-2">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2"><History className="h-4 w-4"/> Continue Watching</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {historyList.map((v) => (
              <div key={v.id} className="min-w-[160px]">
                <div className="h-24 w-full bg-gray-800 rounded-lg overflow-hidden relative">
                  <img src={v.thumb} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 h-1 bg-blue-500" style={{ width: '60%' }} />
                </div>
                <p className="text-xs truncate mt-1">{v.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="px-4 py-2">
        <h2 className="text-sm font-bold mb-3">Recent Videos</h2>
        <ul className="space-y-4">
          {list.map((v) => (
            <VideoRow
              key={v.id}
              video={v}
              selectMode={selectMode}
              selected={selected.has(v.id)}
              onOpen={() => navigate({ to: "/video/$id", params: { id: v.id } })}
              onToggle={() => toggle(v.id)}
              onLongPress={() => { setSelectMode(true); toggle(v.id); }}
            />
          ))}
        </ul>
      </div>

      {/* Selection Action Bar (Fixed at bottom or top overlay) */}
      {selectMode && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gray-900 border-t flex justify-around">
          <button onClick={() => {}} className="flex flex-col items-center"><Scissors className="h-6 w-6"/> <span className="text-[10px]">Cut</span></button>
          <button onClick={onShare} className="flex flex-col items-center"><Share2 className="h-6 w-6"/> <span className="text-[10px]">Share</span></button>
          <button onClick={onDelete} className="flex flex-col items-center text-red-500"><Trash2 className="h-6 w-6"/> <span className="text-[10px]">Delete</span></button>
        </div>
      )}

      <BottomTabs />
    </div>
  );
}

// ... (VideoRow Component would go here with updated UI)

