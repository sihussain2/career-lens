import type { LLMProviderConfig } from "./llm-types";

const STORAGE_KEY = "semanticProviderConfig";

const DEFAULT_CONFIG: LLMProviderConfig = {
  endpoint: "http://localhost:11434/v1/chat/completions",
  model: "llama3.2"
};

export async function getSemanticProviderConfig():
  Promise<LLMProviderConfig> {
  const result = await chrome.storage.local.get(STORAGE_KEY);

  return {
    ...DEFAULT_CONFIG,
    ...(result[STORAGE_KEY] ?? {})
  };
}

export async function saveSemanticProviderConfig(
  config: LLMProviderConfig
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: config
  });
}
