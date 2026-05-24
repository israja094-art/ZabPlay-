import { Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CheckCircle2, Circle, FolderPlus, Share2, Trash2, X, Music } from "lucide-react";
import { BottomTabs } from "@/components/BottomTabs";
import { SearchBar } from "@/components/SearchBar";
import { Logo } from "@/components/Logo";
import { useLongPress } from "@/hooks/use-long-press";
import { playSongNow } from "@/lib/audio-player";
import {
  useMediaStore,
  importAudioFiles,
  deleteSongs,
  shareItems,
} from "@/lib/media-store";

export const Route = createFileRoute("/music")({
  head: () => ({
    meta: [
      { title: "ZabPlay — Music" },
      { name: "description", content: "Play music from your gallery with ZabPlay." },
    ],
  }),
  component: MusicPage,
});

function MusicPage() {
  const { pathname } = useLocation();
  const { songs } = useMediaStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  if (pathname !== "/music") {
    return <Outlet />;
  }

  const list = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(q.toLowerCase()) ||
      s.artist.toLowerCase().includes(q.toLowerCase()),
  );

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

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
    if (confirm(`Delete ${selected.size} song(s)?`)) {
      deleteSongs([...selected]);
      exitSelect();
    }
  };
  const onShare = () => {
    const items = songs.filter((s) => selected.has(s.id)).map((s) => ({ title: s.title, src: s.src }));
    shareItems(items);
  };

  const allSelected = list.length > 0 && list.every((s) => selected.has(s.id));

  return (
    <div className="min-h-screen bg-[#060b1e] text-white mx-auto max-w-md pb-24">
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) importAudioFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="px-4 pt-5 pb-3 space-y-4 sticky top-0 bg-[#060b1e]/90 backdrop-blur-lg z-30 border-b border-blue-500/30">
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
                onClick={() => setSelected(allSelected ? new Set() : new Set(list.map((s) => s.id)))}
                className="text-xs px-3 py-1 rounded-full bg-blue-600/20 border border-blue-500"
              >
                {allSelected ? "Clear" : "All"}
              </button>
              <button onClick={onShare} className="p-2" aria-label="Share">
                <Share2 className="h-5 w-5 text-blue-400" />
              </button>
              <button onClick={onDelete} className="p-2 text-red-400" aria-label="Delete">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-1 -mr-2">
              <button onClick={() => fileRef.current?.click()} className="p-2 text-blue-400"><FolderPlus className="h-5 w-5" /></button>
              <button onClick={() => setSelectMode(true)} className="p-2 text-blue-400"><CheckCircle2 className="h-5 w-5" /></button>
            </div>
          </div>
        )}
        <SearchBar value={q} onChange={setQ} placeholder="Search music..." />
      </div>

      <ul className="px-4 pt-4 space-y-3">
        {list.map((s) => (
          <SongRow
            key={s.id}
            song={s}
            selectMode={selectMode}
            selected={selected.has(s.id)}
            onOpen={() => {
              playSongNow({ id: s.id, src: s.src });
              navigate({ to: "/music/$id", params: { id: s.id } });
            }}
            onToggle={() => toggle(s.id)}
            onLongPress={() => enterSelect(s.id)}
          />
        ))}
      </ul>

      <BottomTabs />
    </div>
  );
}

function SongRow({ song, selectMode, selected, onOpen, onToggle, onLongPress }: any) {
  const { didTrigger, ...pressHandlers } = useLongPress(onLongPress, 450);
  return (
    <li className="relative group">
      <div className="absolute inset-0 bg-blue-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <button
        {...pressHandlers}
        onClick={() => {
          if (didTrigger()) return;
          if (selectMode) onToggle();
          else onOpen();
        }}
        className={`w-full flex items-center gap-4 px-3 py-3 rounded-2xl border ${
          selected ? "border-blue-500 bg-blue-500/20" : "border-blue-500/20 bg-[#0b1229]"
        }`}
      >
        <div className="w-12 h-12 rounded-xl bg-blue-900/30 flex items-center justify-center border border-blue-500/30">
          <Music className="w-6 h-6 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold truncate">{song.title}</p>
          <p className="text-[10px] text-blue-300/70 uppercase tracking-wider">Device audio</p>
        </div>
        {selectMode && (
          <div className="text-blue-500">
            {selected ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5 opacity-50" />}
          </div>
        )}
      </button>
    </li>
  );
}
