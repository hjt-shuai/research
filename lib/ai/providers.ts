import { RulesAdvisor } from "./rulesAdvisor";
import { SYSTEM_PROMPT, buildMessages } from "./prompts";
import type { AiAdvice, AiProvider, AiSection } from "./types";

export type ProviderKind = "rules" | "remote" | "local";

export type ProviderMeta = {
  id: string;
  label: string;
  kind: ProviderKind;
  /** 接入后是否需要 API Key / 服务地址 */
  requiresConfig: boolean;
  note: string;
};

/**
 * 预留的 AI Provider 清单。
 * 目前只有本地规则真正可用；其余为占位实现，接入时只需替换 createProvider 里的实现，
 * 不需要改动页面与数据结构。
 */
export const PROVIDER_CATALOG: ProviderMeta[] = [
  {
    id: "rules-local",
    label: "本地规则（默认）",
    kind: "rules",
    requiresConfig: false,
    note: "不联网。直接基于任务、模考与掌握度数据生成建议。",
  },
  {
    id: "deepseek",
    label: "DeepSeek（预留）",
    kind: "remote",
    requiresConfig: true,
    note: "预留接口：填入 API Key 后可切换到 deepseek-chat。",
  },
  {
    id: "openai",
    label: "OpenAI（预留）",
    kind: "remote",
    requiresConfig: true,
    note: "预留接口：填入 API Key 后可切换。",
  },
  {
    id: "qwen",
    label: "通义千问（预留）",
    kind: "remote",
    requiresConfig: true,
    note: "预留接口：填入 DashScope API Key 后可切换。",
  },
  {
    id: "local-model",
    label: "本地模型（预留）",
    kind: "local",
    requiresConfig: true,
    note: "预留接口：指向本地推理服务（如 Ollama）地址后可切换。",
  },
];

export const DEFAULT_PROVIDER_ID = "rules-local";

export function listProviders(): ProviderMeta[] {
  return PROVIDER_CATALOG;
}

export function providerMeta(id: string): ProviderMeta {
  return (
    PROVIDER_CATALOG.find((p) => p.id === id) ??
    PROVIDER_CATALOG.find((p) => p.id === DEFAULT_PROVIDER_ID)!
  );
}

export function isProviderReady(id: string): boolean {
  return providerMeta(id).id === DEFAULT_PROVIDER_ID;
}

/**
 * 未配置的 Provider：仍然返回可用的建议（回落到本地规则），
 * 但会在开头标注当前状态，避免页面出现空白。
 */
function createPlaceholderProvider(meta: ProviderMeta): AiProvider {
  return {
    id: meta.id,
    getAdvice(ctx): AiAdvice {
      const base = new RulesAdvisor().getAdvice(ctx);
      return {
        ...base,
        todayAnalysis: `【${meta.label} 尚未配置，以下仍由本地规则生成】${base.todayAnalysis}`,
      };
    },
  };
}

export function createProvider(id: string): AiProvider {
  const meta = providerMeta(id);
  if (meta.kind === "rules") return new RulesAdvisor();
  return createPlaceholderProvider(meta);
}

/** 供未来接入真实模型时使用：拼好的 system/user 消息体 */
export function providerMessages(section: AiSection, snapshot: string) {
  return { system: SYSTEM_PROMPT, messages: buildMessages(section, snapshot) };
}
