import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize,
  Volume2,
  VolumeX,
  Gauge,
  Sliders,
  Repeat,
  ZoomIn,
  Lock,
  Unlock,
} from "lucide-react";
import { formatTime } from "@/lib/media-data";

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

type VideoEl = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

export function VideoPlayer({
  src,
  onEnded,
  onPrev,
  onNext,
  onGestureStateChange,
  onControlsVisibilityChange,
}: {
  src: string;
  onEnded?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onGestureStateChange?: (swiping: boolean) => void;
  onControlsVisibilityChange?: (visible: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const eqNodesRef = useRef<{ bass: BiquadFilterNode; mid: BiquadFilterNode; treble: BiquadFilterNode } | null>(null);
  
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showEq, setShowEq] = useState(false);
  const [eq, setEq] = useState({ bass: 50, mid: 50, treble: 50 });
  const [brightness, setBrightness] = useState(100);
  const [volume, setVolume] = useState(1);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [looping, setLooping] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isSwipingActive, setIsSwipingActive] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ t: number; x: number } | null>(null);
  const pinchRef = useRef<{ distance: number; startZoom: number } | null>(null);

  const flashOverlay = useCallback((text: string, ms = 900) => {
    setOverlay(text);
    window.setTimeout(() => setOverlay(null), ms);
  }, []);

  const armHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShowControls(false);
      setShowSpeed(false);
      setShowEq(false);
    }, 2500);
  }, []);

  const reveal = useCallback(() => {
    setShowControls(true);
    armHide();
  }, [armHide]);

  // --- HISTORY LOGIC START ---
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    const savedTime = localStorage.getItem(`history_${src}`);
    if (savedTime) v.currentTime = parseFloat(savedTime);
    else v.currentTime = 0;
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setCurrent(v.currentTime);
      localStorage.setItem(`history_${src}`, v.currentTime.toString());
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [src]);
  // --- HISTORY LOGIC END ---

  useEffect(() => {
    const visibleState = showControls && !isSwipingActive && !isLocked;
    onControlsVisibilityChange?.(visibleState);
  }, [showControls, isSwipingActive, isLocked, onControlsVisibilityChange]);

  useEffect(() => {
    armHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [armHide]);

  useEffect(() => {
    const onFullscreenChange = () => { if (!document.fullscreenElement) setExpanded(false); };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const ensureAudioGraph = useCallback(() => {
    const v = videoRef.current;
    if (!v || sourceRef.current) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(v);
      const bass = ctx.createBiquadFilter(); bass.type = "lowshelf"; bass.frequency.value = 200;
      const mid = ctx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 1;
      const treble = ctx.createBiquadFilter(); treble.type = "highshelf"; treble.frequency.value = 3000;
      source.connect(bass).connect(mid).connect(treble).connect(ctx.destination);
      audioCtxRef.current = ctx; sourceRef.current = source; eqNodesRef.current = { bass, mid, treble };
    } catch {}
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    audioCtxRef.current?.resume();
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
    reveal();
  };

  const seekBy = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    const next = Math.max(0, Math.min((v.duration || 0), v.currentTime + delta));
    v.currentTime = next;
    setCurrent(next);
    setOverlay(`${delta > 0 ? "+" : ""}${Math.round(delta)}s`);
    setTimeout(() => setOverlay(null), 600);
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const t = (parseFloat(e.target.value) / 100) * (v.duration || 0);
    v.currentTime = t;
    setCurrent(t);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    flashOverlay(v.muted ? "Muted" : `Volume ${Math.round(v.volume * 100)}%`);
    reveal();
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
    reveal();
  };

  const cycleZoom = () => {
    const levels = [1, 1.25, 1.5, 2];
    const next = levels[(levels.indexOf(zoom) + 1) % levels.length];
    setZoom(next); flashOverlay(`Zoom ${Math.round(next * 100)}%`); reveal();
  };

  const toggleLoop = () => { setLooping(!looping); flashOverlay(!looping ? "Loop on" : "Loop off"); reveal(); };
  
  const setSpeedVal = (s: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = s;
    setSpeed(s); setShowSpeed(false); flashOverlay(`Speed ${s}x`); reveal();
  };

  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();
  const areControlsVisible = showControls && !isSwipingActive && !isLocked;

  return (
    <div
      ref={wrapRef}
      className={`bg-black overflow-hidden select-none ${expanded ? "fixed inset-0 z-50 h-dvh w-screen" : "relative w-full aspect-video"}`}
      onClick={() => { if (!showControls) { setShowControls(true); armHide(); } }}
    >
      <video
        ref={videoRef} src={src}
        className="w-full h-full object-contain bg-black"
        playsInline autoPlay muted={muted} loop={looping}
        style={{ transform: `scale(${zoom})`, filter: `brightness(${brightness}%)` }}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      
      <div className={`absolute inset-0 z-10 flex items-center justify-center gap-8 transition-opacity ${areControlsVisible ? "opacity-100" : "opacity-0"}`}>
        <button onClick={(e) => { stopBubble(e); onPrev?.(); reveal(); }}><SkipBack /></button>
        <button onClick={(e) => { stopBubble(e); togglePlay(); }}>{playing ? <Pause /> : <Play />}</button>
        <button onClick={(e) => { stopBubble(e); onNext?.(); reveal(); }}><SkipForward /></button>
      </div>

      <div className={`absolute bottom-0 left-0 right-0 z-20 px-3 pb-4 ${areControlsVisible ? "opacity-100" : "opacity-0"}`}>
        <div className="flex justify-between text-xs text-white"><span>{formatTime(current)}</span> <span>{formatTime(duration)}</span></div>
        <input type="range" className="w-full" value={(current / (duration || 1)) * 100} onChange={onSeek} />
      </div>
    </div>
  );
}
