import type { LLMProviderConfig } from "./llm-types";

export type SemanticProviderMode =
  | "local"
  | "remote";

export interface SemanticProviderSettings {
  mode: SemanticProviderMode;
  endpoint: string;
  model: string;
}

const STORAGE_KEY = "careerLensSemanticProvider";

const DEFAULT_SETTINGS: SemanticProviderSettings = {
  mode: "local",
  endpoint: "http://127.0.0.1:8787/semantic-analysis",
  model: "gpt-5.4"
};

export async function getSemanticProviderSettings():
  Promise<SemanticProviderSettings> {
  const result =
    await chrome.storage.local.get(STORAGE_KEY);

  return {
    ...DEFAULT_SETTINGS,
    ...(result[STORAGE_KEY] ?? {})
  };
}

export async function saveSemanticProviderSettings(
  settings: SemanticProviderSettings
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: settings
  });
}

/*
 * Backward-compatible API used by earlier code.
 */
export async function getSemanticProviderConfig():
  Promise<LLMProviderConfig> {
  const settings =
    await getSemanticProviderSettings();

  return {
    endpoint: settings.endpoint,
    model: settings.model
  };
}

export async function saveSemanticProviderConfig(
  config: LLMProviderConfig
): Promise<void> {
  await saveSemanticProviderSettings({
    mode: "remote",
    endpoint: config.endpoint,
    model: config.model
  });
}
