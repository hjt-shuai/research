"use client";

import { useMemo, useState } from "react";
import { useLibrary } from "../useLibrary";
import {
  EXAM_TYPE_LABEL,
  QUESTION_SUBJECT_LABEL,
  QUESTION_TYPE_LABEL,
  type ExamType,
  type Question,
  type QuestionSubject,
  type QuestionType,
  type Resource,
} from "@/lib/db/types";
import { kpLabel, kpOptions, masteryIdOf } from "@/lib/db/kp";
import { recommendForKp, wrongStats } from "@/lib/db/service";
import { computeMastery, defaultMastery, kpMastery } from "@/lib/knowledge";
import { STUDY_STATUS_LABEL } from "@/lib/types";

/**
 * 真题库 / 错题库。
 *
 * 版权口径（§14）：本页只登记「题目元数据 + 你自己的解析」，不抓取、不内置、
 * 不转存任何受版权保护的真题原文 / 试卷 PDF；想做题时用「合法来源链接」或
 * 「我自己拥有的文件」两种方式打开。
 *
 * 删除是软删除：只在备注前加 [已删除] 前缀并把掌握度置 0，绝不从数组里 splice，
 * 避免误删历史（要恢复只需去掉前缀）。
 */
const DELETED_PREFIX = "[已删除]";

const SUBJECT_KEYS = Object.keys(QUESTION_SUBJECT_LABEL) as QuestionSubject[];
const EXAM_TYPE_KEYS = Object.keys(EXAM_TYPE_LABEL) as ExamType[];
const QUESTION_TYPE_KEYS = Object.keys(QUESTION_TYPE_LABEL) as QuestionType[];
const DIFFICULTIES = [0, 1, 2, 3, 4, 5];
/** 未掌握线：掌握度低于该值视为未掌握 */
const UNMASTERED_LINE = 60;

function isDeleted(q: Question): boolean {
  return q.note.startsWith(DELETED_PREFIX);
}

/** 行内编辑草稿：只允许改备注 / 答案 / 难度，是否算错仍由按钮决定 */
type EditDraft = {
  note: string;
  correctAnswer: string;
  userAnswer: string;
  difficulty: number;
};

export default function QuestionBank() {
  const { store, addQuestion, editQuestion, markWrong, markFixed } = useLibrary();

  /* ------------------------------ 录入表单 ------------------------------ */

  const [fYear, setFYear] = useState("");
  const [fSubject, setFSubject] = useState<QuestionSubject>("CS_408");
  const [fExamType, setFExamType] = useState<ExamType>("REAL");
  const [fPaper, setFPaper] = useState("");
  const [fSection, setFSection] = useState("");
  const [fNumber, setFNumber] = useState("");
  const [fType, setFType] = useState<QuestionType>("CHOICE");
  const [fKp, setFKp] = useState(() => kpOptions("CS_408")[0]?.id ?? "");
  const [fDifficulty, setFDifficulty] = useState(3);
  const [fCorrect, setFCorrect] = useState("");
  const [fUserAnswer, setFUserAnswer] = useState("");
  const [fNote, setFNote] = useState("");
  const [fSourceUrl, setFSourceUrl] = useState("");
  const [message, setMessage] = useState("");

  // 知识点下拉跟随科目；408 会在 kpOptions 里展开到章节级（如「数据结构 · 线性表」）
  const formKpOptions = useMemo(() => kpOptions(fSubject), [fSubject]);

  const changeFormSubject = (next: QuestionSubject) => {
    setFSubject(next);
    setFKp(kpOptions(next)[0]?.id ?? "");
  };

  const submitQuestion = () => {
    if (!fPaper.trim() && !fNumber.trim()) {
      setMessage("请至少填写试卷名或题号，方便以后检索。");
      return;
    }
    const correct = fCorrect.trim();
    const mine = fUserAnswer.trim();
    // isWrong 完全由「我的答案与正确答案不同」判断：两者都填且不同才算错
    const wrong = correct !== "" && mine !== "" && mine !== correct;
    const yearNum = fYear.trim() ? Number(fYear) : NaN;

    addQuestion({
      year: Number.isFinite(yearNum) ? yearNum : null,
      subject: fSubject,
      examType: fExamType,
      paper: fPaper.trim(),
      section: fSection.trim(),
      questionNumber: fNumber.trim(),
      questionType: fType,
      knowledgePoint: fKp,
      difficulty: fDifficulty,
      sourceId: null,
      sourceUrl: fSourceUrl.trim(),
      userFileId: null,
      correctAnswer: correct,
      userAnswer: mine,
      isWrong: wrong,
      wrongCount: wrong ? 1 : 0,
      // 掌握度初值只看有没有错：做错 → 0，做对 → 100，之后靠「标记做错 / 重做正确」微调
      mastery: wrong ? 0 : 100,
      note: fNote.trim(),
    });

    setMessage(
      wrong
        ? `已录入并自动标记为错题：${kpLabel(fKp)}（错误次数从 1 开始，掌握度 0）。`
        : `已录入：${kpLabel(fKp)}（未判定为错题，掌握度按 100 记）。`,
    );
    // 保留年份 / 科目 / 类型等「一组题共用」的字段，只清空单题相关字段
    setFNumber("");
    setFCorrect("");
    setFUserAnswer("");
    setFNote("");
  };

  /* ------------------------------ 筛选 ------------------------------ */

  const [keyword, setKeyword] = useState("");
  const [yearFilter, setYearFilter] = useState<number | "ALL">("ALL");
  const [subjectFilter, setSubjectFilter] = useState<QuestionSubject | "ALL">("ALL");
  const [examTypeFilter, setExamTypeFilter] = useState<ExamType | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<QuestionType | "ALL">("ALL");
  const [kpFilter, setKpFilter] = useState<string | "ALL">("ALL");
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [onlyUnmastered, setOnlyUnmastered] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const q of store.questions) if (q.year != null) set.add(q.year);
    return [...set].sort((a, b) => b - a);
  }, [store.questions]);

  // 知识点筛选：限定科目时只列该科目的知识点，否则按科目分组列出全部
  const filterKpOptions = useMemo(() => {
    if (subjectFilter !== "ALL") {
      return kpOptions(subjectFilter).map((o) => ({ id: o.id, label: o.label }));
    }
    const out: { id: string; label: string }[] = [];
    for (const s of SUBJECT_KEYS) {
      for (const o of kpOptions(s)) out.push({ id: o.id, label: `${QUESTION_SUBJECT_LABEL[s]} · ${o.label}` });
    }
    return out;
  }, [subjectFilter]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return store.questions.filter((q) => {
      if (!showDeleted && isDeleted(q)) return false;
      if (subjectFilter !== "ALL" && q.subject !== subjectFilter) return false;
      if (yearFilter !== "ALL" && q.year !== yearFilter) return false;
      if (examTypeFilter !== "ALL" && q.examType !== examTypeFilter) return false;
      if (typeFilter !== "ALL" && q.questionType !== typeFilter) return false;
      if (kpFilter !== "ALL" && q.knowledgePoint !== kpFilter) return false;
      if (onlyWrong && !q.isWrong) return false;
      if (onlyUnmastered && q.mastery >= UNMASTERED_LINE) return false;
      if (kw) {
        // 关键词同时匹配试卷名 / 大题 / 题号 / 备注 / 知识点（含知识点中文名）
        const hay = [q.paper, q.section, q.questionNumber, q.note, q.knowledgePoint, kpLabel(q.knowledgePoint)]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [
    store.questions,
    keyword,
    yearFilter,
    subjectFilter,
    examTypeFilter,
    typeFilter,
    kpFilter,
    onlyWrong,
    onlyUnmastered,
    showDeleted,
  ]);

  const resetFilters = () => {
    setKeyword("");
    setYearFilter("ALL");
    setSubjectFilter("ALL");
    setExamTypeFilter("ALL");
    setTypeFilter("ALL");
    setKpFilter("ALL");
    setOnlyWrong(false);
    setOnlyUnmastered(false);
    setShowDeleted(false);
  };

  /* ------------------------------ 错题统计（§31） ------------------------------ */

  const stats = useMemo(() => wrongStats(store.questions), [store.questions]);
  const overview = useMemo(() => {
    const live = store.questions.filter((q) => !isDeleted(q));
    const kps = new Set(live.map((q) => q.knowledgePoint).filter(Boolean));
    return {
      total: live.length,
      wrong: live.filter((q) => q.isWrong).length,
      unmastered: live.filter((q) => q.mastery < UNMASTERED_LINE).length,
      kpCount: kps.size,
      deleted: store.questions.length - live.length,
    };
  }, [store.questions]);

  /* ------------------------------ 选中知识点 → 资料联动 + 掌握度 ------------------------------ */

  const [selectedKp, setSelectedKp] = useState<string | null>(null);

  // 选中的知识点渲染在上方联动区，选中后滚过去，避免点了卡片却看不到推荐
  const selectKp = (kpId: string) => {
    setSelectedKp(kpId);
    if (typeof document === "undefined") return;
    requestAnimationFrame(() => {
      document.getElementById("kp-rec")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const rec = useMemo(() => (selectedKp ? recommendForKp(store, selectedKp) : null), [store, selectedKp]);

  const recGroups: { title: string; items: Resource[] }[] = rec
    ? [
        { title: "对应教材 / 课程", items: rec.teaching },
        { title: "历年真题", items: rec.realPapers },
        { title: "其它资料", items: rec.others },
      ]
    : [];

  // 掌握度口径与首页 / 知识掌握度页一致：kpMastery = computeMastery(手动状态, 关联月度任务进度)
  const masteryKey = selectedKp ? masteryIdOf(selectedKp) : null;
  const masteryState = masteryKey ? store.mastery[masteryKey] ?? defaultMastery() : null;
  const masteryLinked = masteryKey ? kpMastery(masteryKey, store.mastery, store.tasks) : 0;
  const masteryManual = masteryKey ? computeMastery(store.mastery[masteryKey]) : 0;

  /* ------------------------------ 列表操作 ------------------------------ */

  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ note: "", correctAnswer: "", userAnswer: "", difficulty: 3 });

  const startEdit = (q: Question) => {
    setEditId(q.id);
    setDraft({
      note: q.note,
      correctAnswer: q.correctAnswer,
      userAnswer: q.userAnswer,
      difficulty: q.difficulty,
    });
  };

  // 只改备注 / 答案 / 难度；错题标记与错误次数仍由「标记做错 / 重做正确」负责，避免静默改写历史
  const saveEdit = (q: Question) => {
    const note = draft.note.trim();
    editQuestion(q.id, {
      // 已软删除的题保持 [已删除] 前缀，要恢复请用「恢复」按钮
      note: isDeleted(q) && !note.startsWith(DELETED_PREFIX) ? `${DELETED_PREFIX}${note}` : note,
      correctAnswer: draft.correctAnswer.trim(),
      userAnswer: draft.userAnswer.trim(),
      difficulty: draft.difficulty,
    });
    setEditId(null);
  };

  // 软删除：不 splice，只加前缀 + 掌握度清零（历史与错误次数都保留）
  const softDelete = (q: Question) => {
    if (isDeleted(q)) return;
    editQuestion(q.id, { note: `${DELETED_PREFIX}${q.note}`, mastery: 0 });
  };

  const restoreQuestion = (q: Question) => {
    editQuestion(q.id, { note: q.note.replace(DELETED_PREFIX, "") });
  };

  const hasQuestions = store.questions.length > 0;

  return (
    <div className="sub-page">
      <h1 className="page-title">真题库 / 错题库</h1>
      <p className="eyebrow">
        只登记题目元数据与自己的解析 · 错题自动关联资料与掌握度
      </p>

      {/* ---------------- 录入题目元数据（§14） ---------------- */}
      <section className="card" aria-label="录入题目元数据">
        <div className="section-head-row">
          <h2 className="section-title">录入题目（元数据 + 我的解析）</h2>
          <span className="hint">共 {store.questions.length} 道</span>
        </div>
        <p className="section-note">
          本页只保存题目元数据（年份 / 科目 / 题号 / 知识点 / 难度）和你自己写的解析、答案、备注，
          <strong>不抓取、不内置、不转存任何受版权保护的真题原文或试卷 PDF</strong>。
          需要看题时用两种合法做法之一：① 填「来源链接」（sourceUrl）指向公开合法页面；
          ② 打开你自己拥有的文件——在「资料中心 → 上传我的资料」把本地文件存进本机浏览器，
          再把它的链接记在这里。
        </p>

        <div className="filter-bar">
          <label className="field">
            年份
            <input
              type="number"
              min={1990}
              max={2100}
              value={fYear}
              onChange={(e) => setFYear(e.target.value)}
              placeholder="如 2025"
            />
          </label>
          <label className="field">
            科目
            <select value={fSubject} onChange={(e) => changeFormSubject(e.target.value as QuestionSubject)}>
              {SUBJECT_KEYS.map((s) => (
                <option key={s} value={s}>
                  {QUESTION_SUBJECT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            类型
            <select value={fExamType} onChange={(e) => setFExamType(e.target.value as ExamType)}>
              {EXAM_TYPE_KEYS.map((t) => (
                <option key={t} value={t}>
                  {EXAM_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-grow">
            试卷名
            <input
              value={fPaper}
              onChange={(e) => setFPaper(e.target.value)}
              placeholder="如：2025 年全国硕士研究生招生考试 408"
            />
          </label>
        </div>

        <div className="filter-bar">
          <label className="field">
            大题
            <input value={fSection} onChange={(e) => setFSection(e.target.value)} placeholder="如：二、综合应用题" />
          </label>
          <label className="field">
            题号
            <input value={fNumber} onChange={(e) => setFNumber(e.target.value)} placeholder="如：41" />
          </label>
          <label className="field">
            题型
            <select value={fType} onChange={(e) => setFType(e.target.value as QuestionType)}>
              {QUESTION_TYPE_KEYS.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-grow">
            知识点
            <select value={fKp} onChange={(e) => setFKp(e.target.value)}>
              {formKpOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            难度
            <select value={fDifficulty} onChange={(e) => setFDifficulty(Number(e.target.value))}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-bar">
          <label className="field field-grow">
            正确答案
            <input
              value={fCorrect}
              onChange={(e) => setFCorrect(e.target.value)}
              placeholder="只写答案要点 / 你自己的结论"
            />
          </label>
          <label className="field field-grow">
            我的答案
            <input
              value={fUserAnswer}
              onChange={(e) => setFUserAnswer(e.target.value)}
              placeholder="留空表示还没做；与正确答案不同会自动记为错题"
            />
          </label>
          <label className="field field-grow">
            来源链接
            <input value={fSourceUrl} onChange={(e) => setFSourceUrl(e.target.value)} placeholder="https://（合法公开来源）" />
          </label>
        </div>

        <label className="field">
          备注
          <textarea
            value={fNote}
            onChange={(e) => setFNote(e.target.value)}
            placeholder="我的错因、思路、易混点（不要粘贴受版权保护的原文）"
          />
        </label>

        <div className="res-actions" style={{ marginTop: 12, alignItems: "center" }}>
          <button type="button" className="primary-btn" onClick={submitQuestion}>
            保存题目
          </button>
          <span className="hint">
            正确答案与我的答案都填且不同 → 自动标为错题（错误次数从 1 开始、掌握度 0）。
          </span>
        </div>
        {message && <p className="hint">{message}</p>}
      </section>

      {/* ---------------- 筛选（§27） ---------------- */}
      <section className="card" aria-label="筛选题目">
        <div className="section-head-row">
          <h2 className="section-title">筛选</h2>
          <span className="hint">
            命中 {filtered.length} / {store.questions.length} 道
          </span>
        </div>

        <div className="filter-bar">
          <label className="field field-grow">
            关键词
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="匹配试卷名 / 大题 / 题号 / 备注 / 知识点"
            />
          </label>
          <label className="field">
            科目
            <select
              value={subjectFilter}
              onChange={(e) => {
                const next = e.target.value as QuestionSubject | "ALL";
                setSubjectFilter(next);
                // 科目换了以后原来的知识点可能不属于该科目，直接重置，避免筛出空列表
                setKpFilter("ALL");
              }}
            >
              <option value="ALL">全部科目</option>
              {SUBJECT_KEYS.map((s) => (
                <option key={s} value={s}>
                  {QUESTION_SUBJECT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            年份
            <select
              value={yearFilter === "ALL" ? "ALL" : String(yearFilter)}
              onChange={(e) => setYearFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            >
              <option value="ALL">全部年份</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            类型
            <select value={examTypeFilter} onChange={(e) => setExamTypeFilter(e.target.value as ExamType | "ALL")}>
              <option value="ALL">全部类型</option>
              {EXAM_TYPE_KEYS.map((t) => (
                <option key={t} value={t}>
                  {EXAM_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            题型
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as QuestionType | "ALL")}>
              <option value="ALL">全部题型</option>
              {QUESTION_TYPE_KEYS.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            知识点
            <select value={kpFilter} onChange={(e) => setKpFilter(e.target.value)}>
              <option value="ALL">全部知识点</option>
              {filterKpOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="res-actions">
          <button
            type="button"
            className={`ghost-btn${onlyWrong ? " is-active" : ""}`}
            aria-pressed={onlyWrong}
            onClick={() => setOnlyWrong((v) => !v)}
          >
            只看错题
          </button>
          <button
            type="button"
            className={`ghost-btn${onlyUnmastered ? " is-active" : ""}`}
            aria-pressed={onlyUnmastered}
            onClick={() => setOnlyUnmastered((v) => !v)}
          >
            只看未掌握（掌握度 &lt; {UNMASTERED_LINE}）
          </button>
          <button
            type="button"
            className={`ghost-btn${showDeleted ? " is-active" : ""}`}
            aria-pressed={showDeleted}
            onClick={() => setShowDeleted((v) => !v)}
          >
            显示已删除（{overview.deleted}）
          </button>
          <button type="button" className="ghost-btn" onClick={resetFilters}>
            清空筛选
          </button>
        </div>

        {stats.length > 0 && (
          <>
            <p className="hint" style={{ marginTop: 10 }}>
              快捷入口：点下面的错题知识点直接筛出来，并展开它的资料推荐。
            </p>
            <div className="kp-chips">
              {stats.slice(0, 10).map((s) => (
                <button
                  key={s.kpId}
                  type="button"
                  className={`chip${kpFilter === s.kpId ? " is-active" : ""}`}
                  onClick={() => {
                    setSubjectFilter(s.subject);
                    setKpFilter(s.kpId);
                    selectKp(s.kpId);
                  }}
                >
                  {s.label} · 错 {s.count} 次
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ---------------- 错题统计（§31） ---------------- */}
      <section className="card" aria-label="错题统计">
        <h2 className="section-title">错题统计</h2>
        <div className="stat-grid">
          <div className="stat-tile">
            <span className="stat-label">题目总数</span>
            <span className="stat-value">{overview.total}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">错题记录</span>
            <span className="stat-value">{overview.wrong}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">未掌握（&lt; {UNMASTERED_LINE}）</span>
            <span className="stat-value">{overview.unmastered}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">覆盖知识点</span>
            <span className="stat-value">{overview.kpCount}</span>
          </div>
        </div>

        {stats.length === 0 ? (
          <p className="empty-note">
            还没有错题统计：当一道题被标为错题（录入时答案不一致，或点「标记做错」）后，这里会按知识点排出错误次数排行榜。
          </p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>知识点</th>
                  <th>科目</th>
                  <th>错误次数</th>
                  <th>题库题数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={s.kpId}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <button
                        type="button"
                        className={`chip${selectedKp === s.kpId ? " is-active" : ""}`}
                        onClick={() => selectKp(s.kpId)}
                      >
                        {s.label}
                      </button>
                    </td>
                    <td>{QUESTION_SUBJECT_LABEL[s.subject]}</td>
                    <td className="num">{s.count}</td>
                    <td className="num">{store.questions.filter((q) => q.knowledgePoint === s.kpId).length}</td>
                    <td>
                      <button
                        type="button"
                        className="ghost-btn tiny"
                        onClick={() => (selectedKp === s.kpId ? setSelectedKp(null) : selectKp(s.kpId))}
                      >
                        {selectedKp === s.kpId ? "收起推荐" : "查看资料"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------- 错题 → 资料联动 + 掌握度（§31） ---------------- */}
      {selectedKp && rec && (
        <section className="card" id="kp-rec" aria-label="错题资料联动">
          <div className="section-head-row">
            <h2 className="section-title">错题 → 资料联动：{rec.kpLabel}</h2>
            <button type="button" className="ghost-btn tiny" onClick={() => setSelectedKp(null)}>
              收起
            </button>
          </div>

          {masteryKey && masteryState ? (
            <p className="section-note">
              掌握度 {masteryLinked}%（与首页 / 知识掌握度页同一口径：任务完成度 + 学习状态 + 正确率）
              {" · "}学习状态 {STUDY_STATUS_LABEL[masteryState.status]}
              {" · "}正确率 {masteryState.accuracy == null ? "未填" : `${masteryState.accuracy}%`}
              {masteryLinked !== masteryManual
                ? `（仅手动口径 ${masteryManual}%，差额来自已勾选的关联月度任务）`
                : ""}
            </p>
          ) : (
            <p className="hint">
              该知识点暂未接入掌握度统计（知识点 id：<code className="num">{selectedKp}</code>），
              可先在「知识掌握度」页确认口径划分。
            </p>
          )}

          {recGroups.map((g) => (
            <div className="rec-group" key={g.title}>
              <h5>{g.title}</h5>
              {g.items.length === 0 ? (
                <p className="hint">
                  暂无关联资料，可在资料中心添加或给资料打上该知识点标签 <code className="num">{selectedKp}</code>
                </p>
              ) : (
                <ul className="rec-list">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      {r.title}
                      {r.sourceUrl ? (
                        <>
                          {" · "}
                          <a className="text-link" href={r.sourceUrl} target="_blank" rel="noreferrer">
                            打开链接
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ---------------- 题目列表 ---------------- */}
      <section className="card" aria-label="题目列表">
        <div className="section-head-row">
          <h2 className="section-title">题目列表</h2>
          <span className="hint">删除为软删除：备注加 {DELETED_PREFIX} 前缀 + 掌握度置 0，历史仍在</span>
        </div>

        {!hasQuestions ? (
          <p className="empty-note">
            题库还是空的：在上面「录入题目」里填好年份 / 科目 / 题号 / 知识点与答案，点「保存题目」就能加入第一道题。
            只登记元数据和你自己的解析——需要看原题时填合法来源链接，或在「资料中心」上传你自己拥有的文件。
          </p>
        ) : filtered.length === 0 ? (
          <p className="empty-note">没有符合当前筛选条件的题目：可以「清空筛选」，或放宽年份 / 题型 / 只错题等条件。</p>
        ) : (
          <div className="grid-2">
            {filtered.map((q) => {
              const del = isDeleted(q);
              const editing = editId === q.id;
              return (
                <article className="card q-card" key={q.id} style={del ? { opacity: 0.6 } : undefined}>
                  <div className="q-head">
                    <span className="badge is-year">{q.year ?? "年份未填"}</span>
                    <span className="badge">{QUESTION_SUBJECT_LABEL[q.subject]}</span>
                    <span className="badge">{EXAM_TYPE_LABEL[q.examType]}</span>
                    <strong>{q.questionNumber ? `第 ${q.questionNumber} 题` : "题号未填"}</strong>
                    <span className="badge">{QUESTION_TYPE_LABEL[q.questionType]}</span>
                    {q.isWrong ? (
                      <span className="badge is-review">错题 ×{q.wrongCount}</span>
                    ) : (
                      <span className="badge is-official">已订正</span>
                    )}
                    {del && <span className="warn-line">已删除</span>}
                  </div>

                  <div className="kp-chips">
                    <button
                      type="button"
                      className={`chip${selectedKp === q.knowledgePoint ? " is-active" : ""}`}
                      onClick={() => selectKp(q.knowledgePoint)}
                      title="点击查看该知识点的资料推荐与掌握度"
                    >
                      {kpLabel(q.knowledgePoint)}
                    </button>
                  </div>

                  <p className="q-note">
                    {q.paper || "试卷名未填"}
                    {q.section ? ` · ${q.section}` : ""}
                  </p>

                  {editing ? (
                    <>
                      <div className="filter-bar">
                        <label className="field field-grow">
                          正确答案
                          <input
                            value={draft.correctAnswer}
                            onChange={(e) => setDraft((d) => ({ ...d, correctAnswer: e.target.value }))}
                          />
                        </label>
                        <label className="field field-grow">
                          我的答案
                          <input
                            value={draft.userAnswer}
                            onChange={(e) => setDraft((d) => ({ ...d, userAnswer: e.target.value }))}
                          />
                        </label>
                        <label className="field">
                          难度
                          <select
                            value={draft.difficulty}
                            onChange={(e) => setDraft((d) => ({ ...d, difficulty: Number(e.target.value) }))}
                          >
                            {DIFFICULTIES.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="field">
                        备注
                        <textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
                      </label>
                      <div className="q-actions">
                        <button type="button" className="primary-btn" onClick={() => saveEdit(q)}>
                          保存修改
                        </button>
                        <button type="button" className="ghost-btn" onClick={() => setEditId(null)}>
                          取消
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="hint">
                        难度 {q.difficulty}/5 · 掌握度 {q.mastery}% · 错误次数 {q.wrongCount}
                      </p>
                      <p className="hint">
                        正确答案：{q.correctAnswer || "未填"} · 我的答案：{q.userAnswer || "未填"}
                      </p>
                      {q.note && <p className="q-note">备注：{q.note}</p>}
                      {q.sourceUrl && (
                        <p className="hint">
                          来源：
                          <a className="text-link" href={q.sourceUrl} target="_blank" rel="noreferrer">
                            打开链接
                          </a>
                        </p>
                      )}
                      <div className="q-actions">
                        <button type="button" className="ghost-btn" onClick={() => markWrong(q.id)}>
                          标记做错
                        </button>
                        <button type="button" className="ghost-btn" onClick={() => markFixed(q.id)}>
                          重做正确
                        </button>
                        <button type="button" className="ghost-btn" onClick={() => startEdit(q)}>
                          编辑备注 / 答案
                        </button>
                        {del ? (
                          <button type="button" className="ghost-btn" onClick={() => restoreQuestion(q)}>
                            恢复
                          </button>
                        ) : (
                          <button type="button" className="ghost-btn" onClick={() => softDelete(q)}>
                            删除（软删除）
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
