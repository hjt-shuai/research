import { DEFAULT_PROVIDER_ID, createProvider } from "./providers";
import type { AiProvider } from "./types";

/** AI Provider 选择保存在本机浏览器，不影响备考主数据 */
export const AI_PROVIDER_KEY = "kaoyan.aiProvider";

let provider: AiProvider = createProvider(DEFAULT_PROVIDER_ID);

export function getAdvisor(): AiProvider {
  return provider;
}

export function getAdvisorFor(id: string): AiProvider {
  return createProvider(id);
}

export function getActiveProviderId(): string {
  return provider.id;
}

export function setAiProvider(next: AiProvider): void {
  provider = next;
}

export function setActiveProviderId(id: string): AiProvider {
  provider = createProvider(id);
  return provider;
}
