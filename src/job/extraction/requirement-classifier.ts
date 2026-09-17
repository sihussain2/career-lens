import type {
  RequirementType,
  RequirementPriority,
} from "../model/JobRequirement";
import type { JobSectionType } from "../model/JobSection";
import {
  extractYearsOfExperience,
  isExperienceStatement,
  isEducationStatement,
  isResponsibilityStatement,
  extractNormalizedConcepts,
} from "./requirement-normalizer";

/**
 * Classify a requirement text into a RequirementType.
 *
 * Classification considers:
 * - Source section type
 * - Whether it's marked as preferred
 * - Wording patterns (responsibility verbs, education keywords, etc.)
 * - Explicit experience/education indicators
 */
export function classifyRequirementType(
  text: string,
  sourceSection?: JobSectionType,
  isPreferred?: boolean
): RequirementType {
  // Strong section context signals
  if (
    sourceSection === "responsibilities" ||
    sourceSection === "day_in_the_life"
  ) {
    return "responsibility";
  }

  if (sourceSection === "basic_qualifications") {
    // Could be experience, education, or qualification
    // Distinguish based on wording
    if (isEducationStatement(text)) {
      return "education";
    }

    if (isExperienceStatement(text)) {
      return "experience";
    }

    return "qualification";
  }

  if (
    sourceSection === "preferred_qualifications" ||
    sourceSection === "nice_to_have"
  ) {
    // Same logic, but tagged as preferred if needed
    if (isEducationStatement(text)) {
      return "education";
    }

    if (isExperienceStatement(text)) {
      return "experience";
    }

    return isPreferred ? "preferred_skill" : "qualification";
  }

  // No strong section context - use text analysis
  if (isEducationStatement(text)) {
    return "education";
  }

  if (isExperienceStatement(text)) {
    return "experience";
  }

  if (isResponsibilityStatement(text)) {
    return "responsibility";
  }

  // Default based on preferred/required
  return isPreferred ? "preferred_skill" : "required_skill";
}

/**
 * Infer priority (high, medium, low) based on various signals.
 *
 * Signals:
 * - Years of experience (more years = higher priority)
 * - Section type (basic qualifications = high)
 * - Keyword strength (core technologies = high)
 * - Responsibility level (leadership = high)
 */
export function inferPriority(
  text: string,
  sourceSection?: JobSectionType,
  isPreferred?: boolean
): RequirementPriority {
  // Preferred qualifications are lower priority
  if (isPreferred || sourceSection === "nice_to_have") {
    return "low";
  }

  // Basic qualifications in required sections are high priority
  if (sourceSection === "basic_qualifications") {
    return "high";
  }

  // Responsibilities are medium to high
  if (
    sourceSection === "responsibilities" ||
    sourceSection === "day_in_the_life"
  ) {
    const normalized = text.toLowerCase();

    // Leadership responsibilities are high
    if (
      /lead|manage|direct|mentor|architect|strategic/.test(
        normalized
      )
    ) {
      return "high";
    }

    return "medium";
  }

  // Use text analysis for priority
  const normalized = text.toLowerCase();
  const yearsExperience =
    extractYearsOfExperience(text);

  // More years of experience = higher priority
  if (yearsExperience !== undefined) {
    if (yearsExperience >= 5) {
      return "high";
    }

    if (yearsExperience >= 2) {
      return "medium";
    }

    return "low";
  }

  // Leadership/core responsibilities are high priority
  if (
    /lead|manage|architect|core|critical|essential|fundamental/.test(
      normalized
    )
  ) {
    return "high";
  }

  // Nice-to-have language = low priority
  if (/nice to have|bonus|preferred|ideal|helpful|beneficial/.test(normalized)) {
    return "low";
  }

  // Default to medium
  return "medium";
}

/**
 * Determine if a requirement should be marked as "preferred".
 *
 * This is based on:
 * - Explicit preferred section
 * - Preferred language in the text
 * - Preferred type classification
 */
export function shouldMarkAsPreferred(
  text: string,
  sourceSection?: JobSectionType,
  requirementType?: RequirementType
): boolean {
  if (
    sourceSection === "preferred_qualifications" ||
    sourceSection === "nice_to_have"
  ) {
    return true;
  }

  if (requirementType === "preferred_skill") {
    return true;
  }

  const normalized = text.toLowerCase();

  if (
    /nice to have|bonus|preferred|ideal|helpful|beneficial|plus/.test(
      normalized
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Split a requirement block into multiple requirements if appropriate.
 *
 * This is conservative - only split when absolutely clear.
 *
 * Examples that should split:
 * - "Manage teams. Create roadmaps. Design systems."
 * - "3+ years of management. 5+ years of system design."
 *
 * Examples that should NOT split:
 * - "Experience with Python, Go, and JavaScript"
 * - "Leadership of engineering teams, technical strategy, and architecture"
 */
export function shouldSplitRequirement(text: string): boolean {
  const normalized = text.toLowerCase().trim();

  // Too short to meaningfully split
  if (normalized.length < 50) {
    return false;
  }

  // Multiple independent sentences with period
  // Only if they start with different verbs
  const sentences = normalized.split(/[.!?]+/).filter(s => s.trim());

  if (sentences.length >= 2) {
    // Check if sentences start with independent action verbs
    const verbs = ["lead", "manage", "create", "design", "build", "develop", "drive"];
    const hasMultipleVerbs = sentences.filter(s => {
      const trimmed = s.trim();

      return verbs.some(v => trimmed.startsWith(v));
    }).length >= 2;

    return hasMultipleVerbs;
  }

  return false;
}

/**
 * Attempt to split a compound requirement.
 *
 * Used conservatively for clearly independent requirements.
 */
export function tryShortRequirements(text: string): string[] {
  if (!shouldSplitRequirement(text)) {
    return [text];
  }

  // Split on periods followed by capital letters
  const parts = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  return parts.map(p => p.trim());
}
