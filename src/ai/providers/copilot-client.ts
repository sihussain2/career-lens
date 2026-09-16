
import type {
  LLMAnalysisRequest,
  LLMAnalysisResponse,
  LLMClient
} from "../llm-types";

const DEFAULT_ENDPOINT =
  "http://127.0.0.1:8765/semantic-analysis";

export class CopilotClient implements LLMClient {
  constructor(
    private readonly endpoint = DEFAULT_ENDPOINT
  ) {}

  async analyze(
    request: LLMAnalysisRequest
  ): Promise<LLMAnalysisResponse> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      let message = `Copilot bridge returned HTTP ${response.status}.`;

      try {
        const body = await response.json();

        if (typeof body?.error === "string") {
          message = body.error;
        }
      } catch {
        // Keep default error.
      }

      throw new Error(message);
    }

    return response.json() as Promise<LLMAnalysisResponse>;
  }
}

export async function checkCopilotBridge(): Promise<{
  available: boolean;
  model?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      "http://127.0.0.1:8765/health"
    );

    if (!response.ok) {
      return {
        available: false,
        error: `HTTP ${response.status}`
      };
    }

    const data = await response.json();

    return {
      available: data?.ok === true,
      model: data?.model
    };
  } catch (error) {
    return {
      available: false,
      error:
        error instanceof Error
          ? error.message
          : "Copilot bridge unavailable."
    };
  }
}
