export type ResumeSectionType =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "other";

export interface ResumeContent {
  id: string;
  text: string;
}

export interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  title: string;
  content: ResumeContent[];
}
