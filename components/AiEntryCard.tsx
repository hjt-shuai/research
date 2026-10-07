import Link from "next/link";

export default function AiEntryCard() {
  return (
    <section className="card ai-entry" aria-label="AI 学习助手入口">
      <h2 className="section-title">AI 学习助手</h2>
      <p className="hint">
        查看今日学习分析、成绩解读、薄弱点与下周计划建议（当前为本地规则，未来可接 AI）。
      </p>
      <Link className="primary-btn link-btn" href="/ai">
        打开 AI 学习助手
      </Link>
    </section>
  );
}
