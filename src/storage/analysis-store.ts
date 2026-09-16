import type { JobResumeAnalysis } from "../analysis/job-resume-analyzer";
import type { Suggestion } from "../suggestions/Suggestion";

export interface StoredAnalysis {
  id: string;
  jobId: string;
  resumeId: string;
  analysis: JobResumeAnalysis;
  suggestions: Suggestion[];
  createdAt: string;
}

const KEY = "resumeJobAnalyses";

export async function saveAnalysis(
  analysis: JobResumeAnalysis,
  suggestions: Suggestion[]
): Promise<void> {
  const existing =
    await chrome.storage.local.get(KEY);

  const analyses =
    (existing[KEY] as StoredAnalysis[] | undefined) ??
    [];

  const record: StoredAnalysis = {
    id: `ANALYSIS-${crypto.randomUUID()}`,
    jobId: analysis.jobId,
    resumeId: analysis.resumeId,
    analysis,
    suggestions,
    createdAt: new Date().toISOString()
  };

  await chrome.storage.local.set({
    [KEY]: [record, ...analyses]
  });
}

export async function getAnalyses(): Promise<
  StoredAnalysis[]
> {
  const result =
    await chrome.storage.local.get(KEY);

  return (
    (result[KEY] as StoredAnalysis[] | undefined) ??
    []
  );
}
