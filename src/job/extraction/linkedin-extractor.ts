import type {
  Job,
  JobSourceType
} from "../model/Job";

import type {
  JobRequirement,
  RequirementPriority,
  RequirementType
} from "../model/JobRequirement";

interface TextLine {
  text: string;
  index: number;
  sourceElement?: Element;
}

interface SectionRange {
  start: number;
  end: number;
  heading: string;
  sourceElement?: Element;
}

interface ExtractionResult {
  title: string;
  company?: string;
  location?: string;
  description: string;
  requirements: JobRequirement[];
}

/**
 * Represents a section with its heading and cleaned content lines.
 * Used internally to preserve section context throughout extraction.
 */
interface ContentSection {
  heading: string;
  normalizedHeading: string;
  sectionType: "responsibility" | "requirement" | "context" | "non-requirement";
  lines: TextLine[];
}

const ABOUT_THE_JOB = "about the job";

const DESCRIPTION_END_MARKERS = [
  "benefits and perks",
  "benefits & perks",
  "work environment & flexibility",
  "inclusion",
  "about the company",
  "benefits found in job post",
  "set alert for similar jobs",
  "unlock hiring insights",
  "applicant education level",
  "applicant seniority level"
];

// Basic qualifications / Required qualifications
const BASIC_QUALIFICATIONS_HEADINGS = [
  "what we are looking for",
  "what we're looking for",
  "requirements",
  "qualifications",
  "basic qualifications",
  "minimum qualifications",
  "required qualifications",
  "key qualifications",
  "what you'll bring",
  "what you bring",
  "skills and qualifications",
  "must-haves",
  "must haves",
  "who you are",
  "experience",
  "valued skills and experience",
  "skills and experience"
];

// Preferred qualifications
const PREFERRED_QUALIFICATIONS_HEADINGS = [
  "preferred qualifications",
  "preferred",
  "nice to have",
  "nice-to-have",
  "bonus",
  "bonus points",
  "bonus skills",
  "additional qualifications",
  "additional skills",
  "a day in the life"
];

// Responsibilities section headings (bulleted responsibilities/tasks)
const RESPONSIBILITY_HEADINGS = [
  "responsibilities",
  "what you'll do",
  "what you will do",
  "your responsibilities",
  "key responsibilities",
  "role responsibilities",
  "in this role",
  "what you'll be doing",
  "what you will be doing",
  "the role",
  "role overview",
  "day-to-day responsibilities",
  "day to day responsibilities"
];

// Description/context sections (preserve but don't treat as requirements sections)
const CONTEXT_SECTION_HEADINGS = [
  "description",
  "about the job",
  "about the team",
  "the team",
  "meet the team",
  "our team",
  "what we value",
  "our culture",
  "about the role",
  "about this role",
  "role description",
  "our mission",
  "company mission"
];

// Non-requirement sections that should explicitly be excluded
const COMPANY_ABOUT_HEADINGS = [
  "about the company",
  "about us",
  "about our company",
  "who we are",
  "company overview"
];

const COMPENSATION_BENEFITS_HEADINGS = [
  "compensation",
  "compensation and benefits",
  "compensation & benefits",
  "benefits",
  "benefits and perks",
  "benefits & perks",
  "perks",
  "what we offer",
  "what we offer colleagues",
  "why you'll love it",
  "why you'll love working here",
  "why we love our team",
  "employment type",
  "work environment",
  "work environment & flexibility"
];

const TECHNOLOGY_CONTEXT_HEADINGS = [
  "technology",
  "tech stack",
  "our stack",
  "technology stack",
  "our tech stack"
];

const LINKEDIN_BOILERPLATE_HEADINGS = [
  "set alert for similar jobs",
  "unlock hiring insights",
  "show more",
  "show less",
  "view similar jobs",
  "hiring insights",
  "applicant statistics",
  "applicant education level",
  "applicant seniority level"
];

const GENERIC_HEADING_PATTERNS = [
  /^about\s+/i,
  /^location$/i,
  /^responsibilities$/i,
  /^requirements$/i,
  /^qualifications$/i,
  /^preferred qualifications$/i,
  /^nice to have$/i,
  /^what (we|you)\b.*$/i
];

const COMMON_NOISE_LINES = new Set([
  "home",
  "my network",
  "jobs",
  "messaging",
  "notifications",
  "me",
  "for business",
  "retry premium",
  "apply",
  "save",
  "show match details",
  "tailor my resume",
  "help me stand out",
  "use ai to assess how you fit",
  "hybrid",
  "full-time",
  "full time",
  "off",
  "follow",
  "show more",
  "show less",
  "… more",
  "... more",
  "easy apply",
  "don't show again",
  "view similar jobs",
  "similar jobs",
  "job alerts",
  "hiring insights",
  "applicant statistics",
  "applicant education level",
  "applicant seniority level",
  "applicant work history",
  "premium member",
  "sign in with",
  "or",
  "and",
  "to",
  "the",
  "scroll to see more",
  "report this job"
]);

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .trim();
}

function normalizeForComparison(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Attempts to extract job-specific content from the DOM first,
 * falling back to document.body.innerText if specific selectors don't work.
 * LinkedIn DOM varies significantly, so we try multiple robust approaches.
 */
function getJobContentText(): string {
  // Try common LinkedIn job description container selectors
  const selectors = [
    // Modern LinkedIn job description container
    ".show-more-less-html__markup",
    // Alternative container
    "[data-testid='description'] .show-more-less-html",
    // Job details section
    ".jobs-details__main-content",
    // Fallback generic article content
    "article",
    // Section with role details
    "[role='main']"
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (element && element.innerText) {
      const text = element.innerText.trim();
      // Only use if we got substantial content (avoid empty containers)
      if (text.length > 100) {
        return text;
      }
    }
  }

  // Fallback to full body text
  return document.body?.innerText ?? "";
}

/**
 * Extract structured DOM elements for job description sections.
 * Returns arrays of TextLines with source element references.
 * This preserves the original DOM structure (lists, paragraphs) before converting to text.
 */
function extractStructuredJobContent(): TextLine[] {
  const lines: TextLine[] = [];
  let lineIndex = 0;

  // Try to find the job description container
  const selectors = [
    ".show-more-less-html__markup",
    "[data-testid='description'] .show-more-less-html",
    ".jobs-details__main-content",
    "article",
    "[role='main']"
  ];

  let container: HTMLElement | null = null;

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && (el as HTMLElement).innerText) {
      const text = (el as HTMLElement).innerText;
      if (text.length > 100) {
        container = el as HTMLElement;
        break;
      }
    }
  }

  if (!container) {
    return [];
  }

  // Walk through child elements to extract structure
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeWhitespace(
        node.textContent ?? ""
      );

      if (text && text.length > 0) {
        lines.push({
          text,
          index: lineIndex++,
          sourceElement: node.parentElement ?? undefined
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement;
      const tagName = elem.tagName.toLowerCase();

      // Handle list items - each is a separate line/bullet
      if (tagName === "li") {
        const text = normalizeWhitespace(
          elem.innerText ?? ""
        );

        if (text && text.length > 0) {
          // Preserve that this came from a list item
          lines.push({
            text: `• ${text}`,
            index: lineIndex++,
            sourceElement: elem
          });
        }
      }
      // Handle headings
      else if (/^h[1-6]$/.test(tagName)) {
        const text = normalizeWhitespace(
          elem.innerText ?? ""
        );

        if (text && text.length > 0) {
          lines.push({
            text,
            index: lineIndex++,
            sourceElement: elem
          });
        }
      }
      // Handle paragraphs
      else if (tagName === "p") {
        const text = normalizeWhitespace(
          elem.innerText ?? ""
        );

        if (text && text.length > 0) {
          lines.push({
            text,
            index: lineIndex++,
            sourceElement: elem
          });
        }
      }
      // For other containers, recurse
      else {
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
        }
      }
    }
  };

  walk(container);

  return lines;
}

/**
 * Better section type detection based on heading patterns.
 * Classifies sections into requirement-bearing vs non-requirement categories.
 */
function detectSectionType(
  heading: string
): "responsibility" | "requirement" | "context" | "non-requirement" {
  const normalized = normalizeForComparison(heading);

  // Check explicit non-requirement sections first
  if (
    COMPANY_ABOUT_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    ) ||
    COMPENSATION_BENEFITS_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    ) ||
    TECHNOLOGY_CONTEXT_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    ) ||
    LINKEDIN_BOILERPLATE_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    )
  ) {
    return "non-requirement";
  }

  // Requirement-bearing sections
  if (
    RESPONSIBILITY_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    )
  ) {
    return "responsibility";
  }

  if (
    BASIC_QUALIFICATIONS_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    ) ||
    PREFERRED_QUALIFICATIONS_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    )
  ) {
    return "requirement";
  }

  // Context/description sections (preserve but don't extract requirements)
  if (
    CONTEXT_SECTION_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    )
  ) {
    return "context";
  }

  return "non-requirement";
}

function splitSentences(text: string): string[] {
  const normalized = normalizeWhitespace(text);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(normalizeWhitespace)
    .filter(Boolean);
}

function isLikelyBullet(text: string): boolean {
  return /^[•●▪◦‣⁃\-*]\s+/.test(text);
}

function stripBullet(text: string): string {
  return normalizeWhitespace(
    text.replace(/^[•●▪◦‣⁃\-*]\s+/, "")
  );
}

function isNoiseLine(text: string): boolean {
  const normalized = normalizeForComparison(text);

  if (!normalized) {
    return true;
  }

  if (COMMON_NOISE_LINES.has(normalized)) {
    return true;
  }

  if (
    normalized.startsWith("retry premium") ||
    normalized.startsWith("unlock hiring insights") ||
    normalized.startsWith("chart with ") ||
    normalized.startsWith("the chart has ") ||
    normalized.startsWith("data ranges from ")
  ) {
    return true;
  }

  return false;
}

function isSectionHeading(text: string): boolean {
  const normalized = normalizeForComparison(text);

  if (!normalized) {
    return false;
  }

  // Check against all section heading categories
  if (
    BASIC_QUALIFICATIONS_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    ) ||
    PREFERRED_QUALIFICATIONS_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    ) ||
    RESPONSIBILITY_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    ) ||
    CONTEXT_SECTION_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalized
    )
  ) {
    return true;
  }

  return GENERIC_HEADING_PATTERNS.some((pattern) =>
    pattern.test(text)
  );
}

function isDescriptionEndMarker(text: string): boolean {
  const normalized = normalizeForComparison(text);

  return DESCRIPTION_END_MARKERS.some(
    (marker) => normalized === marker
  );
}

function isRequirementHeading(text: string): boolean {
  const sectionType = detectSectionType(text);
  return (
    sectionType === "responsibility" ||
    sectionType === "requirement"
  );
}

function inferRequirementType(
  text: string,
  sectionHeading: string
): RequirementType {
  const normalized = normalizeForComparison(
    `${sectionHeading} ${text}`
  );
  const sectionNormalized = normalizeForComparison(sectionHeading);

  // Check section context first - most reliable signal
  if (
    RESPONSIBILITY_HEADINGS.some(
      (heading) =>
        normalizeForComparison(heading) === sectionNormalized
    )
  ) {
    return "responsibility";
  }

  // Education patterns (high priority)
  if (
    normalized.includes("degree") ||
    normalized.includes("education") ||
    normalized.includes("bachelor") ||
    normalized.includes("master") ||
    normalized.includes("phd") ||
    normalized.includes("university") ||
    normalized.includes("diploma")
  ) {
    return "education";
  }

  // Experience patterns (high priority)
  if (
    normalized.includes("years of experience") ||
    normalized.includes("years experience") ||
    normalized.includes("+ years") ||
    normalized.includes("experience with") ||
    normalized.includes("experience in") ||
    normalized.includes("experience managing") ||
    normalized.includes("experience leading") ||
    normalized.includes("experience designing") ||
    normalized.includes("experience building") ||
    normalized.includes("working with") ||
    normalized.includes("working in") ||
    normalized.includes("track record") ||
    normalized.includes("background in") ||
    normalized.includes("proven experience") ||
    /\d+\+\s*years/i.test(text) ||
    /\d+-\d+\s*years/i.test(text)
  ) {
    return "experience";
  }

  // Certification/qualification patterns
  if (
    normalized.includes("certification") ||
    normalized.includes("certified") ||
    normalized.includes("license") ||
    normalized.includes("accreditation")
  ) {
    return "qualification";
  }

  // Technical skills
  const technicalTerms = [
    "python",
    "java",
    "javascript",
    "typescript",
    "c++",
    ".net",
    "redis",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "docker",
    "api",
    "apis",
    "distributed systems",
    "backend",
    "cloud",
    "machine learning",
    "artificial intelligence",
    "llm",
    "data model",
    "data models",
    "event driven",
    "event-driven",
    "sql",
    "nosql",
    "react",
    "angular",
    "vue",
    "nodejs",
    "node.js"
  ];

  if (
    technicalTerms.some((term) =>
      normalized.includes(term)
    )
  ) {
    return "required_skill";
  }

  // Preferred qualifications section
  if (
    PREFERRED_QUALIFICATIONS_HEADINGS.some(
      (heading) =>
        normalizeForComparison(heading) === sectionNormalized
    )
  ) {
    return "preferred_skill";
  }

  // Basic qualifications section - skill/qualification determination
  if (
    BASIC_QUALIFICATIONS_HEADINGS.some(
      (heading) =>
        normalizeForComparison(heading) === sectionNormalized
    )
  ) {
    // If not already classified, default to qualification for this section
    if (!normalized.includes("skill")) {
      return "qualification";
    }
    return "required_skill";
  }

  return "other";
}

function inferPriority(
  text: string,
  sectionHeading: string
): RequirementPriority {
  const normalizedText = normalizeForComparison(text);
  const normalizedHeading =
    normalizeForComparison(sectionHeading);

  // Preferred qualifications always low priority
  if (
    PREFERRED_QUALIFICATIONS_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalizedHeading
    ) ||
    normalizedText.includes("nice to have") ||
    normalizedText.includes("preferred") ||
    normalizedText.includes("optional")
  ) {
    return "low";
  }

  // Strong indicators of high priority
  if (
    normalizedText.includes("must ") ||
    normalizedText.includes("required") ||
    normalizedText.includes("minimum") ||
    normalizedText.includes("essential") ||
    normalizedHeading === "requirements" ||
    normalizedHeading === "qualifications" ||
    normalizedHeading === "what we are looking for" ||
    normalizedHeading === "what we're looking for" ||
    BASIC_QUALIFICATIONS_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalizedHeading
    )
  ) {
    return "high";
  }

  // Responsibility section defaults to medium-high
  if (
    RESPONSIBILITY_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalizedHeading
    )
  ) {
    return "medium";
  }

  return "medium";
}

function extractConcepts(text: string): string[] {
  const normalized = normalizeForComparison(text);
  const concepts = new Set<string>();

  const conceptPatterns: Array<[string, RegExp]> = [
    // Programming Languages
    ["python", /\bpython(?:3)?\b/i],
    ["java", /\bjava\b/i],
    ["javascript", /\bjavascript\b/i],
    ["typescript", /\btypescript\b/i],
    ["c++", /\bc\+\+\b/i],
    ["c#", /\bc#\b/i],
    [".net", /\.net\b/i],
    ["go", /\bgo\blang\b|\bgo\b(?!ing)/i],
    ["rust", /\brust\b/i],
    ["ruby", /\bruby\b/i],

    // Databases & Storage
    ["redis", /\bredis\b/i],
    ["mongodb", /\bmongodb\b/i],
    ["postgresql", /\bpostgres(?:ql)?\b/i],
    ["mysql", /\bmysql\b/i],
    ["cassandra", /\bcassandra\b/i],
    ["elasticsearch", /\belasticsearch\b/i],
    ["sql", /\bsql\b/i],
    ["nosql", /\bnosql\b/i],

    // Infrastructure & Deployment
    ["kubernetes", /\bk(?:8s|ubernetes)\b/i],
    ["docker", /\bdocker\b/i],
    ["aws", /\baws\b/i],
    ["azure", /\bazure\b/i],
    ["gcp", /\b(?:google\s+)?gcp\b/i],
    ["cloud infrastructure", /\bcloud infrastructure\b/i],

    // Architecture & Design Patterns
    ["distributed systems", /\bdistributed systems?\b/i],
    ["microservices", /\bmicroservices\b/i],
    ["system design", /\bsystem design\b/i],
    ["data modeling", /\bdata modell?ing\b/i],
    ["event driven architecture", /\bevent[- ]driven architecture\b/i],
    ["high availability", /\bhigh availability\b/i],

    // Performance & Scalability
    ["caching", /\bcaching\b/i],
    ["high throughput", /\bhigh throughput\b/i],
    ["scalability", /\bscalability\b/i],
    ["resiliency", /\bresilien(?:ce|cy)\b/i],
    ["performance optimization", /\bperformance optimization\b/i],

    // API & Web
    ["api", /\bapis?\b/i],
    ["rest", /\brest\b/i],
    ["graphql", /\bgraphql\b/i],

    // Frontend
    ["react", /\breact(?:\.\w+)?\b/i],
    ["angular", /\bangular\b/i],
    ["vue", /\bvue(?:\.\w+)?\b/i],
    ["html", /\bhtml[5]?\b/i],
    ["css", /\bcss[3]?\b/i],

    // Backend & Runtime
    ["nodejs", /\b(?:node\.js|node\.js|nodejs)\b/i],
    ["backend", /\bbackend\b/i],

    // AI/ML
    ["machine learning", /\bmachine learning\b/i],
    ["artificial intelligence", /\bartificial intelligence\b/i],
    ["llm", /\bllms?\b/i],
    ["deep learning", /\bdeep learning\b/i],

    // DevOps & Testing
    ["devops", /\bdevops\b/i],
    ["ci/cd", /\bci\s*\/\s*cd\b/i],
    ["testing", /\b(?:unit\s+)?testing\b/i],
    ["qa", /\bqa\b/i],

    // Leadership & Soft Skills
    ["people leadership", /\bpeople leadership\b/i],
    ["technical leadership", /\btechnical leadership\b/i],
    ["team leadership", /\bteam leadership\b/i],
    ["mentoring", /\bmentoring\b/i],
    ["coaching", /\bcoaching\b/i],

    // Collaboration & Communication
    ["product collaboration", /\bproduct\b/i],
    ["design collaboration", /\bdesign\b/i],
    ["cross-functional", /\bcross[- ]functional\b/i],
    ["communication", /\bcommunication\b/i],
    ["stakeholder management", /\bstakeholder management\b/i],

    // Engineering Practices
    ["software architecture", /\bsoftware architecture\b/i],
    ["system architecture", /\bsystem architecture\b/i],
    ["code review", /\bcode review(?:s)?\b/i],
    ["source control", /\bsource control\b/i],
    ["git", /\bgit\b/i],
    ["agile", /\bagile\b/i],
    ["scrum", /\bscrum\b/i],

    // Other Common Terms
    ["linux", /\blinux\b/i],
    ["windows", /\bwindows\b/i],
    ["security", /\bsecurity\b/i],
    ["compliance", /\bcompliance\b/i]
  ];

  for (const [concept, pattern] of conceptPatterns) {
    if (pattern.test(normalized)) {
      concepts.add(concept);
    }
  }

  return [...concepts];
}

/**
 * Extract and split experience patterns from text.
 * Recognizes: "X+ years", "X years of", "X-Y years", etc.
 * Returns array of extracted experience statements.
 */
function splitExperienceRequirements(text: string): string[] {
  const normalized = normalizeWhitespace(text);

  // Pattern: captures experience requirements like "3+ years managing", "7 years working with"
  // Matches: N+ years, N years, N-M years followed by optional context
  const experiencePattern =
    /(\d+\+?\s*(?:to\s+)?(?:\d+\+?)?\s*years\s+(?:of\s+)?(?:experience\s+)?(?:(?:managing|designing|working|building|leading|developing|implementing|architecting)[^,.\n]*?)?)(?=[,;]|$)/gi;

  const matches = normalized.match(experiencePattern);

  if (!matches || matches.length <= 1) {
    // Not a multi-part experience requirement
    return [normalized];
  }

  return matches
    .map((m) => normalizeWhitespace(m.replace(/[,;]\s*$/, "")))
    .filter((m) => m.length >= 12);
}

/**
 * Detect and split list-like content that may not have explicit bullets.
 * Looks for patterns like:
 * - "Item 1You love to mentor Item 2You are knowledgeable"
 * - "Cap letters after periods at sentence ends
 * - Common action verbs followed by content
 */
function detectAndSplitListItems(text: string): string[] {
  const normalized = normalizeWhitespace(text);

  // If it's very short, return as is
  if (normalized.length < 50) {
    return [normalized];
  }

  // Pattern 1: Split on "You " which often marks list items on LinkedIn
  // Try this FIRST because it's most reliable for LinkedIn content
  if (normalized.includes("You ")) {
    const youSplit = normalized
      .split(/(?=You\s+)/i)
      .map((item) => normalizeWhitespace(item))
      .filter((item) => item.length >= 12);

    if (youSplit.length > 1) {
      return youSplit;
    }
  }

  // Pattern 2: Detect capital letter followed by lowercase at beginning of phrases
  // that look like list items: "Item text...Item text..."
  const items: string[] = [];

  // Split on patterns that look like list boundaries:
  // 1. Capital letter after content (except after period + space which is normal)
  // 2. Action verbs that start items
  const actionVerbs = [
    "build",
    "develop",
    "lead",
    "manage",
    "ensure",
    "provide",
    "create",
    "work",
    "design",
    "implement",
    "maintain",
    "support",
    "improve",
    "collaborate",
    "act",
    "engage",
    "demonstrate",
    "set",
    "facilitate",
    "handle",
    "drive",
    "hire",
    "coach",
    "mentor"
  ];

  // Try to split on capitalized action verbs that start mid-text
  let lastSplitIndex = 0;

  for (let i = 1; i < normalized.length; i++) {
    // Look for pattern: end of previous item (lowercase letter or period) followed by space and capital letter
    if (
      i > 2 &&
      normalized[i] === " " &&
      /[a-z.]/.test(normalized[i - 1]) &&
      /[A-Z]/.test(normalized[i + 1])
    ) {
      // Extract words starting at i+1 and check if it's an action verb
      const remaining = normalized
        .substring(i + 1)
        .split(" ")[0]
        .toLowerCase();

      if (actionVerbs.includes(remaining)) {
        // This looks like a new list item
        const item = normalizeWhitespace(
          normalized.substring(lastSplitIndex, i)
        );

        if (item && item.length >= 12) {
          items.push(item);
        }

        lastSplitIndex = i + 1;
      }
    }
  }

  // Add final item
  if (lastSplitIndex < normalized.length) {
    const item = normalizeWhitespace(
      normalized.substring(lastSplitIndex)
    );

    if (item && item.length >= 12) {
      items.push(item);
    }
  }

  // If we detected multiple items via action verbs, return them
  if (items.length > 1) {
    return items;
  }

  // Pattern 3: Check for multiple sentences that might be list items
  const sentences = splitSentences(normalized);

  if (sentences.length > 1 && sentences.length <= 10) {
    // If we have 2-10 sentences, they might be list items
    return sentences.filter((s) => s.length >= 12);
  }

  return [normalized];
}

/**
 * Intelligently split requirements based on context and structure.
 * Preserves logical groupings while separating truly independent items.
 */
function splitRequirementByLogic(
  text: string,
  sectionHeading: string
): string[] {
  const normalized = normalizeWhitespace(text);

  // Check if this looks like an experience pattern (3+ years X, 5+ years Y, etc)
  if (/\d+\+?\s*(?:to\s+)?\d*\s*years/.test(text)) {
    const split = splitExperienceRequirements(text);
    if (split.length > 1) {
      return split;
    }
  }

  // For responsibility sections, try list detection first
  if (
    RESPONSIBILITY_HEADINGS.some(
      (h) => normalizeForComparison(h) === normalizeForComparison(sectionHeading)
    )
  ) {
    // Try to detect list items
    const listItems = detectAndSplitListItems(text);

    if (listItems.length > 1) {
      return listItems;
    }

    // Only split on clear sentence boundaries as fallback
    return splitSentences(normalized).filter((s) => s.length > 12);
  }

  // For requirement/qualification sections
  // Try aggressive list detection first
  const listItems = detectAndSplitListItems(text);

  if (listItems.length > 1) {
    return listItems;
  }

  // If starts with years pattern, try experience split
  if (/^\d+\+?\s*(?:to\s+)?\d*\s*years/.test(normalized)) {
    const split = splitExperienceRequirements(normalized);
    if (split.length > 1) {
      return split;
    }
  }

  // Default: use sentence splitting
  return splitSentences(normalized).filter((s) => s.length > 12);
}

function buildRequirement(
  text: string,
  sectionHeading: string
): JobRequirement | null {
  const sourceText = stripBullet(text);

  if (!sourceText) {
    return null;
  }

  if (sourceText.length < 12) {
    return null;
  }

  if (isNoiseLine(sourceText)) {
    return null;
  }

  const type = inferRequirementType(
    sourceText,
    sectionHeading
  );

  const priority = inferPriority(
    sourceText,
    sectionHeading
  );

  return {
    id: generateId("requirement"),
    text: sourceText,
    type,
    priority,
    normalizedConcepts: extractConcepts(sourceText),
    sourceText
  };
}

function getBodyLines(): TextLine[] {
  // First try DOM-based extraction to preserve structure
  let lines = extractStructuredJobContent();

  // If DOM extraction produced reasonable results, use it
  if (lines.length > 10) {
    return lines;
  }

  // Fall back to text-based extraction
  const bodyText = getJobContentText();

  lines = bodyText
    .split("\n")
    .map((text, index) => ({
      text: normalizeWhitespace(text),
      index
    }))
    .filter((line) => Boolean(line.text));

  // Improve numbered list detection
  // If we see consecutive lines starting with numbers, treat each as a bullet
  const improvedLines: TextLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text;

    // Check if starts with number (1., 2., 10., etc.)
    const numberMatch = text.match(/^(\d+)\.\s+/);

    if (numberMatch) {
      // Look ahead - if next line also starts with a number, this is a numbered list
      const nextLine = lines[i + 1];

      if (
        nextLine &&
        /^\d+\.\s+/.test(nextLine.text)
      ) {
        // This is part of a numbered list - convert to bullet format
        const stripped = normalizeWhitespace(
          text.replace(/^\d+\.\s+/, "")
        );

        improvedLines.push({
          ...line,
          text: `• ${stripped}`
        });
      } else {
        improvedLines.push(line);
      }
    } else {
      improvedLines.push(line);
    }
  }

  return improvedLines;
}

function findLineIndex(
  lines: TextLine[],
  target: string,
  startAt = 0
): number {
  const normalizedTarget =
    normalizeForComparison(target);

  for (let i = startAt; i < lines.length; i += 1) {
    if (
      normalizeForComparison(lines[i].text) ===
      normalizedTarget
    ) {
      return i;
    }
  }

  return -1;
}

function extractTitle(lines: TextLine[]): string {
  const aboutIndex = findLineIndex(
    lines,
    "About the job"
  );

  const preferredSelectors = [
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    "h1"
  ];

  for (const selector of preferredSelectors) {
    const element =
      document.querySelector<HTMLElement>(selector);

    const text = normalizeWhitespace(
      element?.innerText ?? ""
    );

    if (text && text.length < 200) {
      return text;
    }
  }

  if (aboutIndex >= 0) {
    for (
      let i = 0;
      i < Math.min(aboutIndex, lines.length);
      i += 1
    ) {
      const text = lines[i].text;

      if (
        text.length >= 5 &&
        text.length <= 160 &&
        !isNoiseLine(text) &&
        !text.includes("·") &&
        !/^0 notifications$/i.test(text) &&
        !/^skip to /i.test(text) &&
        !/^for business$/i.test(text)
      ) {
        const next = lines[i + 1]?.text ?? "";

        if (
          next.includes("·") ||
          next === "Hybrid" ||
          next === "Full-time" ||
          next === "Full time"
        ) {
          return text;
        }
      }
    }
  }

  return "";
}

function extractCompany(lines: TextLine[]): string {
  const preferredSelectors = [
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
    ".job-details-jobs-unified-top-card__primary-description a"
  ];

  for (const selector of preferredSelectors) {
    const element =
      document.querySelector<HTMLElement>(selector);

    const text = normalizeWhitespace(
      element?.innerText ?? ""
    );

    if (text && text.length < 150) {
      return text;
    }
  }

  const aboutIndex = findLineIndex(
    lines,
    "About the job"
  );

  if (aboutIndex > 0) {
    const title = extractTitle(lines);

    for (
      let i = 0;
      i < aboutIndex;
      i += 1
    ) {
      const text = lines[i].text;

      if (
        text &&
        text !== title &&
        text.length < 150 &&
        !text.includes("·") &&
        !isNoiseLine(text) &&
        !/^skip to /i.test(text) &&
        !/^0 notifications$/i.test(text)
      ) {
        const next = lines[i + 1]?.text ?? "";

        if (
          next.includes("·") ||
          next === "Hybrid" ||
          next === "Full-time" ||
          next === "Full time"
        ) {
          return text;
        }
      }
    }
  }

  return "";
}

function extractLocation(lines: TextLine[]): string {
  const title = extractTitle(lines);

  const titleIndex = findLineIndex(lines, title);

  if (titleIndex >= 0) {
    for (
      let i = titleIndex + 1;
      i < Math.min(titleIndex + 8, lines.length);
      i += 1
    ) {
      const text = lines[i].text;

      if (
        text.includes("·") &&
        !text.toLowerCase().includes("click")
      ) {
        return normalizeWhitespace(
          text.split("·")[0]
        );
      }
    }
  }

  const selectors = [
    ".job-details-jobs-unified-top-card__bullet",
    ".jobs-unified-top-card__bullet"
  ];

  for (const selector of selectors) {
    const elements =
      document.querySelectorAll<HTMLElement>(
        selector
      );

    for (const element of elements) {
      const text = normalizeWhitespace(
        element.innerText
      );

      if (text && text.length < 150) {
        return text;
      }
    }
  }

  return "";
}

function findDescriptionEnd(
  lines: TextLine[],
  startIndex: number
): number {
  for (
    let i = startIndex;
    i < lines.length;
    i += 1
  ) {
    if (isDescriptionEndMarker(lines[i].text)) {
      return i;
    }
  }

  return lines.length;
}

function extractDescriptionLines(
  lines: TextLine[]
): TextLine[] {
  const aboutIndex = findLineIndex(
    lines,
    "About the job"
  );

  if (aboutIndex < 0) {
    return [];
  }

  const startIndex = aboutIndex + 1;
  const endIndex = findDescriptionEnd(
    lines,
    startIndex
  );

  return lines
    .slice(startIndex, endIndex)
    .filter((line) => !isNoiseLine(line.text));
}

function cleanDescription(
  lines: TextLine[]
): string {
  const cleaned: string[] = [];

  for (const line of lines) {
    const text = line.text;

    if (!text) {
      continue;
    }

    if (
      text === "… more" ||
      text === "... more"
    ) {
      continue;
    }

    cleaned.push(text);
  }

  return cleaned.join("\n");
}

function findSectionRanges(
  lines: TextLine[]
): SectionRange[] {
  const ranges: SectionRange[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i].text;

    // Check if this line is exactly a section heading
    if (isSectionHeading(text)) {
      const end =
        i + 1 < lines.length
          ? lines[i + 1].index
          : lines.length;

      ranges.push({
        start: i,
        end,
        heading: text
      });
      continue;
    }

    // Check if this line contains a section heading followed by content
    // E.g., "Key responsibilitiesBuild and lead a team..."
    for (const heading of [
      ...RESPONSIBILITY_HEADINGS,
      ...BASIC_QUALIFICATIONS_HEADINGS,
      ...PREFERRED_QUALIFICATIONS_HEADINGS
    ]) {
      const headingRegex = new RegExp(
        `^${heading}\\s+`,
        "i"
      );

      if (headingRegex.test(text)) {
        // Found heading at start of line
        const match = text.match(headingRegex);
        if (match) {
          // Extract the heading and content
          const actualHeading = match[0].trim();

          ranges.push({
            start: i,
            end: i + 1 < lines.length ? lines[i + 1].index : lines.length,
            heading: actualHeading
          });
        }
        break;
      }
    }
  }

  return ranges;
}

function extractRequirementsFromSections(
  lines: TextLine[]
): JobRequirement[] {
  const requirements: JobRequirement[] = [];

  const ranges = findSectionRanges(lines);

  for (const range of ranges) {
    const sectionType = detectSectionType(range.heading);
    
    // Only extract requirements from explicitly requirement-bearing sections
    if (sectionType !== "responsibility" && sectionType !== "requirement") {
      continue;
    }

    // Get the line that contains the heading
    const lineWithHeading = lines[range.start].text;

    // Check if heading and content are on the same line
    let contentAfterHeading = "";

    for (const heading of [
      ...RESPONSIBILITY_HEADINGS,
      ...BASIC_QUALIFICATIONS_HEADINGS,
      ...PREFERRED_QUALIFICATIONS_HEADINGS
    ]) {
      const headingRegex = new RegExp(
        `^${heading}\\s+`,
        "i"
      );

      const match = lineWithHeading.match(
        headingRegex
      );

      if (match) {
        contentAfterHeading = normalizeWhitespace(
          lineWithHeading.substring(match[0].length)
        );
        break;
      }
    }

    // If content follows heading on same line and it's substantial, treat it as a requirement
    if (contentAfterHeading && contentAfterHeading.length >= 12) {
      const splitItems = splitRequirementByLogic(
        contentAfterHeading,
        range.heading
      );

      for (const item of splitItems) {
        const requirement = buildRequirement(
          item,
          range.heading
        );

        if (requirement) {
          requirements.push(requirement);
        }
      }
    }

    // Process lines after the heading
    const sectionLines = lines.slice(
      range.start + 1
    );

    // IMPORTANT: Treat non-bullet lines differently after a section heading
    // They might be individual list items rather than paragraphs
    let i = 0;

    while (i < sectionLines.length) {
      const line = sectionLines[i];
      const text = line.text;

      // Stop if we hit another section heading
      if (
        isSectionHeading(text) &&
        normalizeForComparison(text) !==
          normalizeForComparison(range.heading)
      ) {
        break;
      }

      // Explicit bullets - treat as individual items
      if (isLikelyBullet(text)) {
        const splitItems = splitRequirementByLogic(
          text,
          range.heading
        );

        for (const item of splitItems) {
          const requirement = buildRequirement(
            item,
            range.heading
          );

          if (requirement) {
            requirements.push(requirement);
          }
        }

        i++;
        continue;
      }

      // Lines ending with `:` are often labels
      if (
        text.length > 0 &&
        text.length < 220 &&
        /:$/.test(text)
      ) {
        const requirement = buildRequirement(
          text,
          range.heading
        );

        if (requirement) {
          requirements.push(requirement);
        }

        i++;
        continue;
      }

      // HEURISTIC: After a section heading, individual lines between 20-400 chars
      // are likely separate list items, not parts of a paragraph
      // This is the key fix for numbered/un-bulleted lists
      if (
        text.length >= 20 &&
        text.length <= 400 &&
        !text.endsWith(",") &&
        !text.endsWith("and") &&
        !text.endsWith("or")
      ) {
        // Check if this looks like a standalone item
        // by seeing if next line also looks like an item
        const nextLine =
          i + 1 < sectionLines.length
            ? sectionLines[i + 1].text
            : null;

        const nextIsAlsoItem =
          nextLine &&
          nextLine.length >= 20 &&
          nextLine.length <= 400 &&
          !nextLine.endsWith(",") &&
          !nextLine.endsWith("and") &&
          !nextLine.endsWith("or");

        // If we're right after the heading or next line looks like an item too,
        // treat this line as a standalone item
        const isFirstLineAfterHeading = i === 0;

        if (
          isFirstLineAfterHeading ||
          nextIsAlsoItem
        ) {
          const splitItems = splitRequirementByLogic(
            text,
            range.heading
          );

          for (const item of splitItems) {
            const requirement = buildRequirement(
              item,
              range.heading
            );

            if (requirement) {
              requirements.push(requirement);
            }
          }

          i++;
          continue;
        }
      }

      // For anything else, accumulate into potential paragraph
      // and try to build from it
      const splitItems = splitRequirementByLogic(
        text,
        range.heading
      );

      for (const item of splitItems) {
        const requirement = buildRequirement(
          item,
          range.heading
        );

        if (requirement) {
          requirements.push(requirement);
        }
      }

      i++;
    }
  }

  return requirements;
}

function extractFallbackRequirements(
  lines: TextLine[]
): JobRequirement[] {
  const requirements: JobRequirement[] = [];

  let activeHeading = "Requirements";
  let inRequirementArea = false;

  for (const line of lines) {
    const text = line.text;

    // Check section type before processing
    const sectionType = detectSectionType(text);
    
    if (sectionType === "responsibility" || sectionType === "requirement") {
      activeHeading = text;
      inRequirementArea = true;
      continue;
    }

    // Stop processing if we hit a non-requirement section
    if (sectionType === "non-requirement" || sectionType === "context") {
      inRequirementArea = false;
      continue;
    }

    if (
      inRequirementArea &&
      isDescriptionEndMarker(text)
    ) {
      break;
    }

    if (!inRequirementArea) {
      continue;
    }

    if (isLikelyBullet(text)) {
      // For bullet points, try intelligent splitting
      const splitItems = splitRequirementByLogic(
        text,
        activeHeading
      );

      for (const item of splitItems) {
        const requirement = buildRequirement(
          item,
          activeHeading
        );

        if (requirement) {
          requirements.push(requirement);
        }
      }

      continue;
    }

    // For non-bullet lines, be more aggressive about detecting list items
    // Lines between 20-400 chars might be list items
    if (
      text.length >= 20 &&
      text.length <= 400
    ) {
      // Try to detect if this might be multiple list items bunched together
      const splitItems = splitRequirementByLogic(
        text,
        activeHeading
      );

      for (const item of splitItems) {
        const requirement = buildRequirement(
          item,
          activeHeading
        );

        if (requirement) {
          requirements.push(requirement);
        }
      }
    }
  }

  return requirements;
}

function deduplicateRequirements(
  requirements: JobRequirement[]
): JobRequirement[] {
  const seen = new Set<string>();
  const result: JobRequirement[] = [];

  for (const requirement of requirements) {
    const key = normalizeForComparison(
      requirement.sourceText
    );

    if (!key) {
      continue;
    }

    // Check for exact duplicates
    if (seen.has(key)) {
      continue;
    }

    // Check for near-duplicates and partial matches
    // If a similar requirement already exists, skip this one
    let isDuplicate = false;
    
    for (const existingKey of seen) {
      // If one is a substring of the other (with min 70% overlap)
      const minLength = Math.min(key.length, existingKey.length);
      const maxLength = Math.max(key.length, existingKey.length);
      
      // Check if shorter is contained in longer (allowing some variation)
      if (minLength >= 30 && maxLength / minLength < 1.4) {
        // Close in length - check for substring match
        if (
          existingKey.includes(key) ||
          key.includes(existingKey)
        ) {
          isDuplicate = true;
          break;
        }
        
        // Check for significant word overlap (60%+ of words match)
        const keyWords = new Set(key.split(/\s+/));
        const existingWords = new Set(existingKey.split(/\s+/));
        const intersection = [...keyWords].filter(
          w => existingWords.has(w)
        ).length;
        const overlap = intersection / Math.max(keyWords.size, existingWords.size);
        
        if (overlap >= 0.6) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (isDuplicate) {
      continue;
    }

    seen.add(key);
    result.push(requirement);
  }

  return result;
}

function extractRequirements(
  descriptionLines: TextLine[]
): JobRequirement[] {
  const structured =
    extractRequirementsFromSections(
      descriptionLines
    );

  const requirements =
    structured.length > 0
      ? structured
      : extractFallbackRequirements(
          descriptionLines
        );

  return deduplicateRequirements(
    requirements
  );
}

export class LinkedInJobExtractor {
  canExtract(): boolean {
    return (
      window.location.hostname ===
        "www.linkedin.com" &&
      window.location.pathname.startsWith(
        "/jobs/"
      )
    );
  }

  extract(): Job {
    if (!this.canExtract()) {
      throw new Error(
        "Current page is not a supported LinkedIn job page."
      );
    }

    const lines = getBodyLines();

    const title = extractTitle(lines);
    const company = extractCompany(lines);
    const location = extractLocation(lines);

    const descriptionLines =
      extractDescriptionLines(lines);

    const description =
      cleanDescription(descriptionLines);

    let requirements =
      extractRequirements(
        descriptionLines
      );

    /*
     * Some LinkedIn layouts render the "What We Are
     * Looking For" content without preserving bullets.
     * If structured extraction produced nothing, try
     * the complete description again as a fallback.
     */
    if (requirements.length === 0) {
      requirements =
        extractFallbackRequirements(
          descriptionLines
        );
    }

    const result: ExtractionResult = {
      title,
      company: company || undefined,
      location: location || undefined,
      description,
      requirements
    };

    console.log(
      "[RJI] LinkedIn extraction result:",
      {
        url: window.location.href,
        title: result.title,
        company: result.company,
        location: result.location,
        descriptionLength:
          result.description.length,
        requirementCount:
          result.requirements.length,
        requirements:
          result.requirements.map(
            (requirement) => ({
              type: requirement.type,
              priority: requirement.priority,
              text: requirement.text,
              concepts:
                requirement.normalizedConcepts
            })
          )
      }
    );

    if (!result.title) {
      console.warn(
        "[RJI] Job title could not be extracted."
      );
    }

    if (!result.description) {
      console.warn(
        "[RJI] Job description could not be extracted."
      );
    }

    return {
      id: generateId("job"),

      source: {
        type: "linkedin" as JobSourceType,
        url: window.location.href,
        capturedAt:
          new Date().toISOString()
      },

      title:
        result.title || "LinkedIn Job",

      company: result.company,
      location: result.location,

      description: result.description,

      requirements: result.requirements,

      /*
       * rawText intentionally contains only the
       * extracted job description, not the entire
       * LinkedIn page.
       */
      rawText: result.description
    };
  }
}
