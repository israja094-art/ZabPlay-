import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Lock, Unlock, ArrowLeft, Trash2 } from "lucide-react";
import { getLockedVideos, unlockVideo, verifyPin } from "@/lib/privacy-vault";
import { removeVideosFromPrivacy } from "@/lib/media-store";

export const Route = createFileRoute("/privacy")({
  component: PrivacyFolder,
});

function PrivacyFolder() {
  const navigate = useNavigate();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [videos, setVideos] = useState<any[]>([]);

  // Videos load karein
  const loadLocked = async () => {
    const data = await getLockedVideos();
    setVideos(data);
  };

  useEffect(() => {
    if (isUnlocked) loadLocked();
  }, [isUnlocked]);

  const handleLogin = () => {
    if (verifyPin(pin)) {
      setIsUnlocked(true);
    } else {
      alert("Wrong PIN!");
    }
  };

  const handleUnlock = async (id: string) => {
    await unlockVideo(id); // DB se remove
    removeVideosFromPrivacy([id]); // State se remove
    loadLocked(); // List refresh
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Lock className="w-16 h-16 text-primary mb-6" />
        <h2 className="text-xl font-bold mb-4">Privacy Vault</h2>
        <input
          type="password"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter PIN"
          className="bg-secondary p-3 rounded-xl w-48 text-center text-lg mb-4 border border-border"
        />
        <button onClick={handleLogin} className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-bold">
          Unlock
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate({ to: "/" })}><ArrowLeft /></button>
        <h1 className="text-xl font-bold">Locked Videos ({videos.length})</h1>
      </div>

      <div className="space-y-4">
        {videos.map((v) => (
          <div key={v.id} className="flex items-center gap-4 bg-secondary/30 p-3 rounded-xl border border-border">
            <img src={v.thumb} className="w-20 h-14 object-cover rounded-lg" />
            <div className="flex-1">
              <p className="font-medium text-sm line-clamp-1">{v.title}</p>
            </div>
            <button 
              onClick={() => handleUnlock(v.id)}
              className="p-2 text-primary hover:bg-primary/10 rounded-full"
            >
              <Unlock className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
