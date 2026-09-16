export type RequirementType =
  | "required_skill"
  | "preferred_skill"
  | "responsibility"
  | "qualification"
  | "experience"
  | "education"
  | "other";

export type RequirementPriority =
  | "high"
  | "medium"
  | "low";

export interface JobRequirement {
  id: string;
  text: string;
  type: RequirementType;
  priority: RequirementPriority;
  normalizedConcepts: string[];
  sourceText: string;

  /**
   * Optional semantic grouping assigned after extraction.
   * Extraction does not need to know the group.
   */
  groupId?: string;
  groupTitle?: string;
}
