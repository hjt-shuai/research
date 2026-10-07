"use client";

import { useEffect, useMemo, useState } from "react";
import { useLibrary } from "../useLibrary";
import { trendSeries, type TrendPoint } from "@/lib/db/service";
import {
  CURRENT_PREP_YEAR,
  FACT_ORIGIN_LABEL,
  SCHOOL_YEARS,
  SCHOOL_YEAR_STATUS_LABEL,
  SOURCE_TYPE_LABEL,
  TARGET_YEAR,
  type FactOrigin,
  type School,
  type SchoolYearData,
  type SchoolYearStatus,
} from "@/lib/db/types";

/* =========================================================================
 * 院校情报（§3 院校档案 / §19 手动录入官网 / §20 年度档案 / §21 年度趋势）
 * 三条硬规则：
 *  1. 所有数字与日期都来自本地 store，绝不凭空生成招生人数 / 复试线 / 录取数据；
 *  2. 空字符串统一显示「暂无官方数据」，绝不渲染 0 / - / 猜测值；
 *  3. 每个值旁边尽量保留来源（来源名 + 官方链接），方便逐条核对。
 * ========================================================================= */

const EMPTY_TEXT = "暂无官方数据";
const EMPTY_TREND = "暂无数据";

/** 是否真的填了值（空字符串 = 暂无官方数据） */
function hasValue(value: string): boolean {
  return value.trim().length > 0;
}

/** 纯文本兜底：空值 → 暂无官方数据（用于 <title> 之类的字符串场景） */
function text(value: string): string {
  return hasValue(value) ? value.trim() : EMPTY_TEXT;
}

/** 空值统一渲染成灰色「暂无官方数据」，不渲染 0 / - / 猜测值 */
function Val({ value }: { value: string }) {
  if (!hasValue(value)) return <span className="trend-null">{EMPTY_TEXT}</span>;
  return <span>{value.trim()}</span>;
}

/** 统考科目代码 → 显示简称（只做显示压缩，科目本身仍取自 store 的考试科目字段） */
const SUBJECT_SHORT: Record<string, string | undefined> = {
  "101": "101政治",
  "201": "201英语一",
  "301": "301数学一",
  "408": "408",
};

/** 把 store 里的「101 政治 / 201 英语一 / 301 数学一 / 408 计算机学科专业基础」压成备考口径短句 */
function compactSubjects(raw: string): string {
  const codes = [...new Set(raw.match(/\b(?:101|201|301|408)\b/g) ?? [])];
  if (!codes.length) return text(raw);
  return codes.map((c) => SUBJECT_SHORT[c] ?? c).join(" / ");
}

/* ---------------------------- 院校字段表 ---------------------------- */

type SchoolFieldKey =
  | "name"
  | "code"
  | "province"
  | "admissionUrl"
  | "collegeUrl"
  | "majorName"
  | "majorCode"
  | "studyMode"
  | "duration"
  | "tuition"
  | "examSubjects"
  | "planEnroll"
  | "recommendedQuota"
  | "retestLine"
  | "admissionCount"
  | "minScore"
  | "avgScore"
  | "retestRatio"
  | "retestSubjects"
  | "machineTest"
  | "directions"
  | "tutorDirections";

/** 详情展示顺序 = 需求里的字段顺序（全部来自 store.schools，空值显示「暂无官方数据」） */
const SCHOOL_FIELDS: { key: SchoolFieldKey; label: string }[] = [
  { key: "name", label: "学校名称" },
  { key: "code", label: "学校代码" },
  { key: "province", label: "省份" },
  { key: "admissionUrl", label: "研究生招生官网" },
  { key: "collegeUrl", label: "学院官网" },
  { key: "majorName", label: "目标专业" },
  { key: "majorCode", label: "专业代码" },
  { key: "studyMode", label: "学习方式" },
  { key: "duration", label: "学制" },
  { key: "tuition", label: "学费" },
  { key: "examSubjects", label: "考试科目" },
  { key: "planEnroll", label: "招生人数" },
  { key: "recommendedQuota", label: "推免人数" },
  { key: "retestLine", label: "复试线" },
  { key: "admissionCount", label: "录取人数" },
  { key: "minScore", label: "录取最低分" },
  { key: "avgScore", label: "录取平均分" },
  { key: "retestRatio", label: "复试比例" },
  { key: "retestSubjects", label: "复试科目" },
  { key: "machineTest", label: "是否机试" },
  { key: "directions", label: "专业方向" },
  { key: "tutorDirections", label: "导师方向" },
];

/** 这两个字段本身是网址，非空时渲染成可点链接 */
function isUrlField(key: SchoolFieldKey): boolean {
  return key === "admissionUrl" || key === "collegeUrl";
}

type SchoolDraft = Partial<Record<SchoolFieldKey, string>>;

function schoolDraftOf(school: School): SchoolDraft {
  const draft: SchoolDraft = {};
  for (const f of SCHOOL_FIELDS) draft[f.key] = school[f.key];
  return draft;
}

/**
 * 手动填写的官网地址同步进「官方资料链接」：
 * 同名条目就地更新，缺少的追加，其余已收录的官方链接一律不动（不猜 URL）。
 */
function mergeOfficialLinks(
  links: { label: string; url: string }[],
  admissionUrl: string,
  collegeUrl: string,
): { label: string; url: string }[] {
  let next = [...links];
  const upsert = (label: string, raw: string) => {
    const url = raw.trim();
    if (!url) return;
    const i = next.findIndex((l) => l.label === label);
    if (i >= 0) next = next.map((l, idx) => (idx === i ? { label, url } : l));
    else if (!next.some((l) => l.url === url)) next = [...next, { label, url }];
  };
  upsert("研究生招生网", admissionUrl);
  upsert("学院官网", collegeUrl);
  return next;
}

/** 在官方资料链接里按关键字找一条；找不到返回 null（不猜 URL） */
function findOfficialLink(school: School, keyword: string): { label: string; url: string } | null {
  return school.officialLinks.find((l) => l.label.includes(keyword) && hasValue(l.url)) ?? null;
}

/* ---------------------------- 年度档案 ---------------------------- */

const STATUS_BADGE: Record<SchoolYearStatus, string> = {
  PUBLISHED: "badge is-current",
  PENDING: "badge is-review",
  UNKNOWN: "badge",
};

type YearDraft = {
  status: SchoolYearStatus;
  examSubjects: string;
  planEnroll: string;
  recommendedQuota: string;
  retestLine: string;
  admissionCount: string;
  note: string;
  evidenceText: string;
  evidenceUrl: string;
};

function yearDraftOf(row: SchoolYearData): YearDraft {
  return {
    status: row.status,
    examSubjects: row.examSubjects,
    planEnroll: row.planEnroll,
    recommendedQuota: row.recommendedQuota,
    retestLine: row.retestLine,
    admissionCount: row.admissionCount,
    note: row.note,
    evidenceText: row.evidenceText,
    evidenceUrl: row.evidenceUrl,
  };
}

/** 年度档案里的一个文本单元格：编辑态是输入框，阅读态空值显示「暂无官方数据」 */
function YearCell({
  editing,
  label,
  year,
  value,
  onChange,
}: {
  editing: boolean;
  label: string;
  year: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <td>
      {editing ? (
        <div className="field" style={{ minWidth: 104 }}>
          <input
            value={value}
            aria-label={`${year} 年${label}`}
            placeholder="留空 = 暂无官方数据"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      ) : (
        <Val value={value} />
      )}
    </td>
  );
}

function YearRow({
  row,
  sourceName,
  editing,
  draft,
  onEdit,
  onDraft,
  onCancel,
  onSave,
}: {
  row: SchoolYearData;
  sourceName: string;
  editing: boolean;
  draft: YearDraft;
  onEdit: () => void;
  onDraft: (patch: Partial<YearDraft>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const origin: FactOrigin = row.verifiedLevel;
  const originClass =
    origin === "OFFICIAL"
      ? "fact-from is-official"
      : origin === "THIRD_PARTY"
        ? "fact-from is-third_party"
        : "fact-from";

  return (
    <tr>
      <td className="num">
        <span className="badge is-year">{row.year}</span>
      </td>

      {/* 状态：PUBLISHED 已发布 / PENDING 待官方发布 / UNKNOWN 待核实 */}
      <td>
        {editing ? (
          <div className="field" style={{ minWidth: 112 }}>
            <select
              value={draft.status}
              aria-label={`${row.year} 年状态`}
              onChange={(e) => onDraft({ status: e.target.value as SchoolYearStatus })}
            >
              {(Object.keys(SCHOOL_YEAR_STATUS_LABEL) as SchoolYearStatus[]).map((s) => (
                <option key={s} value={s}>
                  {SCHOOL_YEAR_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className={STATUS_BADGE[row.status]}>{SCHOOL_YEAR_STATUS_LABEL[row.status]}</span>
        )}
      </td>

      <YearCell
        editing={editing}
        label="考试科目"
        year={row.year}
        value={editing ? draft.examSubjects : row.examSubjects}
        onChange={(v) => onDraft({ examSubjects: v })}
      />
      <YearCell
        editing={editing}
        label="招生人数"
        year={row.year}
        value={editing ? draft.planEnroll : row.planEnroll}
        onChange={(v) => onDraft({ planEnroll: v })}
      />
      <YearCell
        editing={editing}
        label="推免人数"
        year={row.year}
        value={editing ? draft.recommendedQuota : row.recommendedQuota}
        onChange={(v) => onDraft({ recommendedQuota: v })}
      />
      <YearCell
        editing={editing}
        label="复试线"
        year={row.year}
        value={editing ? draft.retestLine : row.retestLine}
        onChange={(v) => onDraft({ retestLine: v })}
      />
      <YearCell
        editing={editing}
        label="录取人数"
        year={row.year}
        value={editing ? draft.admissionCount : row.admissionCount}
        onChange={(v) => onDraft({ admissionCount: v })}
      />
      <YearCell
        editing={editing}
        label="备注"
        year={row.year}
        value={editing ? draft.note : row.note}
        onChange={(v) => onDraft({ note: v })}
      />

      {/* 证据：官方原文 + 官方链接 + 可信等级（人工录入后标记为「我录入」） */}
      <td>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="field" style={{ minWidth: 150 }}>
              <input
                value={draft.evidenceText}
                aria-label={`${row.year} 年证据原文`}
                placeholder="官方原文（可留空）"
                onChange={(e) => onDraft({ evidenceText: e.target.value })}
              />
            </div>
            <div className="field" style={{ minWidth: 150 }}>
              <input
                value={draft.evidenceUrl}
                aria-label={`${row.year} 年证据链接`}
                placeholder="https://"
                onChange={(e) => onDraft({ evidenceUrl: e.target.value })}
              />
            </div>
          </div>
        ) : !hasValue(row.evidenceText) && !hasValue(row.evidenceUrl) && !sourceName ? (
          <Val value="" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className={originClass}>{FACT_ORIGIN_LABEL[origin]}</span>
            {hasValue(row.evidenceText) ? <span>「{row.evidenceText.trim()}」</span> : null}
            {hasValue(row.evidenceUrl) ? (
              <>
                <a href={row.evidenceUrl.trim()} target="_blank" rel="noopener noreferrer">
                  打开官方原文
                </a>
                <span className="hint" style={{ marginTop: 0, wordBreak: "break-all" }}>
                  {row.evidenceUrl.trim()}
                </span>
              </>
            ) : null}
            {sourceName ? (
              <span className="hint" style={{ marginTop: 0 }}>
                来源：{sourceName}
              </span>
            ) : null}
          </div>
        )}
      </td>

      <td>
        {editing ? (
          <div className="res-actions">
            <button
              type="button"
              className="primary-btn"
              style={{ padding: "6px 12px", fontSize: 12 }}
              onClick={onSave}
            >
              保存
            </button>
            <button type="button" className="ghost-btn tiny" onClick={onCancel}>
              取消
            </button>
          </div>
        ) : (
          <button type="button" className="ghost-btn tiny" onClick={onEdit}>
            编辑
          </button>
        )}
      </td>
    </tr>
  );
}

/* ---------------------------- 年度趋势（§21） ---------------------------- */

/**
 * 极简柱状图：只用 CSS 高度，不引图表库。
 * value === null 的年份显示「暂无数据」，绝不按 0 画（§21）。
 */
function TrendBars({
  title,
  points,
  sourceLabel,
  sourceUrl,
}: {
  title: string;
  points: TrendPoint[];
  sourceLabel: string;
  sourceUrl: string;
}) {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const max = values.length ? Math.max(...values) : 0;

  return (
    <div>
      <p className="res-detail-title">{title}</p>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 132 }}>
        {points.map((p) => (
          <div
            key={p.year}
            style={{
              flex: "1 1 0",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 4,
            }}
          >
            {p.value === null ? (
              <span className="trend-null">{EMPTY_TREND}</span>
            ) : (
              <>
                <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {p.value}
                </span>
                <span
                  style={{
                    width: "100%",
                    maxWidth: 54,
                    height: Math.max(6, Math.round((p.value / Math.max(max, 1)) * 86)),
                    background: "var(--accent)",
                    borderRadius: "6px 6px 0 0",
                    opacity: 0.85,
                  }}
                />
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        {points.map((p) => (
          <span key={p.year} className="stat-label" style={{ flex: "1 1 0", textAlign: "center" }}>
            {p.year}
          </span>
        ))}
      </div>
      <ul className="res-source-list" style={{ marginTop: 8 }}>
        {points
          .filter((p) => p.value !== null && p.label.trim() && p.label.trim() !== String(p.value))
          .map((p) => (
            <li key={`raw-${p.year}`} className="hint" style={{ marginTop: 0 }}>
              {p.year} 原始记录：{p.label.trim()}
            </li>
          ))}
      </ul>
      <p className="hint">
        数据来源：
        {hasValue(sourceUrl) ? (
          <>
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              {hasValue(sourceLabel) ? sourceLabel : "官方页面"}
            </a>
            <span style={{ wordBreak: "break-all" }}> · {sourceUrl}</span>
          </>
        ) : (
          EMPTY_TEXT
        )}
      </p>
    </div>
  );
}

/* ---------------------------- 新增院校 ---------------------------- */

type AddDraft = {
  name: string;
  code: string;
  province: string;
  admissionUrl: string;
  collegeUrl: string;
  majorName: string;
  majorCode: string;
};

const EMPTY_ADD_DRAFT: AddDraft = {
  name: "",
  code: "",
  province: "",
  admissionUrl: "",
  collegeUrl: "",
  majorName: "",
  majorCode: "",
};

/* =========================================================================
 * 主组件
 * ========================================================================= */

export default function SchoolIntel() {
  const { store, editSchool, editSchoolYear, ensureSchoolYear, addSchool } = useLibrary();

  /** 院校列表：目标院校（电子科技大学，isTarget=true）排在最前，其余保持内置顺序 */
  const schools = useMemo(
    () => [...store.schools].sort((a, b) => Number(b.isTarget) - Number(a.isTarget)),
    [store.schools],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const school = useMemo(
    () => schools.find((s) => s.id === selectedId) ?? schools[0] ?? null,
    [schools, selectedId],
  );
  const schoolId = school?.id ?? null;

  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [yearDraft, setYearDraft] = useState<YearDraft | null>(null);
  const [yearMessage, setYearMessage] = useState("");

  const [schoolDraft, setSchoolDraft] = useState<SchoolDraft | null>(null);
  const [schoolMessage, setSchoolMessage] = useState("");

  const [addDraft, setAddDraft] = useState<AddDraft>(EMPTY_ADD_DRAFT);
  const [addMessage, setAddMessage] = useState("");

  /* 切换院校时清空编辑态，避免把 A 校的草稿写进 B 校 */
  useEffect(() => {
    setEditingYearId(null);
    setYearDraft(null);
    setYearMessage("");
    setSchoolDraft(null);
    setSchoolMessage("");
  }, [schoolId]);

  /**
   * §20 年度档案：选中院校缺哪一年就补一行空档案。
   * 补完之后判断条件不再成立，因此不会反复触发（不存在循环）。
   */
  useEffect(() => {
    if (!schoolId) return;
    const missing = SCHOOL_YEARS.filter(
      (year) => !store.schoolYears.some((r) => r.schoolId === schoolId && r.year === year),
    );
    for (const year of missing) ensureSchoolYear(schoolId, year);
  }, [schoolId, store.schoolYears, ensureSchoolYear]);

  const yearRows = useMemo(
    () =>
      schoolId
        ? store.schoolYears.filter((r) => r.schoolId === schoolId).sort((a, b) => a.year - b.year)
        : [],
    [store.schoolYears, schoolId],
  );

  const schoolSources = useMemo(
    () => (schoolId ? store.sources.filter((s) => s.schoolId === schoolId) : []),
    [store.sources, schoolId],
  );

  const sourceNameOf = useMemo(() => {
    const map = new Map(store.sources.map((s) => [s.id, s.sourceName]));
    return (id: string | null) => (id ? map.get(id) ?? "" : "");
  }, [store.sources]);

  /* 趋势数据：全部由 trendSeries 从 store.schoolYears 计算（缺失年份 value = null） */
  const retestPoints = school ? trendSeries(store.schoolYears, school.id, "retestLine", SCHOOL_YEARS) : [];
  const planPoints = school ? trendSeries(store.schoolYears, school.id, "planEnroll", SCHOOL_YEARS) : [];

  /**
   * 数据来源链接：优先「院校官方资料链接」→ 已收录信息源 → 研究生招生官网；
   * 三级都没有就显示「暂无官方数据」（绝不编造链接）。
   */
  const linkSource = useMemo(() => {
    const admissionLink =
      school && hasValue(school.admissionUrl)
        ? { label: "研究生招生官网", url: school.admissionUrl.trim() }
        : null;
    const fromOfficial = (keyword: string) => (school ? findOfficialLink(school, keyword) : null);
    const fromSources = (keyword: string) => {
      const hit = schoolSources.find((s) => s.sourceName.includes(keyword) && hasValue(s.url));
      return hit ? { label: hit.sourceName, url: hit.url.trim() } : null;
    };
    // 官网栏目名是「硕士历年复试分数线」，「复试线」并不是它的子串，所以按「分数线」匹配
    const retest = fromOfficial("分数线") ?? fromOfficial("复试") ?? fromSources("分数线") ?? admissionLink;
    const plan = fromOfficial("专业目录") ?? fromOfficial("招生") ?? fromSources("招生目录") ?? admissionLink;
    return { retest, plan };
  }, [school, schoolSources]);
  const retestSource = linkSource.retest;
  const planSource = linkSource.plan;

  const targetYearRow = yearRows.find((r) => r.year === TARGET_YEAR) ?? null;
  /**
   * 「最新官方资料」按官网实际发布情况推导，不写死年份。
   * 依据：电子科技大学研招网对 2027/2028 目录返回「尚未开放」，
   * 因此这里只会显示已发布的年份（当前为 2026），其余列入「待官方发布」。
   */
  const latestPublishedYear = yearRows
    .filter((r) => r.status === "PUBLISHED")
    .reduce<number | null>((max, r) => (max == null || r.year > max ? r.year : max), null);
  const pendingYears = yearRows
    .filter((r) => r.status === "PENDING")
    .map((r) => r.year)
    .sort((a, b) => b - a);
  const missingUrlCount = store.schools.filter((s) => !hasValue(s.admissionUrl)).length;
  /** 非目标院校数量：内置数据里有 9 所，官网地址一律留空由用户手填 */
  const nonTargetCount = store.schools.filter((s) => !s.isTarget).length;

  /* ---------------- 编辑：年度档案 ---------------- */

  const startYearEdit = (row: SchoolYearData) => {
    setEditingYearId(row.id);
    setYearDraft(yearDraftOf(row));
    setYearMessage("");
  };

  const saveYearEdit = (row: SchoolYearData) => {
    if (!yearDraft) return;
    editSchoolYear(row.id, {
      status: yearDraft.status,
      examSubjects: yearDraft.examSubjects.trim(),
      planEnroll: yearDraft.planEnroll.trim(),
      recommendedQuota: yearDraft.recommendedQuota.trim(),
      retestLine: yearDraft.retestLine.trim(),
      admissionCount: yearDraft.admissionCount.trim(),
      note: yearDraft.note.trim(),
      evidenceText: yearDraft.evidenceText.trim(),
      // 证据链接：填了就用你填的，没填保留原有链接（绝不猜 URL）
      evidenceUrl: yearDraft.evidenceUrl.trim() || row.evidenceUrl,
      // 人工录入的值标记为「我录入」（FACT_ORIGIN_LABEL.USER = 我录入）
      verifiedLevel: "USER",
    });
    setEditingYearId(null);
    setYearDraft(null);
    setYearMessage(`${row.year} 年档案已保存：数据来自你的手工录入，可信等级已标记为「我录入」。`);
  };

  /* ---------------- 编辑：院校资料 ---------------- */

  const setSchoolField = (key: SchoolFieldKey, value: string) => {
    setSchoolDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const saveSchoolDraft = () => {
    if (!school || !schoolDraft) return;
    const patch: Partial<School> = {};
    for (const f of SCHOOL_FIELDS) patch[f.key] = (schoolDraft[f.key] ?? "").trim();
    patch.officialLinks = mergeOfficialLinks(
      school.officialLinks,
      patch.admissionUrl ?? "",
      patch.collegeUrl ?? "",
    );
    editSchool(school.id, patch);
    setSchoolDraft(null);
    setSchoolMessage("院校资料已保存（本地保存）。留空的字段仍然显示「暂无官方数据」。");
  };

  /* ---------------- 新增院校 ---------------- */

  const submitAdd = () => {
    if (!hasValue(addDraft.name)) {
      setAddMessage("请先填写学校名称。");
      return;
    }
    const name = addDraft.name.trim();
    const id = addSchool({
      name,
      code: addDraft.code.trim(),
      province: addDraft.province.trim(),
      admissionUrl: addDraft.admissionUrl.trim(),
      collegeUrl: addDraft.collegeUrl.trim(),
      majorName: addDraft.majorName.trim(),
      majorCode: addDraft.majorCode.trim(),
    });
    setSelectedId(id);
    setAddDraft(EMPTY_ADD_DRAFT);
    setAddMessage(`已新增院校「${name}」，并切换为当前查看的院校；官方网址可随时用「编辑资料」补充。`);
  };

  return (
    <div className="sub-page">
      <header className="sub-page-head">
        <div>
          <p className="eyebrow">院校情报</p>
          <h1 className="page-title-sm">院校情报库</h1>
        </div>
      </header>
      <p className="section-note">
        只收录可核验的官方信息：未核实的字段一律显示「暂无官方数据」，不用 0 或估计值填充；每条值旁边保留来源与官方链接。
      </p>

      {/* ---------------- 院校列表 ---------------- */}
      <section className="card" aria-label="院校列表">
        <div className="section-head-row">
          <h2 className="section-title">院校列表</h2>
          <span className="hint" style={{ marginTop: 0 }}>
            共 {store.schools.length} 所院校 · 目标院校 {schools.filter((s) => s.isTarget).length} 所
          </span>
        </div>
        {schools.length ? (
          <div className="filter-bar" role="tablist" aria-label="选择院校" style={{ margin: 0 }}>
            {schools.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === schoolId}
                className={`chip${s.id === schoolId ? " is-active" : ""}`}
                onClick={() => setSelectedId(s.id)}
              >
                {s.name}
                {s.isTarget ? " · 目标院校" : ""}
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-note">本地库里还没有院校档案，请在下方「添加学校」中录入第一所院校。</p>
        )}
      </section>

      {school ? (
        <div className="main" style={{ marginTop: 24 }}>
          {/* ---------------- 当前状态（目标院校） ---------------- */}
          {school.isTarget ? (
            <section
              className="card"
              aria-label="当前状态"
              style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}
            >
              <div className="section-head-row">
                <h2 className="section-title">当前状态</h2>
                <span className="badge is-current">目标院校</span>
              </div>
              <p style={{ fontSize: 16, fontWeight: 700 }}>{TARGET_YEAR}考研准备中</p>
              <ul className="intel-list" style={{ marginTop: 12 }}>
                <li className="intel-item">
                  {/* 按官方实际发布情况显示，不写死年份：
                      目前官网只有 2026 已发布，2027/2028 均显示「尚未开放」 */}
                  最新官方资料：
                  {latestPublishedYear != null ? `${latestPublishedYear} 招生信息` : "暂无官方数据"}
                  {pendingYears.length > 0 ? `（${pendingYears.join(" / ")} 招生信息待官方发布）` : ""}
                </li>
                <li className="intel-item">
                  {TARGET_YEAR}状态：
                  {targetYearRow ? SCHOOL_YEAR_STATUS_LABEL[targetYearRow.status] : SCHOOL_YEAR_STATUS_LABEL.UNKNOWN}
                </li>
                <li className="intel-item">
                  当前考试科目：{compactSubjects(school.examSubjects)}
                </li>
              </ul>
              <p className="hint">以上为当前备考口径，{TARGET_YEAR} 招生目录发布后校准。</p>
            </section>
          ) : null}

          {/* ---------------- 院校档案（带来源） ---------------- */}
          <section className="card" aria-label="院校档案">
            <div className="section-head-row">
              <h2 className="section-title">
                {text(school.name)}
                <span className="badge is-year" style={{ marginLeft: 10 }}>
                  {text(school.code)}
                </span>
              </h2>
              {schoolDraft ? (
                <span className="hint" style={{ marginTop: 0 }}>
                  正在编辑资料
                </span>
              ) : (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setSchoolDraft(schoolDraftOf(school));
                    setSchoolMessage("");
                  }}
                >
                  编辑资料
                </button>
              )}
            </div>
            <p className="section-note">
              值全部来自本地资料库；空字符串统一显示「暂无官方数据」。
              {school.fieldSources && Object.keys(school.fieldSources).length
                ? " 带「来源」小字的字段是已核验字段，后面跟着官方原文说明与链接。"
                : ""}
            </p>

            {schoolDraft ? (
              <>
                <div className="form-grid">
                  {SCHOOL_FIELDS.map((f) => (
                    <label key={f.key}>
                      {f.label}
                      <input
                        value={schoolDraft[f.key] ?? ""}
                        aria-label={f.label}
                        placeholder={isUrlField(f.key) ? "https://" : "留空 = 暂无官方数据"}
                        onChange={(e) => setSchoolField(f.key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <div className="goals-edit-actions">
                  <button type="button" className="primary-btn" onClick={saveSchoolDraft}>
                    保存资料
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => setSchoolDraft(null)}>
                    取消
                  </button>
                  <span className="hint">
                    空值请留空：不要用 0 或「-」代替缺失数据；官网地址可以手动填写（不猜 URL）。
                  </span>
                </div>
              </>
            ) : (
              <div className="grid-2">
                {SCHOOL_FIELDS.map((f) => {
                  const fs: School["fieldSources"][string] | undefined = school.fieldSources[f.key];
                  const raw = school[f.key];
                  return (
                    <div className="stat-tile" key={f.key}>
                      <span className="stat-label">{f.label}</span>
                      <span
                        className="stat-value"
                        style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5, wordBreak: "break-word" }}
                      >
                        {hasValue(raw) ? (
                          isUrlField(f.key) ? (
                            <a href={raw.trim()} target="_blank" rel="noopener noreferrer">
                              {raw.trim()}
                            </a>
                          ) : (
                            raw.trim()
                          )
                        ) : (
                          <span className="trend-null">{EMPTY_TEXT}</span>
                        )}
                      </span>
                      {fs && (hasValue(fs.note) || hasValue(fs.url) || fs.sourceId) ? (
                        <span className="hint" style={{ display: "block", marginTop: 4 }}>
                          {hasValue(fs.note) ? fs.note : "已核验字段"}
                          {fs.sourceId && sourceNameOf(fs.sourceId) ? ` · 来源：${sourceNameOf(fs.sourceId)}` : ""}
                          {hasValue(fs.url) ? (
                            <>
                              {" · "}
                              <a href={fs.url} target="_blank" rel="noopener noreferrer">
                                官方原文
                              </a>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {schoolMessage ? <p className="backup-status">{schoolMessage}</p> : null}

            <div className="res-detail" style={{ marginTop: 16 }}>
              <div>
                <p className="res-detail-title">官方资料链接</p>
                {school.officialLinks.filter((l) => hasValue(l.url)).length ? (
                  <ul className="res-source-list">
                    {school.officialLinks
                      .filter((l) => hasValue(l.url))
                      .map((l) => (
                        <li key={`${l.label}-${l.url}`}>
                          <a href={l.url} target="_blank" rel="noopener noreferrer">
                            {hasValue(l.label) ? l.label : l.url}
                          </a>
                          <span className="hint" style={{ marginTop: 0, wordBreak: "break-all" }}>
                            {l.url}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="empty-note">
                    暂无官方数据：这所院校还没有登记官方资料链接，可点上方「编辑资料」手动填写官网地址（不猜 URL）。
                  </p>
                )}
              </div>

              <div>
                <p className="res-detail-title">已收录信息源（{schoolSources.length}）</p>
                {schoolSources.length ? (
                  <ul className="res-source-list">
                    {schoolSources.map((s) => (
                      <li key={s.id}>
                        <span className="badge">{SOURCE_TYPE_LABEL[s.sourceType]}</span> {s.sourceName}
                        {hasValue(s.url) ? (
                          <>
                            {" · "}
                            <a href={s.url} target="_blank" rel="noopener noreferrer">
                              {s.url}
                            </a>
                          </>
                        ) : (
                          <> · {EMPTY_TEXT}</>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-note">
                    暂无官方数据：还没有为这所院校登记信息源，可在资料中心添加后参与自动检查。
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ---------------- 年度档案（§20） ---------------- */}
          <section className="card" aria-label="年度档案">
            <div className="section-head-row">
              <h2 className="section-title">年度档案</h2>
              <span className="hint" style={{ marginTop: 0 }}>
                {SCHOOL_YEARS[0]} – {SCHOOL_YEARS[SCHOOL_YEARS.length - 1]} 共 {yearRows.length} 个年度
              </span>
            </div>
            <p className="section-note">
              每个年度单独一行：状态取官方口径（已发布 / 待官方发布 / 待核实），空单元格显示「暂无官方数据」。
              点行尾「编辑」可 inline 修改；人工填写的值会标记为「我录入」并保留你填写的证据链接。
            </p>

            {yearRows.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>年份</th>
                      <th>状态</th>
                      <th>考试科目</th>
                      <th>招生人数</th>
                      <th>推免人数</th>
                      <th>复试线</th>
                      <th>录取人数</th>
                      <th>备注</th>
                      <th>证据</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearRows.map((row) => (
                      <YearRow
                        key={row.id}
                        row={row}
                        sourceName={sourceNameOf(row.sourceId)}
                        editing={editingYearId === row.id}
                        draft={editingYearId === row.id && yearDraft ? yearDraft : yearDraftOf(row)}
                        onEdit={() => startYearEdit(row)}
                        onDraft={(patch) => setYearDraft((d) => (d ? { ...d, ...patch } : d))}
                        onCancel={() => {
                          setEditingYearId(null);
                          setYearDraft(null);
                        }}
                        onSave={() => saveYearEdit(row)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-note">暂无官方数据：这所院校还没有年度档案。</p>
            )}

            {yearMessage ? <p className="backup-status">{yearMessage}</p> : null}
          </section>

          {/* ---------------- 年度趋势（§21） ---------------- */}
          <section className="card" aria-label="年度趋势">
            <div className="section-head-row">
              <h2 className="section-title">年度趋势（{SCHOOL_YEARS[0]} – {SCHOOL_YEARS[SCHOOL_YEARS.length - 1]}）</h2>
              <span className="hint" style={{ marginTop: 0 }}>
                缺失年份按「暂无数据」处理，不按 0 计算
              </span>
            </div>
            <p className="section-note">
              趋势由年度档案（store.schoolYears）逐年计算得出。复试线数据来源：
              {retestSource ? (
                <a href={retestSource.url} target="_blank" rel="noopener noreferrer">
                  {retestSource.label}
                </a>
              ) : (
                EMPTY_TEXT
              )}
            </p>
            <div className="grid-2">
              <TrendBars
                title={`复试线（${text(school.name)}）`}
                points={retestPoints}
                sourceLabel={retestSource?.label ?? ""}
                sourceUrl={retestSource?.url ?? ""}
              />
              <TrendBars
                title={`招生计划（${text(school.name)}）`}
                points={planPoints}
                sourceLabel={planSource?.label ?? ""}
                sourceUrl={planSource?.url ?? ""}
              />
            </div>
          </section>
        </div>
      ) : (
        <p className="empty-note" style={{ marginTop: 24 }}>
          暂无官方数据：本地库里还没有院校档案。
        </p>
      )}

      {/* ---------------- 添加学校（§3 / §19） ---------------- */}
      <section className="card" aria-label="添加学校" style={{ marginTop: 24 }}>
        <div className="section-head-row">
          <h2 className="section-title">添加学校</h2>
          <span className="hint" style={{ marginTop: 0 }}>
            新增后自动切换为当前查看的院校
          </span>
        </div>
        <p className="section-note">
          官方网址按「不猜 URL」原则留空：内置的 {nonTargetCount} 所非目标院校都没有预填官网地址，需要你手动填写；
          当前还有 {missingUrlCount} 所院校尚未填写研究生招生官网。请打开官网核对后再粘贴链接。
        </p>

        <div className="form-grid">
          {(
            [
              ["name", "学校名称", "例如：电子科技大学"],
              ["code", "学校代码", "例如：10614"],
              ["province", "省份", "例如：四川省成都市"],
              ["admissionUrl", "研究生招生官网", "https://"],
              ["collegeUrl", "学院官网", "https://"],
              ["majorName", "目标专业", "例如：计算机技术（全日制专硕）"],
              ["majorCode", "专业代码", "例如：085404"],
            ] as [keyof AddDraft, string, string][]
          ).map(([key, label, placeholder]) => (
            <label key={key}>
              {label}
              <input
                value={addDraft[key]}
                aria-label={label}
                placeholder={placeholder}
                onChange={(e) => setAddDraft((d) => ({ ...d, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="goals-edit-actions">
          <button type="button" className="primary-btn" onClick={submitAdd}>
            添加学校
          </button>
          <span className="hint">
            招生人数 / 复试线 / 录取数据不要在这里猜：先建档案，再按年度从官方页面逐条录入。
          </span>
        </div>
        {addMessage ? <p className="backup-status">{addMessage}</p> : null}
        <p className="hint">
          本地库现有 {store.schools.length} 所院校、{store.schoolYears.length} 条年度档案、{store.sources.length} 个信息源。
        </p>
      </section>
    </div>
  );
}
