import type { JobSectionType } from "./JobSection";

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

  /**
   * SOURCE PROVENANCE: The section type this requirement came from.
   * Used to preserve context and improve classification.
   */
  sourceSection?: JobSectionType;

  /**
   * SOURCE PROVENANCE: The heading of the section this came from.
   * Useful for highlighting and source tracking.
   */
  sourceHeading?: string;

  /**
   * SOURCE PROVENANCE: Index in the original section content.
   * Helps locate this requirement in the source job posting.
   */
  sourceBlockIndex?: number;

  /**
   * EXTRACTION METADATA: How this requirement was extracted.
   * "structured" = from identified section structure
   * "fallback" = from fallback/heuristic extraction when structure unavailable
   */
  extractionMethod?: "structured" | "fallback";

  /**
   * EXTRACTION METADATA: Years of experience if explicitly stated.
   * Extracted from patterns like "3+ years", "at least 5 years", etc.
   */
  yearsExperience?: number;

  /**
   * EXTRACTION METADATA: Whether this is explicitly marked as "preferred"
   * vs required by being in a Preferred Qualifications section.
   * Takes precedence over type-based inference.
   */
  isPreferred?: boolean;
}
