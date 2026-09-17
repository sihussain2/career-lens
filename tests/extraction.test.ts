import { describe, it, expect } from "vitest";
import { detectSectionType, isSectionHeading, parseSections } from "../src/job/extraction/section-parser";
import { parseContentBlocks } from "../src/job/extraction/content-block-parser";
import {
  extractNormalizedConcepts,
  extractYearsOfExperience,
  isExperienceStatement,
  isEducationStatement,
  isResponsibilityStatement,
} from "../src/job/extraction/requirement-normalizer";
import {
  classifyRequirementType,
  inferPriority,
  shouldMarkAsPreferred,
  shouldSplitRequirement,
} from "../src/job/extraction/requirement-classifier";
import { deduplicateRequirements, filterTrivialRequirements } from "../src/job/extraction/requirement-deduplicator";

describe("Section Parser", () => {
  it("should detect basic qualifications section", () => {
    const result = detectSectionType("Qualifications");
    expect(result).not.toBeNull();
    expect(result?.type).toBe("basic_qualifications");
    expect(result?.isRequired).toBe(true);
  });

  it("should detect preferred qualifications section", () => {
    const result = detectSectionType("Preferred Qualifications");
    expect(result).not.toBeNull();
    expect(result?.type).toBe("preferred_qualifications");
  });

  it("should detect responsibilities section", () => {
    const result = detectSectionType("What You'll Do");
    expect(result).not.toBeNull();
    expect(result?.type).toBe("responsibilities");
  });

  it("should handle case insensitivity", () => {
    const result = detectSectionType("RESPONSIBILITIES");
    expect(result).not.toBeNull();
    expect(result?.type).toBe("responsibilities");
  });

  it("should handle apostrophe variations", () => {
    const result1 = detectSectionType("What You'll Do");
    const result2 = detectSectionType("What Youll Do");
    expect(result1?.type).toBe("responsibilities");
    expect(result2?.type).toBe("responsibilities");
  });

  it("isSectionHeading should return true for valid headings", () => {
    expect(isSectionHeading("Qualifications")).toBe(true);
    expect(isSectionHeading("What You'll Do")).toBe(true);
    expect(isSectionHeading("Preferred Qualifications")).toBe(true);
  });

  it("isSectionHeading should return false for non-headings", () => {
    expect(isSectionHeading("Some random text")).toBe(false);
    expect(isSectionHeading("We are building a platform")).toBe(false);
  });
});

describe("Content Block Parser", () => {
  it("should parse bullet points", () => {
    const lines = [
      { text: "• Design and implement APIs", index: 0 },
      { text: "• Lead engineering team", index: 1 },
      { text: "• Architect distributed systems", index: 2 },
    ];

    const blocks = parseContentBlocks(lines);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("bullet");
    expect(blocks[0].text).toBe("Design and implement APIs");
    expect(blocks[0].bulletMarker).toBe("•");
  });

  it("should handle multiline wrapped bullets", () => {
    const lines = [
      { text: "• Manage cross-functional teams of engineers,", index: 0 },
      { text: "designers, and product managers", index: 1 },
      { text: "• Build scalable systems", index: 2 },
    ];

    const blocks = parseContentBlocks(lines);
    expect(blocks[0].type).toBe("bullet");
    expect(blocks[0].isContinuation).toBe(false);
    expect(blocks[0].text).toContain("engineers");
    expect(blocks[0].text).toContain("designers");
  });

  it("should parse paragraphs", () => {
    const lines = [
      { text: "This is a paragraph about the role.", index: 0 },
      { text: "It describes what you'll be doing.", index: 1 },
    ];

    const blocks = parseContentBlocks(lines);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
  });

  it("should handle numbered lists", () => {
    const lines = [
      { text: "1. Design scalable systems", index: 0 },
      { text: "2. Lead engineering teams", index: 1 },
    ];

    const blocks = parseContentBlocks(lines, { treatNumberedAsBullets: true });
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("bullet");
  });
});

describe("Requirement Normalizer", () => {
  it("should extract concepts from text", () => {
    const text = "5+ years of experience with Python, JavaScript, and React";
    const concepts = extractNormalizedConcepts(text);
    expect(concepts).toContain("python");
    expect(concepts).toContain("javascript");
    expect(concepts).toContain("react");
  });

  it("should extract years of experience", () => {
    expect(extractYearsOfExperience("3+ years of experience")).toBe(3);
    expect(extractYearsOfExperience("at least 5 years")).toBe(5);
    expect(extractYearsOfExperience("minimum 7 years of experience")).toBe(7);
    expect(extractYearsOfExperience("no specific experience")).toBeUndefined();
  });

  it("should detect experience statements", () => {
    expect(isExperienceStatement("7+ years of experience with cloud systems")).toBe(true);
    expect(isExperienceStatement("Experience with AWS and Kubernetes")).toBe(true);
    expect(isExperienceStatement("You should have design skills")).toBe(false);
  });

  it("should detect education statements", () => {
    expect(isEducationStatement("Bachelor's degree in Computer Science")).toBe(true);
    expect(isEducationStatement("Master's degree or equivalent experience")).toBe(true);
    expect(isEducationStatement("Skills in Python")).toBe(false);
  });

  it("should detect responsibility statements", () => {
    expect(isResponsibilityStatement("Lead cross-functional engineering teams")).toBe(true);
    expect(isResponsibilityStatement("Manage technical strategy")).toBe(true);
    expect(isResponsibilityStatement("You must have 5 years experience")).toBe(false);
  });
});

describe("Requirement Classifier", () => {
  it("should classify responsibility statements", () => {
    const type = classifyRequirementType(
      "Lead and mentor engineering teams",
      "responsibilities"
    );
    expect(type).toBe("responsibility");
  });

  it("should classify education statements", () => {
    const type = classifyRequirementType(
      "Bachelor's degree in Computer Science",
      "basic_qualifications"
    );
    expect(type).toBe("education");
  });

  it("should classify experience statements", () => {
    const type = classifyRequirementType(
      "5+ years of experience with Python",
      "basic_qualifications"
    );
    expect(type).toBe("experience");
  });

  it("should infer high priority for basic qualifications", () => {
    const priority = inferPriority("Must have: 3+ years of experience", "basic_qualifications");
    expect(priority).toBe("high");
  });

  it("should infer low priority for preferred qualifications", () => {
    const priority = inferPriority("Nice to have: experience with Go", "preferred_qualifications");
    expect(priority).toBe("low");
  });

  it("should mark as preferred in preferred section", () => {
    expect(shouldMarkAsPreferred("Text", "preferred_qualifications")).toBe(true);
    expect(shouldMarkAsPreferred("Text", "nice_to_have")).toBe(true);
    expect(shouldMarkAsPreferred("Text", "basic_qualifications")).toBe(false);
  });

  it("should detect compound requirements to split", () => {
    expect(shouldSplitRequirement("Build teams. Create architectures. Design systems.")).toBe(true);
    expect(shouldSplitRequirement("Experience with Python, Go, and JavaScript")).toBe(false);
  });
});

describe("Requirement Deduplicator", () => {
  it("should remove exact duplicates", () => {
    const requirements = [
      {
        id: "1",
        text: "3+ years of Python experience",
        type: "experience" as const,
        priority: "high" as const,
        normalizedConcepts: [],
        sourceText: "3+ years of Python experience",
      },
      {
        id: "2",
        text: "3+ years of Python experience",
        type: "experience" as const,
        priority: "high" as const,
        normalizedConcepts: [],
        sourceText: "3+ years of Python experience",
      },
    ];

    const result = deduplicateRequirements(requirements);
    expect(result).toHaveLength(1);
  });

  it("should remove substring duplicates", () => {
    const requirements = [
      {
        id: "1",
        text: "3+ years of Python and JavaScript experience",
        type: "experience" as const,
        priority: "high" as const,
        normalizedConcepts: [],
        sourceText: "3+ years of Python and JavaScript experience",
      },
      {
        id: "2",
        text: "3+ years of Python experience",
        type: "experience" as const,
        priority: "high" as const,
        normalizedConcepts: [],
        sourceText: "3+ years of Python experience",
      },
    ];

    const result = deduplicateRequirements(requirements);
    expect(result).toHaveLength(1);
  });

  it("should filter trivial requirements", () => {
    const requirements = [
      {
        id: "1",
        text: "Be a team player",
        type: "qualification" as const,
        priority: "medium" as const,
        normalizedConcepts: [],
        sourceText: "Be a team player",
      },
      {
        id: "2",
        text: "Communicate effectively",
        type: "qualification" as const,
        priority: "medium" as const,
        normalizedConcepts: [],
        sourceText: "Communicate effectively",
      },
      {
        id: "3",
        text: "3+ years of Python experience",
        type: "experience" as const,
        priority: "high" as const,
        normalizedConcepts: [],
        sourceText: "3+ years of Python experience",
      },
    ];

    const result = filterTrivialRequirements(requirements);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("3+ years of Python experience");
  });
});
