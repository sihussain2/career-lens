import type { EnhancedRequirementAnalysis } from "../analysis/enhanced-analysis";
import type { LLMRequirementContext } from "./llm-types";

export function buildRequirementContext(
  analysis: EnhancedRequirementAnalysis
): LLMRequirementContext {
  return {
    requirementId: analysis.base.requirement.id,
    requirementText: analysis.base.requirement.text,
    requirementType: analysis.base.requirement.type,
    requirementPriority: analysis.base.requirement.priority,
    candidates: analysis.candidates.slice(0, 5)
  };
}

export function buildAnalysisContext(
  requirements: EnhancedRequirementAnalysis[]
): LLMRequirementContext[] {
  return requirements.map(buildRequirementContext);
}
