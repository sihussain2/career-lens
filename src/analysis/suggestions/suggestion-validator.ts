import type { Suggestion } from "../../suggestions/Suggestion";
import type { Evidence } from "../../resume/evidence/evidence";
import type { Job } from "../../job/model/Job";

export interface SuggestionValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSuggestion(
  suggestion: Suggestion,
  job: Job,
  evidence: Evidence[]
): SuggestionValidationResult {
  const errors: string[] = [];

  const evidenceIds = new Set(
    evidence.map((item) => item.id)
  );

  const requirementIds = new Set(
    job.requirements.map((item) => item.id)
  );

  for (const id of suggestion.evidenceIds) {
    if (!evidenceIds.has(id)) {
      errors.push(
        `Suggestion references unknown evidence ID: ${id}`
      );
    }
  }

  for (const id of suggestion.requirementIds) {
    if (!requirementIds.has(id)) {
      errors.push(
        `Suggestion references unknown requirement ID: ${id}`
      );
    }
  }

  if (
    suggestion.type !== "NO_CHANGE" &&
    suggestion.evidenceIds.length === 0
  ) {
    errors.push(
      "Non-NO_CHANGE suggestions must cite evidence."
    );
  }

  if (
    ["REWORD", "ADD"].includes(suggestion.type) &&
    !suggestion.proposed?.trim()
  ) {
    errors.push(
      `${suggestion.type} suggestions require proposed text.`
    );
  }

  if (suggestion.confidence < 0 || suggestion.confidence > 1) {
    errors.push(
      "Suggestion confidence must be between 0 and 1."
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
