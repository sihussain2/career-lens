import type { JobRequirement } from "../../job/model/JobRequirement";
import type { Evidence } from "../../resume/evidence/evidence";
import {
  matchConcepts,
  getSpecificTerms
} from "./concept-matcher";

export interface EvidenceCandidate {
  evidence: Evidence;
  score: number;
  specificMatches: string[];
  genericMatches: string[];
}

export type RetrievedEvidence = EvidenceCandidate;

export function retrieveEvidence(
  requirement: JobRequirement,
  evidence: Evidence[],
  limit = 5
): RetrievedEvidence[] {
  const candidates: RetrievedEvidence[] = [];

  for (const item of evidence) {
    if (!item.sourceText.trim()) continue;

    const result = matchConcepts(
      requirement.text,
      item.sourceText,
      requirement.normalizedConcepts,
      item.normalizedConcepts
    );

    const requirementSpecificTerms =
      getSpecificTerms(requirement.text);

    if (
      requirementSpecificTerms.length > 0 &&
      result.specificMatches.length === 0
    ) {
      continue;
    }

    if (result.score <= 0) continue;

    let quality = 1;

    if (item.sectionId.toLowerCase().includes("summary")) {
      quality *= 0.75;
    }

    if (item.sourceText.length < 40) {
      quality *= 0.9;
    }

    const score = Number(
      Math.min(result.score * quality, 1).toFixed(3)
    );

    candidates.push({
      evidence: item,
      score,
      specificMatches: result.specificMatches,
      genericMatches: result.genericMatches
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
