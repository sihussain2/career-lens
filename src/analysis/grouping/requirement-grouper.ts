import type { JobRequirement } from "../../job/model/JobRequirement";
import type { RequirementGroup } from "./requirement-group";

const GROUP_RULES: Array<{
  title: string;
  terms: string[];
}> = [
  {
    title: "People Leadership",
    terms: [
      "team","teams","coach","coaching","mentor","mentoring",
      "hire","hiring","manager","management","people","career",
      "performance","feedback"
    ]
  },
  {
    title: "Technical Leadership",
    terms: [
      "architecture","architect","technical direction",
      "technical strategy","design","distributed systems",
      "scalability","reliability","platform"
    ]
  },
  {
    title: "Execution & Collaboration",
    terms: [
      "product","design","stakeholder","cross-functional",
      "collaboration","roadmap","delivery","planning",
      "communication","execution"
    ]
  },
  {
    title: "Technology",
    terms: [
      "python","java","javascript","typescript","c++","c#",
      "kubernetes","docker","aws","azure","gcp","cloud",
      "linux","git","jenkins","ci/cd","machine learning",
      "artificial intelligence","llm","rag","mcp"
    ]
  },
  {
    title: "Domain Experience",
    terms: [
      "marketplace","marketplaces","search","booking",
      "transaction","transactions","payments","commerce",
      "fintech","rail","railway","embedded","safety-critical"
    ]
  }
];

export function groupRequirements(
  requirements: JobRequirement[]
): RequirementGroup[] {
  const groups = new Map<string, JobRequirement[]>();

  for (const requirement of requirements) {
    const text = requirement.text.toLowerCase();

    let group = "Other";

    for (const rule of GROUP_RULES) {
      if (
        rule.terms.some(term => text.includes(term))
      ) {
        group = rule.title;
        break;
      }
    }

    if (!groups.has(group)) {
      groups.set(group, []);
    }

    groups.get(group)!.push(requirement);
  }

  return [...groups.entries()].map(
    ([title, groupedRequirements], index) => ({
      id: `GROUP-${index + 1}`,
      title,
      requirementIds: groupedRequirements.map(
        requirement => requirement.id
      )
    })
  );
}

export type { RequirementGroup } from "./requirement-group";
