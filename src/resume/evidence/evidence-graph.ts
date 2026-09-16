export type EvidenceRelationship =
  | "strong_support"
  | "partial_support"
  | "related"
  | "contradicts"
  | "no_support";

export type EvidenceLinkSource =
  | "local"
  | "ai";

export interface EvidenceLink {
  id: string;

  requirementId: string;

  evidenceId: string;

  relationship: EvidenceRelationship;

  source: EvidenceLinkSource;

  confidence: number;
}
