import type {
  Resume,
  ResumeContact
} from "../model/Resume";

import type {
  ResumeSection,
  ResumeSectionType
} from "../model/ResumeSection";

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalize(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sectionType(
  title: string
): ResumeSectionType {
  const value = title.toLowerCase();

  if (
    value.includes("summary") ||
    value.includes("profile") ||
    value.includes("objective")
  ) {
    return "summary";
  }

  if (
    value.includes("experience") ||
    value.includes("employment") ||
    value.includes("work history")
  ) {
    return "experience";
  }

  if (value.includes("education")) {
    return "education";
  }

  if (
    value.includes("skill") ||
    value.includes("technical")
  ) {
    return "skills";
  }

  if (
    value.includes("project") ||
    value.includes("portfolio")
  ) {
    return "projects";
  }

  if (
    value.includes("certification") ||
    value.includes("certificate")
  ) {
    return "certifications";
  }

  return "other";
}

function looksLikeHeading(line: string): boolean {
  const normalized = line.trim();

  if (!normalized) {
    return false;
  }

  if (normalized.length > 60) {
    return false;
  }

  const lower = normalized.toLowerCase();

  const headings = [
    "summary",
    "professional summary",
    "profile",
    "objective",
    "experience",
    "professional experience",
    "work experience",
    "employment",
    "education",
    "skills",
    "technical skills",
    "projects",
    "certifications",
    "certificates"
  ];

  return headings.includes(lower);
}

function parseSections(
  text: string
): ResumeSection[] {
  const lines = normalize(text)
    .split("\n")
    .map((line) => line.trim());

  const sections: ResumeSection[] = [];

  let current:
    | ResumeSection
    | null = null;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (looksLikeHeading(line)) {
      current = {
        id: id("SEC"),
        type: sectionType(line),
        title: line,
        content: []
      };

      sections.push(current);
      continue;
    }

    if (!current) {
      current = {
        id: id("SEC"),
        type: "other",
        title: "Other",
        content: []
      };

      sections.push(current);
    }

    current.content.push({
      id: id("CNT"),
      text: line
    });
  }

  return sections;
}

function extractContact(
  text: string
): ResumeContact {
  const email =
    text.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    )?.[0];

  const linkedin =
    text.match(
      /https?:\/\/(?:www\.)?linkedin\.com\/[^\s]+/i
    )?.[0];

  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return {
    ...(firstLine ? { name: firstLine } : {}),
    ...(email ? { email } : {}),
    ...(linkedin ? { linkedin } : {})
  };
}

export function parseResume(
  text: string,
  filename: string,
  type: "pdf" | "docx"
): Resume {
  const normalized = normalize(text);

  return {
    id: id("RES"),
    version: 1,

    source: {
      filename,
      type,
      importedAt: new Date().toISOString()
    },

    contact: extractContact(normalized),

    sections: parseSections(normalized),

    evidenceIds: []
  };
}
