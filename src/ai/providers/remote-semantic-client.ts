import type {
  LLMAnalysisRequest,
  LLMAnalysisResponse,
  LLMClient
} from "../llm-types";

import {
  getCareerLensSession
} from "./career-lens-auth";

export interface RemoteSemanticClientOptions {
  endpoint: string;
  authorizationToken?: string;
}

export class RemoteSemanticClient
  implements LLMClient {

  constructor(
    private readonly options: RemoteSemanticClientOptions
  ) {}

  async analyze(
    request: LLMAnalysisRequest
  ): Promise<LLMAnalysisResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    const session =
      this.options.authorizationToken ??
      await getCareerLensSession();

    if (!session) {
      throw new Error(
        "CareerLens is not connected to GitHub. Click Connect GitHub before running Semantic AI Analysis."
      );
    }

    headers.Authorization =
      `Bearer ${session}`;

    const response = await fetch(
      this.options.endpoint,
      {
        method: "POST",
        headers,
        body: JSON.stringify(request)
      }
    );

    if (!response.ok) {
      let message =
        `Semantic gateway returned HTTP ${response.status}.`;

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
