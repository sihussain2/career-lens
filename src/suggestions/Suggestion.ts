export type SuggestionType =
  | "REWORD"
  | "REORDER"
  | "ADD"
  | "REMOVE"
  | "EMPHASIZE"
  | "DE_EMPHASIZE"
  | "NO_CHANGE";

export type SuggestionStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "EDITED";

export interface Suggestion {
  id: string;
  type: SuggestionType;
  sectionId: string;
  original?: string;
  proposed?: string;
  reason: string;
  evidenceIds: string[];
  requirementIds: string[];
  confidence: number;
  status: SuggestionStatus;
}
