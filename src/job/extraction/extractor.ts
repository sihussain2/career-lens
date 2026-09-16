import type { Job } from "../model/Job";

export interface JobExtractor {
  canExtract(): boolean;
  extract(): Job;
}
