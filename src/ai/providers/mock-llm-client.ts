import type {
  LLMAnalysisRequest,
  LLMAnalysisResponse,
  LLMClient,
  SemanticRequirementAnalysis
} from "../llm-types";

export class MockLLMClient implements LLMClient {
  async analyze(
    request: LLMAnalysisRequest
  ): Promise<LLMAnalysisResponse> {
    const requirements: SemanticRequirementAnalysis[] =
      request.requirements.map((item) => {
        if (item.candidates.length === 0) {
          return {
            requirementId: item.requirementId,
            relationship: "no_support",
            confidence: 0.99,
            explanation:
              "No locally retrieved resume evidence was available for semantic assessment.",
            evidence: []
          };
        }

        /*
         * This remains a development provider.
         * It deliberately does NOT claim semantic understanding.
         *
         * The production provider will replace this with an actual
         * LLM call and structured JSON validation.
         */
        return {
          requirementId: item.requirementId,
          relationship: "no_support",
          confidence: 0.5,
          explanation:
            "Semantic provider not configured. Local evidence is available for review, but no semantic conclusion is being claimed.",
          evidence: item.candidates.map((candidate) => ({
            evidenceId: candidate.evidence.id,
            relationship: "no_support",
            confidence: 0.5,
            explanation:
              "Candidate retrieved locally; semantic relevance has not yet been evaluated."
          }))
        };
      });

    return {
      requirements,
      suggestions: []
    };
  }
}
