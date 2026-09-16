
import type {
  LLMAnalysisResponse,
  SemanticRelationship
} from "../llm-types";

const RELATIONSHIPS: SemanticRelationship[] = [
  "strong_support",
  "partial_support",
  "related",
  "contradicts",
  "no_support"
];

const SUGGESTION_TYPES = [
  "REWORD",
  "REORDER",
  "ADD",
  "REMOVE",
  "EMPHASIZE",
  "DE_EMPHASIZE",
  "NO_CHANGE"
];

function relationship(value: unknown): value is SemanticRelationship {
  return (
    typeof value === "string" &&
    RELATIONSHIPS.includes(value as SemanticRelationship)
  );
}

function confidence(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function validateIds(
  response: LLMAnalysisResponse,
  validRequirementIds: Set<string>,
  validEvidenceIds: Set<string>,
  validSectionIds: Set<string>
): void {
  for (const result of response.requirements) {
    if (!validRequirementIds.has(result.requirementId)) {
      throw new Error(
        `Copilot referenced unknown requirement ID: ${result.requirementId}`
      );
    }

    for (const evidence of result.evidence) {
      if (!validEvidenceIds.has(evidence.evidenceId)) {
        throw new Error(
          `Copilot referenced unknown evidence ID: ${evidence.evidenceId}`
        );
      }
    }
  }

  for (const suggestion of response.suggestions) {
    if (!validSectionIds.has(suggestion.sectionId)) {
      throw new Error(
        `Copilot referenced unknown section ID: ${suggestion.sectionId}`
      );
    }

    for (const id of suggestion.evidenceIds) {
      if (!validEvidenceIds.has(id)) {
        throw new Error(
          `Suggestion referenced unknown evidence ID: ${id}`
        );
      }
    }

    for (const id of suggestion.requirementIds) {
      if (!validRequirementIds.has(id)) {
        throw new Error(
          `Suggestion referenced unknown requirement ID: ${id}`
        );
      }
    }
  }
}

export function validateSemanticResponse(
  response: LLMAnalysisResponse,
  validRequirementIds?: Set<string>,
  validEvidenceIds?: Set<string>,
  validSectionIds?: Set<string>
): LLMAnalysisResponse {
  if (!response || !Array.isArray(response.requirements)) {
    throw new Error(
      "Semantic provider response is missing requirements."
    );
  }

  if (!Array.isArray(response.suggestions)) {
    throw new Error(
      "Semantic provider response is missing suggestions."
    );
  }

  for (const result of response.requirements) {
    if (
      typeof result.requirementId !== "string" ||
      !relationship(result.relationship) ||
      !confidence(result.confidence) ||
      typeof result.explanation !== "string" ||
      !Array.isArray(result.evidence)
    ) {
      throw new Error(
        `Invalid semantic assessment for requirement ${String(
          result?.requirementId
        )}.`
      );
    }

    for (const evidence of result.evidence) {
      if (
        typeof evidence.evidenceId !== "string" ||
        !relationship(evidence.relationship) ||
        !confidence(evidence.confidence) ||
        typeof evidence.explanation !== "string"
      ) {
        throw new Error(
          `Invalid semantic evidence assessment for requirement ${result.requirementId}.`
        );
      }
    }
  }

  for (const suggestion of response.suggestions) {
    if (
      !SUGGESTION_TYPES.includes(suggestion.type) ||
      typeof suggestion.sectionId !== "string" ||
      typeof suggestion.reason !== "string" ||
      !Array.isArray(suggestion.evidenceIds) ||
      !Array.isArray(suggestion.requirementIds) ||
      !confidence(suggestion.confidence)
    ) {
      throw new Error("Invalid semantic suggestion.");
    }
  }

  if (
    validRequirementIds &&
    validEvidenceIds &&
    validSectionIds
  ) {
    validateIds(
      response,
      validRequirementIds,
      validEvidenceIds,
      validSectionIds
    );
  }

  return response;
}
