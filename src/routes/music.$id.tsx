import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  MoreVertical,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
} from "lucide-react";
import { formatTime } from "@/lib/media-data";
import { syncSongSource } from "@/lib/audio-player";
import { useMediaStore } from "@/lib/media-store";

export const Route = createFileRoute("/music/$id")({
  component: NowPlaying,
});

function NowPlaying() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { songs } = useMediaStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liked, setLiked] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const idx = Math.max(0, songs.findIndex((s) => s.id === id));
  const song = songs[idx];

  useEffect(() => {
    if (!song) return;
    const a = syncSongSource({ id: song.id, src: song.src });
    audioRef.current = a;
    if (!a) return;
    setCurrent(a.currentTime || 0);
    setDuration(a.duration || 0);
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [id, song]);

  const closePlayer = () => {
    navigate({ to: "/music" });
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } 
    else { a.pause(); setPlaying(false); }
  };

  const pct = duration ? (current / duration) * 100 : 0;

  if (!song) return <div className="min-h-screen bg-[#060b1e] flex items-center justify-center text-blue-400">No song found</div>;

  return (
    <div className="relative mx-auto flex h-dvh max-w-md flex-col bg-[#060b1e] text-white overflow-hidden font-sans">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a122e] to-[#060b1e]" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-6">
        <button onClick={closePlayer} className="p-3 rounded-full border border-blue-500/20 bg-blue-900/10 backdrop-blur-md">
          <ChevronDown className="h-6 w-6 text-blue-400" />
        </button>
        <div className="text-center">
          <p className="text-[10px] text-blue-400 uppercase tracking-widest">Now Playing</p>
          <p className="text-sm font-bold truncate max-w-[150px]">{song.title}</p>
        </div>
        <button className="p-3 rounded-full border border-blue-500/20 bg-blue-900/10 backdrop-blur-md">
          <MoreVertical className="h-5 w-5 text-blue-400" />
        </button>
      </header>

      {/* Main Circular Player Section */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <div className="relative w-72 h-72 rounded-full border-[6px] border-[#0a122e] shadow-[0_0_40px_rgba(59,130,246,0.3)] flex items-center justify-center">
          <img src={song.cover} className="w-64 h-64 rounded-full object-cover border-4 border-blue-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-x-transparent border-b-transparent animate-spin-slow" />
        </div>

        <div className="mt-8 text-center w-full">
          <h1 className="text-2xl font-bold truncate">{song.title}</h1>
          <p className="text-blue-400 text-sm mt-1">{song.artist}</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full mt-6 space-y-2">
          <input type="range" className="w-full h-1 bg-blue-900/30 rounded-full accent-blue-500" value={pct} onChange={(e) => {
             const t = (parseFloat(e.target.value) / 100) * (duration || 0);
             if(audioRef.current) audioRef.current.currentTime = t;
          }} />
          <div className="flex justify-between text-[10px] text-blue-400">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="relative z-10 bg-[#0a122e]/80 border-t border-blue-500/20 backdrop-blur-xl rounded-t-[3rem] p-8">
        <div className="flex justify-between items-center mb-6 text-blue-400">
          <button onClick={() => setShuffle(!shuffle)} className={shuffle ? "text-blue-500" : ""}><Shuffle size={20} /></button>
          <button onClick={() => setRepeat(!repeat)} className={repeat ? "text-blue-500" : ""}><Repeat size={20} /></button>
          <button onClick={() => setLiked(!liked)}><Heart size={20} className={liked ? "fill-blue-500 text-blue-500" : ""} /></button>
        </div>
        
        <div className="flex items-center justify-between gap-6">
          <button onClick={() => {}} className="text-blue-300"><SkipBack size={32} /></button>
          <button onClick={toggle} className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.6)]">
            {playing ? <Pause size={36} fill="white" /> : <Play size={36} fill="white" className="ml-1" />}
          </button>
          <button onClick={() => {}} className="text-blue-300"><SkipForward size={32} /></button>
        </div>
      </div>
    </div>
  );
}
