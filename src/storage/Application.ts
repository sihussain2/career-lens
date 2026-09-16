export type ApplicationStatus =
  | "ANALYZING"
  | "REVIEW"
  | "READY"
  | "GENERATED";

export interface Application {
  id: string;

  jobId: string;

  resumeId: string;

  createdAt: string;

  suggestionIds: string[];

  generatedResumeIds: string[];

  status: ApplicationStatus;
}
