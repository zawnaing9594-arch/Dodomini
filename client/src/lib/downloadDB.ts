const DB_NAME = "seriesplus-downloads";
const DB_VERSION = 1;
const STORE_NAME = "videos";

export interface DownloadedVideo {
  epId: number;
  epTitle: string;
  contentTitle: string;
  poster: string;
  videoLink: string;
  blob?: Blob;
  downloadedAt: number;
  size: number;
  isBookmark: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "epId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDownload(video: DownloadedVideo): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(video);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDownload(epId: number): Promise<DownloadedVideo | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(epId);
    req.onsuccess = () => resolve(req.result || undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllDownloads(): Promise<DownloadedVideo[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const results = (req.result as DownloadedVideo[]).sort(
        (a, b) => b.downloadedAt - a.downloadedAt
      );
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removeDownload(epId: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(epId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function isDownloaded(epId: number): Promise<boolean> {
  const item = await getDownload(epId);
  return !!item;
}

export function isDirectVideoLink(url: string): boolean {
  return /\.(mp4|webm|m3u8|mov|avi|mkv)(\?.*)?$/i.test(url);
}

export async function downloadVideoWithProgress(
  url: string,
  onProgress: (percent: number) => void
): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Download failed");

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength) : 0;

  if (!response.body) {
    const blob = await response.blob();
    onProgress(100);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) {
      onProgress(Math.round((received / total) * 100));
    } else {
      onProgress(-1);
    }
  }

  onProgress(100);
  return new Blob(chunks, { type: "video/mp4" });
}
