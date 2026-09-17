/**
 * Normalize requirement text and extract normalized concepts.
 *
 * Handles:
 * - Concept normalization (variations like "software engineering" <-> "software development")
 * - Technology detection
 * - Years of experience extraction
 * - Text normalization for consistent representation
 */

/**
 * Concept normalization mappings.
 * Maps variations to a canonical form.
 */
const CONCEPT_MAPPINGS: Record<string, string> = {
  // Engineering disciplines
  "software engineering": "software engineering",
  "software development": "software engineering",
  "software engineering practices": "software engineering",

  "backend engineering": "backend development",
  "backend development": "backend development",

  "frontend engineering": "frontend development",
  "frontend development": "frontend development",

  "full stack": "full stack development",
  "full-stack": "full stack development",

  // Architecture
  "system architecture": "system architecture",
  "software architecture": "software architecture",
  "systems architecture": "system architecture",
  "distributed systems": "distributed systems",
  "microservices": "microservices",
  "microservices architecture": "microservices",

  // Leadership
  "engineering leadership": "engineering leadership",
  "technical leadership": "technical leadership",
  "people management": "people management",
  "team leadership": "team leadership",
  "team management": "team management",
  "people leadership": "people leadership",
  "staff management": "staff management",

  // Management
  "product management": "product management",
  "program management": "program management",
  "project management": "project management",

  // Operations
  "devops": "devops",
  "dev ops": "devops",
  "site reliability engineering": "site reliability engineering",
  "sre": "site reliability engineering",

  // Testing
  "automated testing": "automated testing",
  "qa": "quality assurance",
  "quality assurance": "quality assurance",

  // CI/CD
  "ci/cd": "ci/cd",
  "continuous integration": "ci/cd",
  "continuous delivery": "ci/cd",
  "continuous deployment": "ci/cd",

  // Code practices
  "code review": "code review",
  "source control": "source control",
  "version control": "version control",
  "git": "git",

  // Concepts
  "live-site operations": "live-site operations",
  "incident management": "incident management",
  "performance optimization": "performance optimization",
  "scalability": "scalability",
  "reliability": "reliability",

  // Data
  "database": "database",
  "databases": "database",
  "sql": "sql",
  "nosql": "nosql",
  "data structures": "data structures",
};

const TECHNOLOGY_KEYWORDS = [
  // Languages
  "python",
  "javascript",
  "typescript",
  "java",
  "golang",
  "go",
  "rust",
  "c++",
  "c#",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "scala",
  "clojure",

  // Frameworks/Libraries
  "react",
  "vue",
  "angular",
  "django",
  "flask",
  "fastapi",
  "spring",
  "rails",
  "express",
  "nextjs",
  "next.js",
  "svelte",
  "ember",

  // Databases
  "postgres",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "cassandra",
  "dynamodb",
  "elasticsearch",
  "sql server",
  "oracle",

  // Cloud/Infrastructure
  "aws",
  "amazon web services",
  "gcp",
  "google cloud",
  "azure",
  "kubernetes",
  "docker",
  "terraform",
  "cloudformation",

  // DevOps/Tools
  "jenkins",
  "gitlab ci",
  "github actions",
  "circleci",
  "ansible",
  "puppet",
  "chef",
  "prometheus",
  "grafana",

  // APIs/Protocols
  "rest",
  "graphql",
  "grpc",
  "websockets",
  "mqtt",

  // Message Queues
  "kafka",
  "rabbitmq",
  "activemq",
  "sqs",

  // Monitoring
  "datadog",
  "new relic",
  "splunk",
  "stackdriver",
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[•●▪◦‣⁃\-*]\s+/g, "")
    .replace(/\s+/g, " ");
}

export function extractNormalizedConcepts(
  text: string
): string[] {
  const normalized = normalizeText(text);
  const concepts = new Set<string>();

  // Check for explicit concept mappings
  for (const [variant, canonical] of Object.entries(
    CONCEPT_MAPPINGS
  )) {
    if (normalized.includes(variant)) {
      concepts.add(canonical);
    }
  }

  // Check for technology keywords
  for (const tech of TECHNOLOGY_KEYWORDS) {
    const pattern = new RegExp(`\\b${tech}\\b`, "i");

    if (pattern.test(normalized)) {
      concepts.add(tech.toLowerCase());
    }
  }

  return Array.from(concepts).sort();
}

/**
 * Extract years of experience if explicitly stated.
 *
 * Recognizes patterns like:
 * - "3+ years"
 * - "at least 5 years"
 * - "minimum 7 years of experience"
 * - "X years managing..."
 */
export function extractYearsOfExperience(
  text: string
): number | undefined {
  // Pattern: "N+ years" or "at least N years" or "minimum N years"
  const patterns = [
    /(\d+)\s*\+?\s*years/i,
    /at\s+least\s+(\d+)\s+years/i,
    /minimum\s+(\d+)\s+years/i,
    /(\d+)\s+or\s+more\s+years/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      const years = parseInt(match[1], 10);

      if (!isNaN(years) && years > 0 && years < 100) {
        return years;
      }
    }
  }

  return undefined;
}

/**
 * Detect if a text block is likely an experience statement.
 */
export function isExperienceStatement(text: string): boolean {
  const normalized = normalizeText(text);

  return (
    /years?\s+(of\s+)?experience/.test(normalized) ||
    /\d+\+?\s+years/.test(normalized) ||
    /experience\s+with/.test(normalized) ||
    /familiarity\s+with/.test(normalized)
  );
}

/**
 * Detect if a text block is likely an education/qualification statement.
 */
export function isEducationStatement(text: string): boolean {
  const normalized = normalizeText(text);

  return (
    /bachelor|master|phd|degree|diploma|certification/.test(
      normalized
    ) ||
    /computer science|engineering|mathematics/.test(
      normalized
    ) ||
    /equivalent experience|equivalent qualification/.test(
      normalized
    )
  );
}

/**
 * Detect if a text block is likely a responsibility statement.
 */
export function isResponsibilityStatement(text: string): boolean {
  const normalized = normalizeText(text);

  const responsibilityVerbs = [
    "lead",
    "manage",
    "own",
    "build",
    "develop",
    "design",
    "create",
    "drive",
    "execute",
    "implement",
    "deliver",
    "oversee",
    "direct",
    "guide",
    "mentor",
    "architect",
    "partner",
    "collaborate",
    "improve",
    "optimize",
    "ensure",
    "maintain",
    "support",
    "coordinate",
  ];

  for (const verb of responsibilityVerbs) {
    if (new RegExp(`\\b${verb}\\b`, "i").test(normalized)) {
      return true;
    }
  }

  return false;
}
