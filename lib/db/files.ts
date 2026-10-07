/**
 * 用户上传文件的本地存储（IndexedDB）。
 * 为什么不放 localStorage：文件体积大且 localStorage 只有 ~5MB，且二进制无法直接存取。
 * 结构化元数据仍放在 kaoyan.store（userFiles），文件本体放这里；IndexedDB 不可用时
 * 自动降级为「只保存元数据」，不会阻断任何操作。
 */

const DB_NAME = "kaoyan-files";
const STORE_NAME = "files";
const DB_VERSION = 1;
export const MAX_INLINE_FILE_BYTES = 25 * 1024 * 1024;

type StoredFile = { id: string; name: string; mime: string; size: number; blob: Blob; savedAt: string };

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putFile(id: string, file: File): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({
        id,
        name: file.name,
        mime: file.type,
        size: file.size,
        blob: file,
        savedAt: new Date().toISOString(),
      } satisfies StoredFile);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function getFile(id: string): Promise<StoredFile | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredFile | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function removeFile(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

export async function countFiles(): Promise<number> {
  const db = await openDb();
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => {
        db.close();
        resolve(req.result ?? 0);
      };
      req.onerror = () => {
        db.close();
        resolve(0);
      };
    } catch {
      db.close();
      resolve(0);
    }
  });
}

/** 打开/下载已保存的文件；返回是否成功（未保存文件本体时返回 false） */
export async function openStoredFile(id: string, download = false): Promise<boolean> {
  const rec = await getFile(id);
  if (!rec?.blob) return false;
  const url = URL.createObjectURL(rec.blob);
  if (download) {
    const a = document.createElement("a");
    a.href = url;
    a.download = rec.name || "file";
    a.click();
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export function fileTypeOf(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return ext;
}

export const ALLOWED_UPLOAD_EXT = ["pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "txt", "md", "png", "jpg", "jpeg", "webp"];

export function isAllowedUpload(name: string): boolean {
  return ALLOWED_UPLOAD_EXT.includes(fileTypeOf(name));
}

export function formatBytes(size: number): string {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
