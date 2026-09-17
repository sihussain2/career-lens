import type { JobRequirement } from "../model/JobRequirement";

/**
 * Deduplicate requirements by detecting exact matches, substrings,
 * and high word overlap.
 *
 * Strategy:
 * - Exact matches: remove duplicates
 * - Substring matches: keep longer version
 * - High word overlap (60%+): treat as duplicates, keep first
 *
 * Order preserved: removes later duplicates, keeps earlier ones.
 */

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getWords(text: string): Set<string> {
  return new Set(
    normalizeForComparison(text)
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

function calculateWordOverlap(text1: string, text2: string): number {
  const words1 = getWords(text1);
  const words2 = getWords(text2);

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  let overlap = 0;

  for (const word of words1) {
    if (words2.has(word)) {
      overlap++;
    }
  }

  const totalWords = Math.max(words1.size, words2.size);

  return overlap / totalWords;
}

function isExactDuplicate(text1: string, text2: string): boolean {
  return (
    normalizeForComparison(text1) === normalizeForComparison(text2)
  );
}

function isSubstringMatch(
  text1: string,
  text2: string
): "exact" | "text1_contains" | "text2_contains" | null {
  const norm1 = normalizeForComparison(text1);
  const norm2 = normalizeForComparison(text2);

  if (norm1 === norm2) {
    return "exact";
  }

  // One text contains the other as a substring
  // with at least 80% match
  if (norm1.includes(norm2) && norm2.length / norm1.length > 0.8) {
    return "text1_contains";
  }

  if (norm2.includes(norm1) && norm1.length / norm2.length > 0.8) {
    return "text2_contains";
  }

  return null;
}

/**
 * Main deduplication function.
 *
 * Returns a deduplicated list, preserving order and keeping the first
 * occurrence of each duplicate group.
 */
export function deduplicateRequirements(
  requirements: JobRequirement[]
): JobRequirement[] {
  if (requirements.length === 0) {
    return [];
  }

  const result: JobRequirement[] = [];
  const duplicateIndices = new Set<number>();

  for (let i = 0; i < requirements.length; i++) {
    if (duplicateIndices.has(i)) {
      continue; // Already marked as duplicate
    }

    const req1 = requirements[i];
    result.push(req1);

    // Check against all subsequent requirements
    for (let j = i + 1; j < requirements.length; j++) {
      if (duplicateIndices.has(j)) {
        continue;
      }

      const req2 = requirements[j];

      // Check for exact match
      if (isExactDuplicate(req1.text, req2.text)) {
        duplicateIndices.add(j);

        continue;
      }

      // Check for substring match
      const substringMatch = isSubstringMatch(req1.text, req2.text);

      if (substringMatch === "exact") {
        duplicateIndices.add(j);

        continue;
      }

      if (substringMatch === "text1_contains") {
        // req1 is more complete, req2 is subset
        duplicateIndices.add(j);

        continue;
      }

      if (substringMatch === "text2_contains") {
        // req2 is more complete than req1
        // Remove req1 from results and mark j for checking against others
        result.pop();
        duplicateIndices.add(i);
        break;
      }

      // Check for high word overlap
      const overlap = calculateWordOverlap(req1.text, req2.text);

      if (overlap >= 0.6) {
        // Likely duplicates
        // Keep the first one (req1), mark the second (req2) as duplicate
        duplicateIndices.add(j);
      }
    }
  }

  return result;
}

/**
 * Filter out requirements that are too generic or trivial.
 *
 * Examples:
 * - "Be a team player" (too vague)
 * - "Communicate effectively" (everyone knows this)
 * - "Have an interest in tech" (too generic)
 */
export function filterTrivialRequirements(
  requirements: JobRequirement[]
): JobRequirement[] {
  const trivialPatterns = [
    /^be\s+a\s+/i, // "be a team player"
    /^communicate/i, // "communicate effectively"
    /^have\s+(a\s+)?interest\s+in/i, // "have interest in"
    /^ability\s+to\s+(work|collaborate)/i, // "ability to work in teams"
    /^willingness\s+to/i, // "willingness to learn"
    /^passion\s+for/i, // "passion for tech"
    /^strong\s+(written|verbal|communication)/i, // "strong communication skills"
    /^organizational\s+skills/i, // "organizational skills"
    /^problem.solving\s+skills/i, // "problem-solving skills"
  ];

  return requirements.filter(req => {
    const normalized = req.text.toLowerCase().trim();

    // If matches trivial pattern and is short, filter it
    for (const pattern of trivialPatterns) {
      if (pattern.test(normalized) && req.text.length < 60) {
        return false;
      }
    }

    return true;
  });
}
