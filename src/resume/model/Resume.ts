import type { ResumeSection } from "./ResumeSection";

export interface ResumeContact {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
}

export interface Resume {
  id: string;

  version: number;

  source: {
    filename: string;
    type: "pdf" | "docx";
    importedAt: string;
  };

  contact: ResumeContact;

  sections: ResumeSection[];

  evidenceIds: string[];

  /**
   * Reference to the original document artifact.
   *
   * The parsed Resume model is used for analysis, but generated
   * documents must be derived from the original artifact so that
   * formatting is preserved.
   */
  originalDocument?: {
    type: "docx";
    filename: string;
  };
}
