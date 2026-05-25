import { useSyncExternalStore } from "react";
import { videos as defaultVideos, songs as defaultSongs, type Video, type Song } from "./media-data";
import {
  subscribeNativeMedia,
  getNativeVideos,
  getNativeSongs,
  runNativeScan,
  wireAutoRescan,
} from "./native-scanner";
import { Share } from "@capacitor/share";
import { Filesystem } from "@capacitor/filesystem";

// --- NEW STATE FOR PLAYER SYNC ---
let currentSongId: string | null = null;
let isPlayingState: boolean = false;

type State = {
  videos: Video[];
  songs: Song[];
  currentSong: Song | null; // Track currently active song
  isPlaying: boolean;       // Track play status
};

type PersistedVideo = {
  id: string; title: string; duration: string; thumb: string; file: Blob; folderName?: string;
};

type PersistedSong = {
  id: string; title: string; artist: string; duration: string; cover: string; file: Blob;
};

// ... (Baaki saare constants aur helpers jaise the waise hi hain)
const LS_DELETED_V = "zabplay.deleted.videos";
const LS_DELETED_S = "zabplay.deleted.songs";
const LS_PRIVACY_V = "zabplay.privacy.videos";
const LS_RENAMED_V = "zabplay.renamed.videos";
const LS_PRIVACY_PIN = "zabplay.privacy.pin";
const DB_NAME = "zabplay-media-db";
const DB_VERSION = 1;
const VIDEO_STORE = "videos";
const SONG_STORE = "songs";

const VIDEO_THUMB_PLACEHOLDER = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" rx="18" fill="#111827"/><circle cx="160" cy="90" r="32" fill="#ffffff22"/><path d="M148 70v40l30-20-30-20z" fill="#f8fafc"/></svg>`);
const SONG_COVER_PLACEHOLDER = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" rx="28" fill="#111827"/><circle cx="150" cy="150" r="82" fill="#ffffff14"/><circle cx="150" cy="150" r="22" fill="#f8fafc"/><path d="M178 84v90.5a25 25 0 1 1-14-22.5V108l58-11v63.5a25 25 0 1 1-14-22.5V84z" fill="#cbd5e1"/></svg>`);

const fmtDuration = (sec: number) => {
  if (!isFinite(sec) || sec <= 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const loadDeleted = (key: string): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch { return new Set(); }
};

const saveDeleted = (key: string, s: Set<string>) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify([...s]));
};

const loadRenamedMap = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_RENAMED_V) || "{}"); } catch { return {}; }
};

let deletedV = new Set<string>();
let deletedS = new Set<string>();
let privacyV = new Set<string>();
let renamedMap: Record<string, string> = {};
let hydratedFromStorage = false;
let mediaHydrated = false;

const userVideos: Video[] = [];
const userSongs: Song[] = [];
const nativeDurationCache = new Map<string, { duration: string; thumb?: string }>();

const computeState = (): State => {
  const nv = getNativeVideos().map(video => {
    const cached = nativeDurationCache.get(video.id);
    const updatedTitle = renamedMap[video.id] || video.title;
    return cached 
      ? { ...video, title: updatedTitle, duration: cached.duration, thumb: cached.thumb || video.thumb } 
      : { ...video, title: updatedTitle };
  });
  
  const ns = getNativeSongs().map(song => {
    const cached = nativeDurationCache.get(song.id);
    return cached ? { ...song, duration: cached.duration } : song;
  });

  const allSongs = [...ns, ...userSongs, ...defaultSongs.filter((s) => !deletedS.has(s.id))];
  const allVideos = [...nv, ...userVideos, ...defaultVideos].filter(
    (v) => !deletedV.has(v.id) && !privacyV.has(v.id)
  );

  return {
    videos: allVideos,
    songs: allSongs,
    currentSong: allSongs.find(s => s.id === currentSongId) || null,
    isPlaying: isPlayingState,
  };
};

// --- ADDED PLAYER CONTROL HELPERS ---
export const setCurrentSong = (id: string | null) => { currentSongId = id; emit(); };
export const setPlayingState = (playing: boolean) => { isPlayingState = playing; emit(); };
export const togglePlay = () => { isPlayingState = !isPlayingState; emit(); };

let state: State = computeState();
const listeners = new Set<() => void>();

const emit = () => {
  state = computeState();
  listeners.forEach((l) => l());
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let isProbingBackground = false;

const probeNativeMediaBackground = async () => {
  if (isProbingBackground) return;
  isProbingBackground = true;
  const nv = getNativeVideos();
  const ns = getNativeSongs();
  for (const video of nv) {
    if (!nativeDurationCache.has(video.id) || nativeDurationCache.get(video.id)?.duration === "") {
      try { await sleep(300); const meta = await probeVideo(video.src); if (meta.duration && meta.duration !== "00:00") { nativeDurationCache.set(video.id, meta); queueMicrotask(() => emit()); } } catch {}
    }
  }
  for (const song of ns) {
    if (!nativeDurationCache.has(song.id) || nativeDurationCache.get(song.id)?.duration === "") {
      try { await sleep(150); const d = await probeAudioDuration(song.src); if (d && d !== "00:00") { nativeDurationCache.set(song.id, { duration: d }); queueMicrotask(() => emit()); } } catch {}
    }
  }
  isProbingBackground = false;
};

// ... (Baaki ka logic jo aapne bheja tha, bilkul waisa hi hai)
const openDb = (): Promise<IDBDatabase | null> => new Promise((resolve) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) { resolve(null); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(VIDEO_STORE)) db.createObjectStore(VIDEO_STORE, { keyPath: "id" }); if (!db.objectStoreNames.contains(SONG_STORE)) db.createObjectStore(SONG_STORE, { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(null);
});

const readAll = async <T,>(storeName: string): Promise<T[]> => {
  const db = await openDb(); if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as T[]) || []); request.onerror = () => resolve([]);
  });
};

const putOne = async <T,>(storeName: string, value: T) => {
  const db = await openDb(); if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(); tx.onerror = () => resolve();
  });
};

const deleteOne = async (storeName: string, id: string) => {
  const db = await openDb(); if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve(); tx.onerror = () => resolve();
  });
};

const hydratePersistedMedia = async () => {
  if (mediaHydrated || typeof window === "undefined") return;
  mediaHydrated = true;
  const [videos, songs] = await Promise.all([readAll<PersistedVideo>(VIDEO_STORE), readAll<PersistedSong>(SONG_STORE)]);
  userVideos.splice(0, userVideos.length, ...videos.map((video) => ({
      id: video.id, title: renamedMap[video.id] || video.title, duration: video.duration, thumb: video.thumb, 
      src: video.folderName ? `/${video.folderName}/${renamedMap[video.id] || video.title}` : URL.createObjectURL(video.file),
  })));
  userSongs.splice(0, userSongs.length, ...songs.map((song) => ({
      id: song.id, title: song.title, artist: song.artist, duration: song.duration, cover: song.cover, src: URL.createObjectURL(song.file),
  })));
  emit();
};

const subscribe = (l: () => void) => {
  if (!hydratedFromStorage && typeof window !== "undefined") {
    hydratedFromStorage = true;
    deletedV = loadDeleted(LS_DELETED_V);
    deletedS = loadDeleted(LS_DELETED_S);
    privacyV = loadDeleted(LS_PRIVACY_V);
    renamedMap = loadRenamedMap();
    queueMicrotask(() => emit());
    void hydratePersistedMedia();
    subscribeNativeMedia(() => { emit(); if ('requestIdleCallback' in window) window.requestIdleCallback(() => void probeNativeMediaBackground(), { timeout: 3000 }); else setTimeout(() => void probeNativeMediaBackground(), 1000); });
    void runNativeScan(true); void wireAutoRescan();
  }
  listeners.add(l); return () => listeners.delete(l);
};

export const useMediaStore = () => useSyncExternalStore(subscribe, () => state, () => state);

// (Delete, Rename, Share functions niche waise hi rehne dein)
export const deleteVideos = async (ids: string[]) => { /* ...Same code... */ emit(); };
export const deleteSongs = (ids: string[]) => { /* ...Same code... */ emit(); };
export const renameVideoFile = async (id: string, newTitle: string) => { /* ...Same code... */ emit(); };
export const moveVideosToPrivacy = (ids: string[]) => { /* ...Same code... */ emit(); };
export const removeVideosFromPrivacy = (ids: string[]) => { /* ...Same code... */ emit(); };
export const getPrivacyVideos = async (): Promise<Video[]> => { /* ...Same code... */ };
export const getPrivacyPin = (): string | null => localStorage.getItem(LS_PRIVACY_PIN);
export const setPrivacyPin = (pin: string) => localStorage.setItem(LS_PRIVACY_PIN, pin);

// Probe and Import helpers (Same as before)
const probeVideo = (url: string): Promise<{ duration: string; thumb: string }> => new Promise((resolve) => { /* ...Same... */ });
const probeAudioDuration = (url: string): Promise<string> => new Promise((resolve) => { /* ...Same... */ });
export const importVideoFiles = async (files: FileList | File[]) => { /* ...Same... */ emit(); };
export const importAudioFiles = async (files: FileList | File[]) => { /* ...Same... */ emit(); };
export const shareItems = async (items: { id: string; title: string; src: string }[]) => { /* ...Same... */ };
