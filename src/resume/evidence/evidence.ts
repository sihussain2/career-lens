export interface Evidence {
  id: string;

  resumeId: string;

  sectionId: string;

  sourceText: string;

  normalizedConcepts: string[];

  skills: string[];

  technologies: string[];

  roles?: string[];

  organizations?: string[];

  dates?: {
    start?: string;
    end?: string;
  };
}
