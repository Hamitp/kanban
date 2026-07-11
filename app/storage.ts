import type { AppData } from "./types";

const DB_NAME = "akis-workspace";
const STORE_NAME = "workspace";
const STATE_KEY = "primary";
const FALLBACK_KEY = "akis-workspace-fallback";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadWorkspace(): Promise<AppData | null> {
  try {
    const db = await openDatabase();
    const value = await new Promise<AppData | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve((request.result as AppData) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  } catch {
    const fallback = localStorage.getItem(FALLBACK_KEY);
    return fallback ? (JSON.parse(fallback) as AppData) : null;
  }
}

export async function saveWorkspace(data: AppData): Promise<void> {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(data, STATE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch {
    // localStorage already contains the latest atomic snapshot.
  }
}

export function isWorkspaceData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppData>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.projects) &&
    Array.isArray(candidate.boards) &&
    Array.isArray(candidate.mindMaps) &&
    Array.isArray(candidate.members) &&
    Array.isArray(candidate.labels)
  );
}

