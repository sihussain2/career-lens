import type { LLMClient } from "../llm-types";
import { MockLLMClient } from "./mock-llm-client";
import { RemoteSemanticClient } from "./remote-semantic-client";
import {
  getSemanticProviderSettings
} from "../provider-settings";

export async function createSemanticClient():
  Promise<LLMClient> {
  const settings =
    await getSemanticProviderSettings();

  if (settings.mode === "remote") {
    return new RemoteSemanticClient({
      endpoint: settings.endpoint
    });
  }

  return new RemoteSemanticClient({
    endpoint: settings.endpoint
  });
}

/*
 * Explicit development fallback.
 */
export function createMockSemanticClient():
  LLMClient {
  return new MockLLMClient();
}
