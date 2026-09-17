/**
 * Represents a structured section of a job posting.
 *
 * Sections are identified by heading/boundary detection and classified
 * to understand what type of content they contain.
 *
 * Used as an intermediate representation during extraction to preserve
 * provenance and structure before converting to JobRequirement[].
 */

export type JobSectionType =
  | "description"
  | "responsibilities"
  | "day_in_the_life"
  | "team"
  | "about_the_company"
  | "basic_qualifications"
  | "preferred_qualifications"
  | "nice_to_have"
  | "other";

export interface JobSection {
  /**
   * Unique identifier for this section.
   */
  id: string;

  /**
   * The heading/title of the section as found in the source.
   */
  heading: string;

  /**
   * Normalized heading for comparison (lowercase, whitespace-normalized).
   */
  normalizedHeading: string;

  /**
   * Semantic type of this section.
   */
  type: JobSectionType;

  /**
   * Content blocks within this section.
   * Each block is typically a paragraph or bullet point.
   */
  blocks: JobSectionBlock[];

  /**
   * Whether this is a required section (basic qualifications)
   * vs preferred (nice to have).
   * Used to infer requirement priority.
   */
  isRequired?: boolean;

  /**
   * For debugging/source tracking: line range in the original content.
   */
  sourceStartIndex?: number;
  sourceEndIndex?: number;
}

/**
 * A single content block within a section.
 * Typically a bullet point or paragraph.
 */
export interface JobSectionBlock {
  /**
   * The actual text of this block.
   */
  text: string;

  /**
   * Original source text (may differ from text if normalized).
   */
  sourceText: string;

  /**
   * Type of block: bullet point or paragraph.
   */
  type: "bullet" | "paragraph";

  /**
   * If this is a bullet, the exact bullet character(s) used in source.
   * Useful for reconstruction and highlighting.
   */
  bulletMarker?: string;

  /**
   * Line/index in the original content where this block starts.
   */
  sourceIndex: number;

  /**
   * Reference to the DOM element if extracted from structured DOM.
   */
  sourceElement?: Element;

  /**
   * Whether this block appears to be a continuation of the previous block
   * (wrapped/multiline bullet).
   */
  isContinuation?: boolean;
}
