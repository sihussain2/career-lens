import type { JobRequirement } from "../../job/model/JobRequirement";
import type { Evidence } from "../../resume/evidence/evidence";
import type { RequirementMatchResult } from "../matching/requirement-matcher";

export interface SuggestionContext {
  requirement: JobRequirement;
  match: RequirementMatchResult;
  evidence: Evidence[];
}

export function buildSuggestionContext(
  result: RequirementMatchResult,
  evidence: Evidence[]
): SuggestionContext {
  const ids = new Set(
    result.links.map((link) => link.evidenceId)
  );

  return {
    requirement: result.requirement,
    match: result,
    evidence: evidence.filter((item) =>
      ids.has(item.id)
    )
  };
}
