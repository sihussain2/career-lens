import type { Job } from "../job/model/Job";
import type { Resume } from "../resume/model/Resume";
import type { Evidence } from "../resume/evidence/evidence";
import type {
  EvidenceLink,
  EvidenceRelationship
} from "../resume/evidence/evidence-graph";
import {
  matchRequirement,
  type RequirementMatchResult
} from "./matching/requirement-matcher";

export interface AnalysisSummary {
  totalRequirements: number;
  strongSupport: number;
  partialSupport: number;
  related: number;
  contradicts: number;
  noSupport: number;
}

export interface JobResumeAnalysis {
  jobId: string;
  resumeId: string;
  requirements: RequirementMatchResult[];
  links: EvidenceLink[];
  summary: AnalysisSummary;
}

function createSummary(
  results: RequirementMatchResult[]
): AnalysisSummary {
  const summary: AnalysisSummary = {
    totalRequirements: results.length,
    strongSupport: 0,
    partialSupport: 0,
    related: 0,
    contradicts: 0,
    noSupport: 0
  };

  for (const result of results) {
    switch (result.bestRelationship) {
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

export function analyzeJobAgainstResume(
  job: Job,
  resume: Resume,
  evidence: Evidence[]
): JobResumeAnalysis {
  const requirements = job.requirements.map(
    (requirement) =>
      matchRequirement(requirement, evidence)
  );

  const links = requirements.flatMap(
    (result) => result.links
  );

  return {
    jobId: job.id,
    resumeId: resume.id,
    requirements,
    links,
    summary: createSummary(requirements)
  };
}
