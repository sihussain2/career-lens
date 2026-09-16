import type { JobRequirement } from "../../job/model/JobRequirement";
import type { Evidence } from "../../resume/evidence/evidence";
import type {
  EvidenceLink,
  EvidenceRelationship
} from "../../resume/evidence/evidence-graph";
import { matchConcepts } from "./concept-matcher";

export interface RequirementMatchResult {
  requirement: JobRequirement;
  links: EvidenceLink[];
  bestRelationship: EvidenceRelationship;
  bestConfidence: number;
}

function relationshipForScore(
  score: number,
  specificMatchCount: number,
  requirementSpecificCount: number
): EvidenceRelationship {
  if (specificMatchCount === 0) {
    return "no_support";
  }

  const coverage =
    requirementSpecificCount > 0
      ? specificMatchCount / requirementSpecificCount
      : 0;

  /*
   * Local matching is deliberately conservative.
   *
   * The local engine is retrieval, not semantic reasoning.
   * A single overlapping word is NOT enough to claim that
   * resume evidence supports a job requirement.
   */

  if (coverage >= 0.8 && score >= 0.8) {
    return "strong_support";
  }

  if (coverage >= 0.5 && score >= 0.5) {
    return "partial_support";
  }

  /*
   * Anything weaker is intentionally treated as unsupported.
   *
   * Semantic AI will later be responsible for deciding whether
   * weakly related evidence is actually relevant.
   */
  return "no_support";
}

function generateId(): string {
  return `LINK-${crypto.randomUUID()}`;
}

export function matchRequirement(
  requirement: JobRequirement,
  evidence: Evidence[]
): RequirementMatchResult {
  const links: EvidenceLink[] = [];

  for (const item of evidence) {
    const result = matchConcepts(
      requirement.text,
      item.sourceText,
      requirement.normalizedConcepts,
      item.normalizedConcepts
    );

    if (!result.matched) continue;

    const relationship = relationshipForScore(
      result.score,
      result.evidenceSpecificCount,
      result.requirementSpecificCount
    );

    if (relationship === "no_support") {
      continue;
    }

    links.push({
      id: generateId(),
      requirementId: requirement.id,
      evidenceId: item.id,
      relationship,
      source: "local",
      confidence: Number(
        Math.min(result.score, 1).toFixed(3)
      )
    });
  }

  links.sort((a, b) => b.confidence - a.confidence);

  const best = links[0];

  return {
    requirement,
    links,
    bestRelationship: best?.relationship ?? "no_support",
    bestConfidence: best?.confidence ?? 0
  };
}
