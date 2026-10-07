"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildAgentPrompt, runAgent } from "@/lib/ai/agent";
import { AI_PROVIDER_KEY, getActiveProviderId, setActiveProviderId } from "@/lib/ai/service";
import { isProviderReady, listProviders, providerMeta } from "@/lib/ai/providers";
import { AI_SECTIONS, type AiSection } from "@/lib/ai/types";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useAppStore } from "./AppStoreProvider";

export default function AiAssistant() {
  const { store, todayIds } = useAppStore();
  const {
    value: providerId,
    setValue: setProviderId,
    loaded: providerLoaded,
  } = useLocalStorage<string>(AI_PROVIDER_KEY, getActiveProviderId());
  const [promptSection, setPromptSection] = useState<AiSection>("nextWeekPlan");
  const [copied, setCopied] = useState(false);

  const ctx = useMemo(() => ({ store, todayIds }), [store, todayIds]);
  const activeId = providerLoaded ? providerId : getActiveProviderId();

  const run = useMemo(() => runAgent(ctx, activeId), [ctx, activeId]);

  useEffect(() => {
    // 记住选择，供其它入口复用同一个 Provider
    setActiveProviderId(activeId);
  }, [activeId]);

  const activeMeta = providerMeta(activeId);
  const prompt = useMemo(
    () => buildAgentPrompt(promptSection, ctx),
    [promptSection, ctx],
  );

  const blocks = AI_SECTIONS.map((s) => ({
    title: s.title,
    body: run.advice[s.key],
  }));

  const copyPrompt = async () => {
    const text = `${prompt.messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      window.alert("复制失败：浏览器未授权剪贴板访问，请手动选中复制。");
    }
  };

  return (
    <div className="sub-page">
      <p className="eyebrow">
        <Link href="/">← 返回首页</Link>
      </p>
      <h1 className="page-title">AI 学习助手</h1>
      <p className="hint">
        当前为本地规则生成建议；代码已预留 Provider / Service / Prompt / Agent
        四层接口，未来可接入 DeepSeek、OpenAI、通义或本地模型，不需要改动页面。
      </p>

      <section className="card ai-provider-card">
        <div className="section-head-row">
          <h2 className="section-title">分析引擎</h2>
          <span className="ai-provider-current">当前：{activeMeta.label}</span>
        </div>
        <label className="ai-provider-select">
          Provider
          <select
            value={activeId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            {listProviders().map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">{activeMeta.note}</p>
        {!isProviderReady(activeId) && (
          <p className="ai-provider-warn">
            该 Provider 尚未配置，页面会自动回落到本地规则生成建议，功能不受影响。
          </p>
        )}
      </section>

      <div className="ai-blocks">
        {blocks.map((b) => (
          <article className="card" key={b.title}>
            <h2 className="section-title">{b.title}</h2>
            <p>{b.body}</p>
          </article>
        ))}
      </div>

      <section className="card">
        <div className="section-head-row">
          <h2 className="section-title">Prompt / 数据快照</h2>
          <button type="button" className="ghost-btn" onClick={copyPrompt}>
            {copied ? "已复制" : "复制 Prompt"}
          </button>
        </div>
        <label className="ai-provider-select">
          预览的分析模块
          <select
            value={promptSection}
            onChange={(e) => setPromptSection(e.target.value as AiSection)}
          >
            {AI_SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <details className="ai-prompt">
          <summary>展开查看将要发送给模型的内容</summary>
          <h3 className="ai-prompt-title">system</h3>
          <pre className="ai-prompt-pre">{prompt.system}</pre>
          <h3 className="ai-prompt-title">user</h3>
          <pre className="ai-prompt-pre">
            {prompt.messages[1]?.content ?? ""}
          </pre>
        </details>
        <p className="hint">
          数据快照只包含本机浏览器里的备考数据，接入真实模型前不会发送到任何服务器。
        </p>
      </section>
    </div>
  );
}
