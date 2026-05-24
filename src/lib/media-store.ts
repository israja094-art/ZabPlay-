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

type State = {
  videos: Video[];
  songs: Song[];
};

type PersistedVideo = {
  id: string;
  title: string;
  duration: string;
  thumb: string;
  file: Blob;
  folderName?: string;
};

type PersistedSong = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  cover: string;
  file: Blob;
};

const LS_DELETED_V = "zabplay.deleted.videos";
const LS_DELETED_S = "zabplay.deleted.songs";
const LS_PRIVACY_V = "zabplay.privacy.videos";
const LS_RENAMED_V = "zabplay.renamed.videos";
const LS_PRIVACY_PIN = "zabplay.privacy.pin";
const DB_NAME = "zabplay-media-db";
const DB_VERSION = 1;
const VIDEO_STORE = "videos";
const SONG_STORE = "songs";

const VIDEO_THUMB_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" rx="18" fill="#111827"/><circle cx="160" cy="90" r="32" fill="#ffffff22"/><path d="M148 70v40l30-20-30-20z" fill="#f8fafc"/></svg>`);
const SONG_COVER_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" rx="28" fill="#111827"/><circle cx="150" cy="150" r="82" fill="#ffffff14"/><circle cx="150" cy="150" r="22" fill="#f8fafc"/><path d="M178 84v90.5a25 25 0 1 1-14-22.5V108l58-11v63.5a25 25 0 1 1-14-22.5V84z" fill="#cbd5e1"/></svg>`);

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

  const allVideos = [...nv, ...userVideos, ...defaultVideos].filter(
    (v) => !deletedV.has(v.id) && !privacyV.has(v.id)
  );

  return {
    videos: allVideos,
    songs: [...ns, ...userSongs, ...defaultSongs.filter((s) => !deletedS.has(s.id))],
  };
};

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
      try {
        await sleep(300);
        const meta = await probeVideo(video.src);
        if (meta.duration && meta.duration !== "00:00") {
          nativeDurationCache.set(video.id, meta);
          queueMicrotask(() => emit());
        }
      } catch (e) { console.warn("Background video probe skip", e); }
    }
  }
  for (const song of ns) {
    if (!nativeDurationCache.has(song.id) || nativeDurationCache.get(song.id)?.duration === "") {
      try {
        await sleep(150);
        const d = await probeAudioDuration(song.src);
        if (d && d !== "00:00") {
          nativeDurationCache.set(song.id, { duration: d });
          queueMicrotask(() => emit());
        }
      } catch (e) { console.warn("Background audio probe skip", e); }
    }
  }
  isProbingBackground = false;
};

const openDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) { resolve(null); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VIDEO_STORE)) db.createObjectStore(VIDEO_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SONG_STORE)) db.createObjectStore(SONG_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

const readAll = async <T,>(storeName: string): Promise<T[]> => {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as T[]) || []);
    request.onerror = () => resolve([]);
  });
};

const putOne = async <T,>(storeName: string, value: T) => {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
};

const deleteOne = async (storeName: string, id: string) => {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
};

const hydratePersistedMedia = async () => {
  if (mediaHydrated || typeof window === "undefined") return;
  mediaHydrated = true;
  const [videos, songs] = await Promise.all([
    readAll<PersistedVideo>(VIDEO_STORE),
    readAll<PersistedSong>(SONG_STORE),
  ]);
  userVideos.splice(0, userVideos.length, ...videos.map((video) => {
    const updatedTitle = renamedMap[video.id] || video.title;
    return {
      id: video.id,
      title: updatedTitle,
      duration: video.duration,
      thumb: video.thumb,
      src: video.folderName ? `/${video.folderName}/${updatedTitle}` : URL.createObjectURL(video.file),
    };
  }));
  userSongs.splice(0, userSongs.length, ...songs.map((song) => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    duration: song.duration,
    cover: song.cover,
    src: URL.createObjectURL(song.file),
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
    subscribeNativeMedia(() => {
      emit();
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => void probeNativeMediaBackground(), { timeout: 3000 });
      } else {
        setTimeout(() => void probeNativeMediaBackground(), 1000);
      }
    });
    void runNativeScan(true);
    void wireAutoRescan();
  }
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useMediaStore = () =>
  useSyncExternalStore(subscribe, () => state, () => state);

export const deleteVideos = async (ids: string[]) => {
  for (const id of ids) {
    if (id.startsWith("nv-")) {
      let rawFilePath = id.replace("nv-", "").replace(/^file:\/\//, "").replace(/^_capacitor_file_/, "");
      try { await Filesystem.deleteFile({ path: rawFilePath }); } catch (err) { console.error(err); }
      deletedV.add(id);
    } else {
      const i = userVideos.findIndex((v) => v.id === id);
      if (i >= 0) { URL.revokeObjectURL(userVideos[i].src); userVideos.splice(i, 1); void deleteOne(VIDEO_STORE, id); }
      else { deletedV.add(id); }
    }
  }
  saveDeleted(LS_DELETED_V, deletedV);
  emit();
};

export const deleteSongs = (ids: string[]) => {
  for (const id of ids) {
    const i = userSongs.findIndex((s) => s.id === id);
    if (i >= 0) { URL.revokeObjectURL(userSongs[i].src); userSongs.splice(i, 1); void deleteOne(SONG_STORE, id); }
    else { deletedS.add(id); }
  }
  saveDeleted(LS_DELETED_S, deletedS);
  emit();
};

// FIX: Renaming logic
export const renameVideoFile = async (id: string, newTitle: string) => {
  if (!newTitle.trim()) return;
  renamedMap[id] = newTitle.trim();
  localStorage.setItem(LS_RENAMED_V, JSON.stringify(renamedMap));
  const userIdx = userVideos.findIndex((v) => v.id === id);
  if (userIdx >= 0) {
    userVideos[userIdx].title = newTitle.trim();
    const dbVideos = await readAll<PersistedVideo>(VIDEO_STORE);
    const targetData = dbVideos.find(v => v.id === id);
    if (targetData) {
      targetData.title = newTitle.trim();
      await putOne<PersistedVideo>(VIDEO_STORE, targetData);
    }
  }
  emit();
};

export const moveVideosToPrivacy = (ids: string[]) => {
  for (const id of ids) { privacyV.add(id); }
  saveDeleted(LS_PRIVACY_V, privacyV);
  emit();
};

export const removeVideosFromPrivacy = (ids: string[]) => {
  for (const id of ids) { privacyV.delete(id); }
  saveDeleted(LS_PRIVACY_V, privacyV);
  emit();
};

export const getPrivacyVideos = async (): Promise<Video[]> => {
  const nv = getNativeVideos().map(video => {
    const cached = nativeDurationCache.get(video.id);
    return { ...video, title: renamedMap[video.id] || video.title, duration: cached?.duration || video.duration, thumb: cached?.thumb || video.thumb };
  });
  const allMedia = [...nv, ...userVideos, ...defaultVideos];
  return allMedia.filter(v => privacyV.has(v.id));
};

export const getPrivacyPin = () => localStorage.getItem(LS_PRIVACY_PIN);
export const setPrivacyPin = (pin: string) => localStorage.setItem(LS_PRIVACY_PIN, pin);

const probeVideo = (url: string): Promise<{ duration: string; thumb: string }> =>
  new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata"; v.muted = true; v.src = url; v.crossOrigin = "anonymous";
    let resolved = false;
    const done = (duration: string, thumb: string) => { if (resolved) return; resolved = true; v.src = ""; v.load(); resolve({ duration, thumb }); };
    v.addEventListener("loadeddata", () => { try { v.currentTime = Math.min(1, (v.duration || 0) / 2); } catch { done(fmtDuration(v.duration), ""); } });
    v.addEventListener("seeked", () => { try { const c = document.createElement("canvas"); c.width = 320; c.height = Math.round((v.videoHeight / v.videoWidth) * 320) || 180; const ctx = c.getContext("2d"); ctx?.drawImage(v, 0, 0, c.width, c.height); done(fmtDuration(v.duration), c.toDataURL("image/jpeg", 0.6)); } catch { done(fmtDuration(v.duration), ""); } });
    v.addEventListener("error", () => done("00:00", ""));
    setTimeout(() => done(fmtDuration(v.duration || 0), ""), 3000);
  });

const probeAudioDuration = (url: string): Promise<string> =>
  new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata"; audio.src = url;
    let settled = false;
    const finish = (value: string) => { if (settled) return; settled = true; audio.src = ""; resolve(value); };
    audio.addEventListener("loadedmetadata", () => finish(fmtDuration(audio.duration || 0)));
    audio.addEventListener("error", () => finish("00:00"));
    setTimeout(() => finish(fmtDuration(audio.duration || 0)), 3000);
  });

export const importVideoFiles = async (files: FileList | File[]) => {
  const arr = Array.from(files);
  for (const f of arr) {
    const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const url = URL.createObjectURL(f);
    const { duration, thumb } = await probeVideo(url);
    const video: Video = { id, title: f.name.replace(/\.[^.]+$/, ""), duration, thumb: thumb || VIDEO_THUMB_PLACEHOLDER, src: `/Imported Videos/${f.name}` };
    userVideos.unshift(video);
    emit();
    void putOne<PersistedVideo>(VIDEO_STORE, { id, title: video.title, duration: video.duration, thumb: video.thumb, file: f, folderName: "Imported Videos" });
  }
};

export const importAudioFiles = async (files: FileList | File[]) => {
  const arr = Array.from(files);
  for (const f of arr) {
    const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const url = URL.createObjectURL(f);
    const duration = await probeAudioDuration(url);
    const song: Song = { id, title: f.name.replace(/\.[^.]+$/, ""), artist: "Local audio", duration, cover: SONG_COVER_PLACEHOLDER, src: url };
    userSongs.unshift(song);
    emit();
    void putOne<PersistedSong>(SONG_STORE, { id, title: song.title, artist: song.artist, duration: song.duration, cover: song.cover, file: f });
  }
};

export const shareItems = async (items: { id: string; title: string; src: string }[]) => {
  if (items.length === 0) return;
  try {
    const filesToShare: string[] = [];
    for (const item of items) {
      if (item.id && item.id.startsWith("nv-")) {
        const rawNativePath = item.id.replace("nv-", "");
        try {
          const fileUriResult = await Filesystem.getUri({ path: rawNativePath });
          if (fileUriResult && fileUriResult.uri) filesToShare.push(fileUriResult.uri);
        } catch (fsErr) { if (rawNativePath.startsWith("file://")) filesToShare.push(rawNativePath); }
      }
    }
    if (filesToShare.length > 0) {
      await Share.share({ title: items[0].title, files: filesToShare, dialogTitle: "Share Video" });
    } else {
      await Share.share({ title: "ZabPlay Media", text: items.map((i) => i.title).join("\n"), dialogTitle: "Share Info" });
    }
  } catch (error) { console.error(error); }
};
