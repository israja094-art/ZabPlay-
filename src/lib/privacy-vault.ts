// src/lib/privacy-vault.ts
const PRIVACY_DB = "zabplay-privacy-db";
const PRIVACY_STORE = "locked-videos";
const LS_PIN = "zabplay.privacy.pin";

export const getDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve) => {
    const request = indexedDB.open(PRIVACY_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(PRIVACY_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
  });
};

export const setPin = (pin: string) => localStorage.setItem(LS_PIN, pin);
export const verifyPin = (pin: string) => localStorage.getItem(LS_PIN) === pin;

export const lockVideo = async (video: any) => {
  const db = await getDb();
  const tx = db.transaction(PRIVACY_STORE, "readwrite");
  tx.objectStore(PRIVACY_STORE).put(video);
  return new Promise(resolve => tx.oncomplete = resolve);
};

export const getLockedVideos = async (): Promise<any[]> => {
  const db = await getDb();
  return new Promise(resolve => {
    const request = db.transaction(PRIVACY_STORE, "readonly").objectStore(PRIVACY_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

export const unlockVideo = async (id: string) => {
  const db = await getDb();
  const tx = db.transaction(PRIVACY_STORE, "readwrite");
  tx.objectStore(PRIVACY_STORE).delete(id);
};
