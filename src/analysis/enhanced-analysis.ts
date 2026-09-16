import type { Job } from "../job/model/Job";
import type { Resume } from "../resume/model/Resume";
import type { Evidence } from "../resume/evidence/evidence";
import type { EvidenceLink } from "../resume/evidence/evidence-graph";

import {
  matchRequirement,
  type RequirementMatchResult
} from "./matching/requirement-matcher";

import {
  retrieveEvidence,
  type RetrievedEvidence
} from "./matching/evidence-retriever";

import {
  groupRequirements,
  type RequirementGroup
} from "./grouping/requirement-grouper";

export interface EnhancedRequirementResult {
  base: RequirementMatchResult;
  candidates: RetrievedEvidence[];
  groupId: string;
  groupTitle: string;
}

/*
 * Backward-compatible name used by the existing AI/context/type layer.
 */
export type EnhancedRequirementAnalysis =
  EnhancedRequirementResult;

export interface EnhancedJobResumeAnalysis {
  jobId: string;
  resumeId: string;
  requirements: EnhancedRequirementResult[];
  groups: RequirementGroup[];
  links: EvidenceLink[];
  summary: {
    totalRequirements: number;
    strongSupport: number;
    partialSupport: number;
    related: number;
    contradicts: number;
    noSupport: number;
  };
  analysisMode: "local";
}

function createSummary(
  results: EnhancedRequirementResult[]
) {
  const summary = {
    totalRequirements: results.length,
    strongSupport: 0,
    partialSupport: 0,
    related: 0,
    contradicts: 0,
    noSupport: 0
  };

  for (const result of results) {
    switch (result.base.bestRelationship) {
      case "strong_support":
        summary.strongSupport++;
        break;
      case "partial_support":
        summary.partialSupport++;
        break;
      case "related":
        summary.related++;
        break;
      case "contradicts":
        summary.contradicts++;
        break;
      case "no_support":
        summary.noSupport++;
        break;
    }
  }

  return summary;
}

export function analyzeJobEnhanced(
  job: Job,
  resume: Resume,
  evidence: Evidence[]
): EnhancedJobResumeAnalysis {
  const groups = groupRequirements(job.requirements);

  const groupByRequirement = new Map<string, RequirementGroup>();

  for (const group of groups) {
    for (const requirementId of group.requirementIds) {
      groupByRequirement.set(requirementId, group);
    }
  }

  const requirements = job.requirements.map(requirement => {
    const base = matchRequirement(requirement, evidence);

    const candidates = retrieveEvidence(
      requirement,
      evidence,
      5
    );

    const group =
      groupByRequirement.get(requirement.id);

    return {
      base,
      candidates,
      groupId: group?.id ?? "GROUP-OTHER",
      groupTitle: group?.title ?? "Other"
    };
  });

  return {
    jobId: job.id,
    resumeId: resume.id,
    requirements,
    groups,
    links: requirements.flatMap(
      result => result.base.links
    ),
    summary: createSummary(requirements),
    analysisMode: "local"
  };
}
