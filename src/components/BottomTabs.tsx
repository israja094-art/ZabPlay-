import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Music, PlaySquare, Play, Pause, SkipForward } from "lucide-react";
import { useMediaStore } from "@/lib/media-store";
import { useAudioPlayer } from "@/lib/audio-player"; // Assuming this hook provides current playing state

export function BottomTabs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentSong } = useMediaStore(); // Ye function aapke store se current song uthayega
  const isMusic = pathname.startsWith("/music");

  // Agar gana play ho raha hai, toh player dikhayenge
  const isPlaying = true; // Aapke audio state se link hoga

  return (
    <>
      {/* Mini Player Bar */}
      {currentSong && !pathname.includes("/music/") && (
        <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 w-[95%] bg-[#0b1229]/90 border border-blue-500/30 backdrop-blur-xl rounded-2xl p-3 flex items-center gap-3 z-50 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
          <img src={currentSong.cover} className="w-10 h-10 rounded-lg object-cover" />
          <div className="flex-1 min-w-0" onClick={() => navigate({ to: "/music/$id", params: { id: currentSong.id } })}>
            <p className="text-sm font-semibold truncate text-white">{currentSong.title}</p>
            <p className="text-[10px] text-blue-400 uppercase">Device audio</p>
          </div>
          <button className="text-blue-400"><SkipForward size={20} /></button>
          <button className="bg-blue-500 p-2 rounded-full text-white">
            {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#060b1e]/90 backdrop-blur-lg border-t border-blue-500/20 z-40">
        <div className="grid grid-cols-2">
          <Link
            to="/"
            className={`flex flex-col items-center gap-1 py-3 text-xs ${
              !isMusic ? "text-blue-500" : "text-blue-300/50"
            }`}
          >
            <PlaySquare className="h-6 w-6" />
            Videos
          </Link>
          <Link
            to="/music"
            className={`flex flex-col items-center gap-1 py-3 text-xs ${
              isMusic ? "text-blue-500" : "text-blue-300/50"
            }`}
          >
            <Music className="h-6 w-6" />
            Music
          </Link>
        </div>
      </nav>
    </>
  );
}

