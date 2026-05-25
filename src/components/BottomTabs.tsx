import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Music, PlaySquare, Play, Pause, SkipForward } from "lucide-react";
import { useMediaStore } from "@/lib/media-store";

export function BottomTabs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentSong, isPlaying, togglePlay } = useMediaStore(); 
  const isMusic = pathname.startsWith("/music");

  // Agar koi gaana select kiya hai aur hum full-screen player mein nahi hain
  const showMiniPlayer = currentSong && !pathname.includes("/music/");

  return (
    <>
      {/* Fixed Neon Mini-Player */}
      {showMiniPlayer && (
        <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 w-[92%] bg-[#0a122e] border border-blue-500/40 rounded-2xl p-3 flex items-center gap-3 z-50 shadow-[0_0_20px_rgba(59,130,246,0.3)] backdrop-blur-md">
          <img 
            src={currentSong.cover} 
            className="w-10 h-10 rounded-lg object-cover border border-blue-500/30" 
            alt="cover"
          />
          <div 
            className="flex-1 min-w-0 cursor-pointer" 
            onClick={() => navigate({ to: "/music/$id", params: { id: currentSong.id } })}
          >
            <p className="text-sm font-bold truncate text-white">{currentSong.title}</p>
            <p className="text-[10px] text-blue-400 uppercase tracking-wider">Device audio</p>
          </div>
          <button onClick={togglePlay} className="p-2 rounded-full bg-blue-500 text-white shadow-lg">
            {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#060b1e]/90 backdrop-blur-xl border-t border-blue-500/20 z-40">
        <div className="grid grid-cols-2">
          <Link
            to="/"
            className={`flex flex-col items-center gap-1 py-3 text-xs ${
              !isMusic ? "text-blue-500" : "text-blue-300/50"
            }`}
          >
            <PlaySquare className="h-6 w-6" strokeWidth={!isMusic ? 2.5 : 2} />
            Videos
          </Link>
          <Link
            to="/music"
            className={`flex flex-col items-center gap-1 py-3 text-xs ${
              isMusic ? "text-blue-500" : "text-blue-300/50"
            }`}
          >
            <Music className="h-6 w-6" strokeWidth={isMusic ? 2.5 : 2} />
            Music
          </Link>
        </div>
      </nav>
    </>
  );
}
