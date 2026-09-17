import type { JobSection, JobSectionType } from "../model/JobSection";

/**
 * Recognizes section headings in job content and classifies them.
 *
 * Handles variations:
 * - Case insensitive
 * - Whitespace variations
 * - Punctuation variations
 * - Common apostrophe/quote variations
 */

interface SectionHeadingPattern {
  normalized: string;
  type: JobSectionType;
  isRequired?: boolean;
}

const SECTION_PATTERNS: SectionHeadingPattern[] = [
  // Descriptions
  { normalized: "about the job", type: "description" },
  { normalized: "about the role", type: "description" },
  { normalized: "role description", type: "description" },
  { normalized: "description", type: "description" },
  { normalized: "job description", type: "description" },

  // Responsibilities
  { normalized: "responsibilities", type: "responsibilities" },
  { normalized: "key responsibilities", type: "responsibilities" },
  { normalized: "key job responsibilities", type: "responsibilities" },
  { normalized: "your responsibilities", type: "responsibilities" },
  { normalized: "role responsibilities", type: "responsibilities" },
  { normalized: "what youll do", type: "responsibilities" },
  { normalized: "what youll be doing", type: "responsibilities" },
  { normalized: "what you will do", type: "responsibilities" },
  { normalized: "what you will be doing", type: "responsibilities" },
  { normalized: "in this role", type: "responsibilities" },
  { normalized: "the role", type: "responsibilities" },

  // Day in the life
  { normalized: "a day in the life", type: "day_in_the_life" },
  { normalized: "day in the life", type: "day_in_the_life" },
  { normalized: "typical day", type: "day_in_the_life" },

  // Team
  { normalized: "about the team", type: "team" },
  { normalized: "meet the team", type: "team" },
  { normalized: "the team", type: "team" },
  { normalized: "our team", type: "team" },

  // About company
  { normalized: "about the company", type: "about_the_company" },
  { normalized: "about us", type: "about_the_company" },
  { normalized: "company overview", type: "about_the_company" },

  // Basic qualifications (required)
  { normalized: "qualifications", type: "basic_qualifications", isRequired: true },
  { normalized: "requirements", type: "basic_qualifications", isRequired: true },
  { normalized: "basic qualifications", type: "basic_qualifications", isRequired: true },
  { normalized: "minimum qualifications", type: "basic_qualifications", isRequired: true },
  { normalized: "required qualifications", type: "basic_qualifications", isRequired: true },
  { normalized: "key qualifications", type: "basic_qualifications", isRequired: true },
  { normalized: "what were looking for", type: "basic_qualifications", isRequired: true },
  { normalized: "what were looking for", type: "basic_qualifications", isRequired: true },
  { normalized: "what you should have", type: "basic_qualifications", isRequired: true },
  { normalized: "who you are", type: "basic_qualifications", isRequired: true },

  // Preferred qualifications
  { normalized: "preferred qualifications", type: "preferred_qualifications" },
  { normalized: "preferred", type: "preferred_qualifications" },
  { normalized: "nice to have", type: "nice_to_have" },
  { normalized: "nice-to-have", type: "nice_to_have" },
  { normalized: "bonus", type: "nice_to_have" },
  { normalized: "bonus points", type: "nice_to_have" },
  { normalized: "bonus skills", type: "nice_to_have" },
];

function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[•●▪◦‣⁃]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectSectionType(heading: string): {
  type: JobSectionType;
  isRequired?: boolean;
} | null {
  const normalized = normalizeHeading(heading);

  for (const pattern of SECTION_PATTERNS) {
    if (pattern.normalized === normalized) {
      return {
        type: pattern.type,
        isRequired: pattern.isRequired,
      };
    }
  }

  return null;
}

export function isSectionHeading(heading: string): boolean {
  return detectSectionType(heading) !== null;
}

/**
 * Parse section headings from lines and return identified sections.
 * Does not parse content blocks within sections.
 */
export function parseSections(
  lines: Array<{ text: string; index: number; sourceElement?: Element }>
): Array<{
  startLineIndex: number;
  heading: string;
  type: JobSectionType;
  isRequired?: boolean;
}> {
  const sections = [];
  let currentId = 0;

  for (let i = 0; i < lines.length; i++) {
    const detection = detectSectionType(lines[i].text);

    if (detection) {
      sections.push({
        startLineIndex: i,
        heading: lines[i].text,
        type: detection.type,
        isRequired: detection.isRequired,
      });
      currentId++;
    }
  }

  return sections;
}
