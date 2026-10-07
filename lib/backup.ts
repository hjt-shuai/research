import { normalizeStore, type AppStore } from "./store";

export type ExportPayload = AppStore & { exportedAt: string };

export function exportStore(store: AppStore): void {
  const payload: ExportPayload = {
    ...store,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kaoyan-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportFile(text: string): AppStore | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (typeof o.version !== "number" || o.version < 1) return null;
    const { exportedAt: _e, ...rest } = o;
    return normalizeStore(rest);
  } catch {
    return null;
  }
}

export async function importStoreFromFile(file: File): Promise<AppStore | null> {
  const text = await file.text();
  return parseImportFile(text);
}
