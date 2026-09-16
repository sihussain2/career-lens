import type {
  LLMAnalysisRequest,
  LLMAnalysisResponse,
  LLMClient,
  LLMProviderConfig
} from "../llm-types";

const SYSTEM_PROMPT = `
You are the semantic reasoning engine for a resume intelligence system.

Your task is to determine whether resume evidence actually supports job
requirements.

You MUST follow these rules:

1. Use only the supplied evidence.
2. Never invent experience, skills, technologies, responsibilities,
   qualifications, employers, or achievements.
3. Do not treat generic engineering experience as evidence for a specific
   technology or domain.
4. Distinguish:
   - strong_support: evidence directly demonstrates the requirement
   - partial_support: evidence supports an important part but not all
   - related: relevant experience exists but does not establish the requirement
   - contradicts: evidence conflicts with the requirement
   - no_support: supplied evidence does not establish the requirement
5. Confidence must reflect the strength of the evidence, not the likelihood
   that the candidate gets the job.
6. Every semantic assessment must reference only supplied evidence IDs.
7. Return valid JSON matching the requested structure.
`;

export class OpenAICompatibleClient implements LLMClient {
  constructor(private readonly config: LLMProviderConfig) {}

  async analyze(
    request: LLMAnalysisRequest
  ): Promise<LLMAnalysisResponse> {
    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {})
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: JSON.stringify(request)
          }
        ],
        response_format: {
          type: "json_object"
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Semantic provider request failed (${response.status}): ${body}`
      );
    }

    const data = await response.json();

    const content =
      data?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      throw new Error(
        "Semantic provider returned no usable message content."
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(
        "Semantic provider returned invalid JSON."
      );
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error(
        "Semantic provider returned an invalid response object."
      );
    }

    return parsed as LLMAnalysisResponse;
  }
}
