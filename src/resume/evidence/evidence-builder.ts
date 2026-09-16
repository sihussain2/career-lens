import type { Resume } from "../model/Resume";
import type { Evidence } from "./evidence";

function id(): string {
  return `EVD-${crypto.randomUUID()}`;
}

function concepts(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9+#.\- ]/g, " ")
        .split(/\s+/)
        .filter(
          (word) => word.length >= 3
        )
    )
  ];
}

function extractSkills(
  text: string
): string[] {
  const knownSkills = [
    "python",
    "java",
    "c++",
    "c",
    "javascript",
    "typescript",
    "react",
    "linux",
    "docker",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "git",
    "github",
    "jenkins",
    "ci/cd",
    "machine learning",
    "artificial intelligence",
    "ai",
    "llm",
    "rag",
    "mcp",
    "agentic ai",
    "distributed systems",
    "embedded systems",
    "software architecture"
  ];

  const lower = text.toLowerCase();

  return knownSkills.filter(
    (skill) => lower.includes(skill)
  );
}

export function buildEvidence(
  resume: Resume
): Evidence[] {
  const evidence: Evidence[] = [];

  for (const section of resume.sections) {
    for (const content of section.content) {
      const text = content.text.trim();

      if (!text) {
        continue;
      }

      evidence.push({
        id: id(),
        resumeId: resume.id,
        sectionId: section.id,
        sourceText: text,
        normalizedConcepts: concepts(text),
        skills: extractSkills(text),
        technologies: extractSkills(text)
      });
    }
  }

  return evidence;
}
