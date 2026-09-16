const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "have", "has", "in", "into", "is", "it", "of", "on", "or", "that",
  "the", "their", "this", "to", "with", "you", "your",

  "experience", "experienced", "engineering", "engineer", "software",
  "system", "systems", "team", "teams", "development", "technology",
  "technical", "lead", "leadership", "responsibility", "responsibilities",
  "strong", "ability", "familiarity", "including", "across", "within",
  "provide", "providing", "ensure", "ensuring", "drive", "driving",
  "work", "working", "role", "roles", "use", "using", "support",
  "supporting", "knowledge", "skills", "skill", "level", "levels",
  "senior", "modern", "core", "overall", "direct", "clear", "effective",
  "high", "quality", "best", "good", "new", "full", "entire"
]);

const GENERIC_CONCEPTS = new Set([
  "software",
  "engineering",
  "system",
  "systems",
  "team",
  "teams",
  "development",
  "technical",
  "technology",
  "leadership",
  "experience",
  "design",
  "architecture",
  "delivery",
  "execution",
  "management",
  "communication"
]);

const ALIASES: Record<string, string[]> = {
  python: ["python", "python3"],
  javascript: ["javascript", "js"],
  typescript: ["typescript", "ts"],
  "c++": ["c++", "cpp"],
  "c#": ["c#", "csharp"],
  "machine learning": ["machine learning", "ml"],
  ai: ["ai", "artificial intelligence"],
  llm: ["llm", "llms", "large language model", "large language models"],
  "ci/cd": ["ci/cd", "continuous integration", "continuous delivery"],
  "software architecture": ["software architecture", "architecture"],
  "automated testing": ["automated testing", "test automation"],
  "distributed systems": ["distributed systems", "distributed system"],
  "embedded systems": ["embedded systems", "embedded system"]
};

export interface ConceptMatchResult {
  matched: boolean;
  score: number;
  matchedConcepts: string[];
  specificMatches: string[];
  genericMatches: string[];
  requirementSpecificCount: number;
  evidenceSpecificCount: number;
}

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w+#./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandTerm(term: string): string[] {
  const normalized = normalize(term);
  return Array.from(
    new Set([
      normalized,
      ...(ALIASES[normalized] ?? [])
    ])
  );
}

export function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter(Boolean);
}

export function getSpecificTerms(value: string): string[] {
  return Array.from(
    new Set(
      tokenize(value).filter(
        (token) =>
          token.length > 2 &&
          !STOP_WORDS.has(token) &&
          !GENERIC_CONCEPTS.has(token)
      )
    )
  );
}

function containsTerm(
  evidenceText: string,
  term: string
): boolean {
  const normalizedEvidence = normalize(evidenceText);

  return expandTerm(term).some((alternative) => {
    if (alternative.includes(" ")) {
      return normalizedEvidence.includes(alternative);
    }

    return tokenize(normalizedEvidence).includes(alternative);
  });
}

function conceptPresent(
  evidenceText: string,
  concept: string
): boolean {
  return expandTerm(concept).some((alternative) =>
    containsTerm(evidenceText, alternative)
  );
}

export function matchConcepts(
  requirementText: string,
  evidenceText: string,
  requirementConcepts: string[] = [],
  evidenceConcepts: string[] = []
): ConceptMatchResult {
  const requirementSpecificTerms = getSpecificTerms(requirementText);

  const specificMatches: string[] = [];
  const genericMatches: string[] = [];

  for (const term of requirementSpecificTerms) {
    if (containsTerm(evidenceText, term)) {
      specificMatches.push(term);
    }
  }

  for (const concept of requirementConcepts) {
    const normalized = normalize(concept);

    if (!normalized) continue;

    if (GENERIC_CONCEPTS.has(normalized)) {
      if (conceptPresent(evidenceText, normalized)) {
        genericMatches.push(normalized);
      }
      continue;
    }

    if (
      conceptPresent(evidenceText, normalized) &&
      !specificMatches.includes(normalized)
    ) {
      specificMatches.push(normalized);
    }
  }

  // Evidence concepts can strengthen a match but cannot create
  // support by themselves when the requirement has specific terms.
  for (const concept of evidenceConcepts) {
    const normalized = normalize(concept);

    if (
      normalized &&
      GENERIC_CONCEPTS.has(normalized) &&
      !genericMatches.includes(normalized)
    ) {
      genericMatches.push(normalized);
    }
  }

  const uniqueSpecific = Array.from(new Set(specificMatches));
  const uniqueGeneric = Array.from(new Set(genericMatches));

  const requirementSpecificCount =
    Math.max(requirementSpecificTerms.length, 1);

  const evidenceSpecificCount = uniqueSpecific.length;

  if (requirementSpecificTerms.length === 0) {
    const genericScore =
      uniqueGeneric.length > 0 ? 0.2 : 0;

    return {
      matched: genericScore > 0,
      score: genericScore,
      matchedConcepts: uniqueGeneric,
      specificMatches: [],
      genericMatches: uniqueGeneric,
      requirementSpecificCount: 0,
      evidenceSpecificCount: 0
    };
  }

  const coverage =
    evidenceSpecificCount / requirementSpecificCount;

  /*
   * Require meaningful coverage of the requirement.
   *
   * 1/1  -> potentially strong
   * 1/2  -> partial
   * 1/3+ -> weak/related
   *
   * A single matching word should not make a compound requirement
   * appear strongly supported.
   */
  let score = 0;

  if (coverage >= 0.8) {
    score = 0.9;
  } else if (coverage >= 0.5) {
    score = 0.55;
  } else if (coverage > 0) {
    score = 0.12;
  }

  // Small bonus for genuinely relevant surrounding evidence.
  if (uniqueGeneric.length > 0 && score > 0) {
    score += 0.03;
  }

  score = Math.min(score, 0.95);

  return {
    matched: score > 0,
    score: Number(score.toFixed(3)),
    matchedConcepts: [
      ...uniqueSpecific,
      ...uniqueGeneric
    ],
    specificMatches: uniqueSpecific,
    genericMatches: uniqueGeneric,
    requirementSpecificCount,
    evidenceSpecificCount
  };
}
