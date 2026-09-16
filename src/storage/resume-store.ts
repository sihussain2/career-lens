import type { Resume } from "../resume/model/Resume";
import type { Evidence } from "../resume/evidence/evidence";

const RESUME_KEY = "masterResume";
const EVIDENCE_KEY = "masterResumeEvidence";

export async function saveMasterResume(
  resume: Resume,
  evidence: Evidence[]
): Promise<void> {
  await chrome.storage.local.set({
    [RESUME_KEY]: resume,
    [EVIDENCE_KEY]: evidence
  });
}

export async function getMasterResume(): Promise<{
  resume: Resume | null;
  evidence: Evidence[];
}> {
  const result = await chrome.storage.local.get([
    RESUME_KEY,
    EVIDENCE_KEY
  ]);

  return {
    resume:
      (result[RESUME_KEY] as Resume | undefined) ?? null,
    evidence:
      (result[EVIDENCE_KEY] as Evidence[] | undefined) ?? []
  };
}
