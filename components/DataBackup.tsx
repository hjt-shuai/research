"use client";

import { useRef, useState } from "react";
import { exportStore, importStoreFromFile } from "@/lib/backup";
import type { AppStore } from "@/lib/store";
import { useAppStore } from "./AppStoreProvider";

type Status = { kind: "ok" | "error"; text: string } | null;

function summarize(s: AppStore): string {
  return `任务 ${Object.keys(s.tasks).length} 项 · 模考 ${s.mocks.length} 次 · 知识点 ${Object.keys(s.mastery).length} 个 · 学习记录 ${Object.keys(s.studyLog).length} 天`;
}

export default function DataBackup() {
  const { store, replaceStore } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);

  const onExport = () => {
    exportStore(store);
    setStatus({ kind: "ok", text: `已导出备份文件（${summarize(store)}）。` });
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let next: AppStore | null = null;
    try {
      next = await importStoreFromFile(file);
    } catch {
      next = null;
    }
    if (!next) {
      setStatus({
        kind: "error",
        text: "导入失败：不是有效的备考数据 JSON（缺少 version 字段或格式损坏）。",
      });
      return;
    }
    const ok = window.confirm(
      `导入将用备份覆盖当前数据：\n\n当前：${summarize(store)}\n备份：${summarize(next)}\n\n确认导入？`,
    );
    if (!ok) return;
    replaceStore(next);
    setStatus({ kind: "ok", text: `导入成功，已恢复：${summarize(next)}。` });
  };

  return (
    <div className="backup-block">
      <div className="backup-actions">
        <button type="button" className="ghost-btn" onClick={onExport}>
          导出备考数据
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => inputRef.current?.click()}
        >
          导入备考数据
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={onImport}
        />
      </div>
      <p className="hint">
        导出为 JSON 文件，包含任务进度、模考成绩、学习记录、知识掌握度、目标分与初试日期；
        换电脑或清理浏览器前建议先导出一次。
      </p>
      {status && (
        <p
          className={`backup-status${status.kind === "error" ? " is-error" : ""}`}
          role="status"
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
