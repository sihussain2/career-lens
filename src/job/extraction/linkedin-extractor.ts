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
}

interface SectionRange {
  start: number;
  end: number;
  heading: string;
}

interface ExtractionResult {
  title: string;
  company?: string;
  location?: string;
  description: string;
  requirements: JobRequirement[];
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

const REQUIREMENT_HEADINGS = [
  "what we are looking for",
  "what we're looking for",
  "requirements",
  "qualifications",
  "preferred qualifications",
  "basic qualifications",
  "key qualifications",
  "what you'll bring",
  "what you bring",
  "skills and qualifications"
];

const NICE_TO_HAVE_HEADINGS = [
  "nice to have",
  "nice-to-have",
  "preferred",
  "bonus",
  "bonus points"
];

const RESPONSIBILITY_HEADINGS = [
  "responsibilities",
  "what you'll do",
  "what you will do",
  "your responsibilities",
  "key responsibilities",
  "role responsibilities",
  "in this role",
  "what you'll be doing"
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
  "... more"
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

  if (
    REQUIREMENT_HEADINGS.includes(normalized) ||
    NICE_TO_HAVE_HEADINGS.includes(normalized) ||
    RESPONSIBILITY_HEADINGS.includes(normalized)
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
  const normalized = normalizeForComparison(text);

  return (
    REQUIREMENT_HEADINGS.includes(normalized) ||
    NICE_TO_HAVE_HEADINGS.includes(normalized) ||
    RESPONSIBILITY_HEADINGS.includes(normalized)
  );
}

function inferRequirementType(
  text: string,
  sectionHeading: string
): RequirementType {
  const normalized = normalizeForComparison(
    `${sectionHeading} ${text}`
  );

  if (
    normalized.includes("degree") ||
    normalized.includes("education") ||
    normalized.includes("bachelor") ||
    normalized.includes("master") ||
    normalized.includes("phd") ||
    normalized.includes("university")
  ) {
    return "education";
  }

  if (
    normalized.includes("years of experience") ||
    normalized.includes("experience with") ||
    normalized.includes("experience in") ||
    normalized.includes("track record") ||
    normalized.includes("background in") ||
    normalized.includes("proven experience")
  ) {
    return "experience";
  }

  if (
    RESPONSIBILITY_HEADINGS.some(
      (heading) =>
        normalizeForComparison(sectionHeading) ===
        normalizeForComparison(heading)
    )
  ) {
    return "responsibility";
  }

  if (
    normalized.includes("certification") ||
    normalized.includes("certified") ||
    normalized.includes("license")
  ) {
    return "qualification";
  }

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
    "event-driven"
  ];

  if (
    technicalTerms.some((term) =>
      normalized.includes(term)
    )
  ) {
    return "required_skill";
  }

  if (
    NICE_TO_HAVE_HEADINGS.some(
      (heading) =>
        normalizeForComparison(sectionHeading) ===
        normalizeForComparison(heading)
    )
  ) {
    return "preferred_skill";
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

  if (
    NICE_TO_HAVE_HEADINGS.includes(normalizedHeading) ||
    normalizedText.includes("nice to have") ||
    normalizedText.includes("preferred")
  ) {
    return "low";
  }

  if (
    normalizedText.includes("must ") ||
    normalizedText.includes("required") ||
    normalizedText.includes("minimum") ||
    normalizedText.includes("essential") ||
    normalizedHeading === "requirements" ||
    normalizedHeading === "qualifications" ||
    normalizedHeading === "what we are looking for"
  ) {
    return "high";
  }

  return "medium";
}

function extractConcepts(text: string): string[] {
  const normalized = normalizeForComparison(text);
  const concepts = new Set<string>();

  const conceptPatterns: Array<[string, RegExp]> = [
    ["python", /\bpython(?:3)?\b/i],
    ["java", /\bjava\b/i],
    ["javascript", /\bjavascript\b/i],
    ["typescript", /\btypescript\b/i],
    ["c++", /\bc\+\+\b/i],
    [".net", /\.net\b/i],
    ["redis", /\bredis\b/i],
    ["kubernetes", /\bkubernetes\b/i],
    ["docker", /\bdocker\b/i],
    ["aws", /\baws\b/i],
    ["azure", /\bazure\b/i],
    ["gcp", /\bgcp\b/i],
    ["linux", /\blinux\b/i],
    ["api", /\bapis?\b/i],
    ["distributed systems", /\bdistributed systems?\b/i],
    ["high availability", /\bhigh availability\b/i],
    ["backend", /\bbackend\b/i],
    ["system design", /\bsystem design\b/i],
    ["data modeling", /\bdata modell?ing\b/i],
    ["event driven architecture", /\bevent[- ]driven architecture\b/i],
    ["caching", /\bcaching\b/i],
    ["high throughput", /\bhigh throughput\b/i],
    ["scalability", /\bscalability\b/i],
    ["resiliency", /\bresilien(?:ce|cy)\b/i],
    ["cloud infrastructure", /\bcloud infrastructure\b/i],
    ["machine learning", /\bmachine learning\b/i],
    ["artificial intelligence", /\bartificial intelligence\b/i],
    ["llm", /\bllms?\b/i],
    ["people leadership", /\bpeople leadership\b/i],
    ["technical leadership", /\btechnical leadership\b/i],
    ["software architecture", /\bsoftware architecture\b/i],
    ["system architecture", /\bsystem architecture\b/i],
    ["team leadership", /\bteam leadership\b/i],
    ["product collaboration", /\bproduct\b/i],
    ["design collaboration", /\bdesign\b/i]
  ];

  for (const [concept, pattern] of conceptPatterns) {
    if (pattern.test(normalized)) {
      concepts.add(concept);
    }
  }

  return [...concepts];
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
  const bodyText = document.body?.innerText ?? "";

  return bodyText
    .split("\n")
    .map((text, index) => ({
      text: normalizeWhitespace(text),
      index
    }))
    .filter((line) => Boolean(line.text));
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
    if (!isSectionHeading(lines[i].text)) {
      continue;
    }

    const end =
      i + 1 < lines.length
        ? lines[i + 1].index
        : lines.length;

    ranges.push({
      start: i,
      end,
      heading: lines[i].text
    });
  }

  return ranges;
}

function extractRequirementsFromSections(
  lines: TextLine[]
): JobRequirement[] {
  const requirements: JobRequirement[] = [];

  const ranges = findSectionRanges(lines);

  for (const range of ranges) {
    if (!isRequirementHeading(range.heading)) {
      continue;
    }

    const sectionLines = lines.slice(
      range.start + 1
    );

    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length === 0) {
        return;
      }

      const text = normalizeWhitespace(
        currentParagraph.join(" ")
      );

      const sentences = splitSentences(text);

      if (sentences.length > 1) {
        for (const sentence of sentences) {
          const requirement = buildRequirement(
            sentence,
            range.heading
          );

          if (requirement) {
            requirements.push(requirement);
          }
        }
      } else {
        const requirement = buildRequirement(
          text,
          range.heading
        );

        if (requirement) {
          requirements.push(requirement);
        }
      }

      currentParagraph = [];
    };

    for (const line of sectionLines) {
      const text = line.text;

      if (
        isSectionHeading(text) &&
        normalizeForComparison(text) !==
          normalizeForComparison(range.heading)
      ) {
        break;
      }

      if (isLikelyBullet(text)) {
        flushParagraph();

        const requirement = buildRequirement(
          text,
          range.heading
        );

        if (requirement) {
          requirements.push(requirement);
        }

        continue;
      }

      if (
        text.length > 0 &&
        text.length < 220 &&
        /:$/.test(text)
      ) {
        flushParagraph();

        const requirement = buildRequirement(
          text,
          range.heading
        );

        if (requirement) {
          requirements.push(requirement);
        }

        continue;
      }

      currentParagraph.push(text);
    }

    flushParagraph();
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

    if (isRequirementHeading(text)) {
      activeHeading = text;
      inRequirementArea = true;
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
      const requirement = buildRequirement(
        text,
        activeHeading
      );

      if (requirement) {
        requirements.push(requirement);
      }

      continue;
    }

    if (
      text.length >= 30 &&
      text.length <= 400
    ) {
      const requirement = buildRequirement(
        text,
        activeHeading
      );

      if (requirement) {
        requirements.push(requirement);
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

    if (!key || seen.has(key)) {
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
