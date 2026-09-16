import type { EvidenceCandidate } from "../analysis/matching/evidence-retriever";

export type SemanticRelationship =
  | "strong_support"
  | "partial_support"
  | "related"
  | "contradicts"
  | "no_support";

export interface SemanticEvidenceAssessment {
  evidenceId: string;
  relationship: SemanticRelationship;
  confidence: number;
  explanation: string;
}

export interface SemanticRequirementAnalysis {
  requirementId: string;
  relationship: SemanticRelationship;
  confidence: number;
  explanation: string;
  evidence: SemanticEvidenceAssessment[];
}

export interface SemanticSuggestion {
  type:
    | "REWORD"
    | "REORDER"
    | "ADD"
    | "REMOVE"
    | "EMPHASIZE"
    | "DE_EMPHASIZE"
    | "NO_CHANGE";

  sectionId: string;
  original?: string;
  proposed?: string;
  reason: string;
  evidenceIds: string[];
  requirementIds: string[];
  confidence: number;
}

export interface LLMRequirementContext {
  requirementId: string;
  requirementText: string;
  requirementType: string;
  requirementPriority: string;
  candidates: EvidenceCandidate[];
}

export interface LLMAnalysisRequest {
  requirements: LLMRequirementContext[];
}

export interface LLMAnalysisResponse {
  requirements: SemanticRequirementAnalysis[];
  suggestions: SemanticSuggestion[];
}

export interface LLMClient {
  analyze(
    request: LLMAnalysisRequest
  ): Promise<LLMAnalysisResponse>;
}


/*
 * Backward-compatible names used by the existing type barrel.
 */
export type SemanticAnalysisRequest =
  LLMAnalysisRequest;

export type SemanticAnalysisResponse =
  LLMAnalysisResponse;


export interface LLMProviderConfig {
  endpoint: string;
  model: string;
  apiKey?: string;
}
