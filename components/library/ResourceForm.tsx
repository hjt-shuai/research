"use client";

import { useState } from "react";
import { useLibrary } from "../useLibrary";
import {
  RESOURCE_CATEGORY_LABEL,
  RESOURCE_SUBJECT_LABEL,
  SOURCE_TYPE_LABEL,
  USAGE_STAGES,
  type ResourceCategory,
  type ResourceSubject,
  type SourceType,
} from "@/lib/db/types";

const CATEGORIES = Object.keys(RESOURCE_CATEGORY_LABEL) as ResourceCategory[];
const SUBJECTS = Object.keys(RESOURCE_SUBJECT_LABEL) as ResourceSubject[];
const YEARS = [2024, 2025, 2026, 2027, 2028];

/**
 * 新增资料 / 上传我的资料。
 * 官方资料与「我的资料」在数据层就是分开的（isOfficial），上传永远不会变成官方。
 */
export default function ResourceForm() {
  const { store, createResource, uploadUserFile } = useLibrary();
  const [mode, setMode] = useState<"LINK" | "UPLOAD">("LINK");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // 链接型资料
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ResourceCategory>("STUDY_NOTE");
  const [subject, setSubject] = useState<ResourceSubject>("cs408");
  const [year, setYear] = useState<string>("");
  const [sourceId, setSourceId] = useState<string>("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [declareOfficial, setDeclareOfficial] = useState(false);

  const submitLink = () => {
    if (!title.trim()) {
      setMessage("请填写资料名称。");
      return;
    }
    const id = createResource({
      title,
      category,
      subject,
      year: year ? Number(year) : null,
      sourceId: sourceId || null,
      sourceUrl,
      description,
      tags: tags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
      isOfficial: declareOfficial,
      status: "DRAFT",
    });
    setMessage(
      `已新增资料（草稿）：${id.slice(0, 12)}… 可在卡片里查看/编辑，并「设为当前有效」。${
        declareOfficial ? "已标记为官方来源，请确认链接确实来自官方站点。" : ""
      }`,
    );
    setTitle("");
    setSourceUrl("");
    setDescription("");
    setTags("");
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const res = await uploadUserFile(file, {
      title: file.name,
      category: category === "STUDY_NOTE" ? "MY_UPLOAD" : category,
      subject,
      year: year ? Number(year) : null,
      tags: tags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setBusy(false);
    setMessage(res.message);
  };

  return (
    <section className="card" aria-label="新增资料">
      <div className="section-head-row">
        <h3 className="section-title">新增资料</h3>
        <div className="scope-switch" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "LINK"}
            className={mode === "LINK" ? "is-active" : ""}
            onClick={() => setMode("LINK")}
          >
            登记链接 / 元数据
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "UPLOAD"}
            className={mode === "UPLOAD" ? "is-active" : ""}
            onClick={() => setMode("UPLOAD")}
          >
            上传我的资料
          </button>
        </div>
      </div>

      <p className="section-note">
        {mode === "LINK"
          ? "登记合法来源链接或资料元数据（教材、网课、真题册等）。勾选「官方来源」才会标记为官方资料。"
          : "上传的文件只保存在本机浏览器（IndexedDB），会标记为「我的资料」，永远不会被当成官方文件，也不参与自动更新。支持 PDF / DOCX / XLSX / PPTX / TXT / PNG / JPG。"}
      </p>

      <div className="filter-bar">
        <label className="field field-grow">
          资料名称
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：408 操作系统 进程同步 章节题" />
        </label>
        <label className="field">
          资料类型
          <select value={category} onChange={(e) => setCategory(e.target.value as ResourceCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {RESOURCE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          科目
          <select value={subject} onChange={(e) => setSubject(e.target.value as ResourceSubject)}>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {RESOURCE_SUBJECT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          年份
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">未指定</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {mode === "LINK" ? (
        <>
          <div className="filter-bar">
            <label className="field">
              来源
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">未标注来源</option>
                {store.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sourceName}（{SOURCE_TYPE_LABEL[s.sourceType as SourceType]}）
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-grow">
              原始链接
              <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" />
            </label>
            <label className="field field-grow">
              知识点 / 标签
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="q408-os-sync, 真题, 刷题" />
            </label>
          </div>
          <label className="field">
            说明
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="这份资料是什么、怎么用" />
          </label>
          <div className="res-actions" style={{ marginTop: 12, alignItems: "center" }}>
            <label className="kp-check" style={{ marginTop: 0 }}>
              <input type="checkbox" checked={declareOfficial} onChange={(e) => setDeclareOfficial(e.target.checked)} />
              这份资料来自官方（会显示「官方」标签，且不能被你上传的文件覆盖）
            </label>
            <button type="button" className="primary-btn" onClick={submitLink}>
              保存资料
            </button>
          </div>
        </>
      ) : (
        <div className="res-actions" style={{ alignItems: "center" }}>
          <input
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.md,.png,.jpg,.jpeg,.webp"
            disabled={busy}
            onChange={(e) => onPickFile(e.target.files?.[0])}
            aria-label="选择要上传的文件"
          />
          <span className="hint">{busy ? "正在保存到本机…" : "文件只保存在本机浏览器，不会上传到任何服务器。"}</span>
        </div>
      )}

      {message && <p className="backup-status">{message}</p>}
      <p className="hint">
        已登记 {store.resources.length} 个资料 · 上传文件 {store.userFiles.length} 个。
      </p>
    </section>
  );
}
