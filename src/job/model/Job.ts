import type { JobRequirement } from "./JobRequirement";

export type JobSourceType =
  | "linkedin"
  | "other";

export interface Job {
  id: string;

  source: {
    type: JobSourceType;
    url: string;
    capturedAt: string;
  };

  title: string;

  company?: string;

  location?: string;

  description: string;

  requirements: JobRequirement[];

  rawText?: string;
}
