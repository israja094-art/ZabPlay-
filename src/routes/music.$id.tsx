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
  RotateCw,
  Repeat1,
  ListMusic,
  SlidersHorizontal,
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
  const [repeat, setRepeat] = useState(0); // 0: off, 1: all, 2: one

  const idx = Math.max(0, songs.findIndex((s) => s.id === id));
  const song = songs[idx];

  useEffect(() => {
    if (!song) return;
    const a = syncSongSource({ id: song.id, src: song.src });
    audioRef.current = a;
    if (!a) return;
    const tryPlay = async () => {
      try {
        await a.play();
        setPlaying(true);
      } catch {}
    };
    tryPlay();
  }, [id, song]);

  const closePlayer = () => navigate({ to: "/music" });

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play(); else a.pause();
  };

  const pct = duration ? (current / duration) * 100 : 0;

  if (!song) return <div className="min-h-screen bg-[#060b1e] flex items-center justify-center text-blue-400">Loading...</div>;

  return (
    <div className="relative mx-auto flex h-dvh max-w-md flex-col bg-[#060b1e] text-white overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-blue-900/10 blur-[100px]" />

      <header className="relative z-10 flex items-center justify-between px-6 pt-6">
        <button onClick={closePlayer} className="p-2 rounded-full border border-blue-500/30 bg-blue-950/50"><ChevronDown /></button>
        <div className="text-center">
          <p className="text-xs text-blue-300 uppercase tracking-widest">Now Playing</p>
          <p className="text-sm font-bold truncate max-w-[150px]">{song.title}</p>
        </div>
        <button className="p-2 rounded-full border border-blue-500/30 bg-blue-950/50"><MoreVertical /></button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        {/* Neon Circle Music Art */}
        <div className="relative w-72 h-72 rounded-full border-4 border-blue-500/20 p-2 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
          <img src={song.cover} className="w-full h-full rounded-full object-cover" />
          <div className="absolute inset-0 rounded-full border-t-4 border-blue-500 animate-spin-slow" />
        </div>

        <div className="w-full text-center">
          <h1 className="text-xl font-bold truncate">{song.title}</h1>
          <p className="text-blue-400 text-sm">{song.artist}</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-2">
          <input type="range" className="w-full h-1 bg-blue-900/50 rounded-lg accent-blue-500" value={pct} onChange={() => {}} />
          <div className="flex justify-between text-xs text-blue-400">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-between w-full px-4 text-blue-400 mb-4">
          <button onClick={() => setShuffle(!shuffle)} className={shuffle ? "text-blue-500" : ""}><Shuffle size={20} /></button>
          <button onClick={() => setRepeat((r) => (r + 1) % 3)}>{repeat === 1 ? <Repeat size={20} className="text-blue-500" /> : <Repeat1 size={20} />}</button>
          <button><ListMusic size={20} /></button>
          <button><SlidersHorizontal size={20} /></button>
        </div>

        <div className="flex items-center gap-8 mb-8">
          <button onClick={() => {}}><SkipBack size={32} /></button>
          <button onClick={toggle} className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.6)]">
            {playing ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" className="ml-1" />}
          </button>
          <button onClick={() => {}}><SkipForward size={32} /></button>
        </div>
      </div>
    </div>
  );
}
