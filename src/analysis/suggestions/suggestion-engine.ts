import type { Evidence } from "../../resume/evidence/evidence";
import type { Job } from "../../job/model/Job";
import type { SemanticSuggestion } from "../../ai/llm-types";
import type { Suggestion } from "../../suggestions/Suggestion";
import { validateSuggestion } from "./suggestion-validator";

function createId(): string {
  return `SUG-${crypto.randomUUID()}`;
}

export function buildValidatedSuggestions(
  suggestions: SemanticSuggestion[],
  job: Job,
  evidence: Evidence[]
): Suggestion[] {
  const results: Suggestion[] = [];

  for (const item of suggestions) {
    const suggestion: Suggestion = {
      id: createId(),
      type: item.type,
      sectionId: item.sectionId,
      original: item.original,
      proposed: item.proposed,
      reason: item.reason,
      evidenceIds: item.evidenceIds,
      requirementIds: item.requirementIds,
      confidence: item.confidence,
      status: "PENDING"
    };

    const validation = validateSuggestion(
      suggestion,
      job,
      evidence
    );

    if (!validation.valid) {
      console.warn(
        "Rejected invalid suggestion:",
        validation.errors
      );
      continue;
    }

    results.push(suggestion);
  }

  return results;
}
