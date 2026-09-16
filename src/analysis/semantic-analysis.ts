import { validateSemanticResponse } from "../ai/providers/semantic-response-validator";
import type { Job } from "../job/model/Job";
import type { Resume } from "../resume/model/Resume";
import type { Evidence } from "../resume/evidence/evidence";
import {
  analyzeJobEnhanced,
  type EnhancedJobResumeAnalysis
} from "./enhanced-analysis";
import { buildAnalysisContext } from "../ai/context-builder";
import type {
  LLMClient,
  SemanticRequirementAnalysis
} from "../ai/llm-types";

export type SemanticJobResumeAnalysis =
  Omit<EnhancedJobResumeAnalysis, "analysisMode"> & {
    analysisMode: "semantic";
    semantic: SemanticRequirementAnalysis[];
  };

export async function analyzeJobSemantically(
  job: Job,
  resume: Resume,
  evidence: Evidence[],
  client: LLMClient
): Promise<SemanticJobResumeAnalysis> {
  const local = analyzeJobEnhanced(
    job,
    resume,
    evidence
  );

  const contexts = buildAnalysisContext(
    local.requirements
  );

  const response = await client.analyze({
    requirements: contexts
  });

  const validatedResponse = validateSemanticResponse(
    response,
    new Set(job.requirements.map((item) => item.id)),
    new Set(evidence.map((item) => item.id)),
    new Set(resume.sections.map((item) => item.id))
  );

  const semanticByRequirement = new Map(
    validatedResponse.requirements.map((item) => [
      item.requirementId,
      item
    ])
  );

  const requirements = local.requirements.map((item) => {
    const semantic = semanticByRequirement.get(
      item.base.requirement.id
    );

    if (!semantic) {
      return item;
    }

    return {
      ...item,
      base: {
        ...item.base,
        bestRelationship: semantic.relationship,
        bestConfidence: semantic.confidence,
        links: semantic.evidence
          .filter(
            (evidence) =>
              evidence.relationship !== "no_support"
          )
          .map((evidence) => ({
            id: `AI-LINK-${crypto.randomUUID()}`,
            requirementId: item.base.requirement.id,
            evidenceId: evidence.evidenceId,
            relationship: evidence.relationship,
            source: "ai" as const,
            confidence: evidence.confidence
          }))
      }
    };
  });

  const summary = {
    totalRequirements: requirements.length,
    strongSupport: requirements.filter(
      (r) => r.base.bestRelationship === "strong_support"
    ).length,
    partialSupport: requirements.filter(
      (r) => r.base.bestRelationship === "partial_support"
    ).length,
    related: requirements.filter(
      (r) => r.base.bestRelationship === "related"
    ).length,
    contradicts: requirements.filter(
      (r) => r.base.bestRelationship === "contradicts"
    ).length,
    noSupport: requirements.filter(
      (r) => r.base.bestRelationship === "no_support"
    ).length
  };

  return {
    ...local,
    requirements,
    links: requirements.flatMap(
      (item) => item.base.links
    ),
    summary,
    analysisMode: "semantic",
    semantic: validatedResponse.requirements
  };
}
