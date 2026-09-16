import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import type { Job } from "../job/model/Job";
import type { Resume } from "../resume/model/Resume";
import type { Evidence } from "../resume/evidence/evidence";

import { PdfResumeImporter } from "../resume/import/pdf-importer";
import { DocxResumeImporter } from "../resume/import/docx-importer";
import { parseResume } from "../resume/parsing/resume-parser";
import { buildEvidence } from "../resume/evidence/evidence-builder";

import {
  getMasterResume,
  saveMasterResume
} from "../storage/resume-store";

import {
  analyzeJobEnhanced,
  type EnhancedJobResumeAnalysis
} from "../analysis/enhanced-analysis";

type ExtractJobResponse =
  | { success: true; job: Job }
  | { success: false; error: string };

const pdfImporter = new PdfResumeImporter();
const docxImporter = new DocxResumeImporter();

function SidePanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loadingJob, setLoadingJob] = useState(true);
  const [importingResume, setImportingResume] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] =
    useState<EnhancedJobResumeAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
  }, []);

  async function initialize() {
    setLoadingJob(true);
    setError(null);

    try {
      await loadMasterResume();
      await extractCurrentJob();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to initialize the extension."
      );
    } finally {
      setLoadingJob(false);
    }
  }

  async function loadMasterResume() {
    const stored = await getMasterResume();
    setResume(stored.resume);
    setEvidence(stored.evidence);
  }

  async function extractCurrentJob() {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    const tab = tabs[0];

    if (!tab?.id) {
      throw new Error("No active browser tab was found.");
    }

    const response = await sendExtractJobMessage(tab.id);

    if (!response.success) {
      throw new Error(response.error);
    }

    setJob(response.job);
    setAnalysis(null);
  }

  async function sendExtractJobMessage(
    tabId: number
  ): Promise<ExtractJobResponse> {
    try {
      return await chrome.tabs.sendMessage(tabId, {
        type: "EXTRACT_JOB"
      });
    } catch {
      const injectionResult = await chrome.runtime.sendMessage({
        type: "INJECT_CONTENT_SCRIPT",
        tabId
      });

      if (!injectionResult?.success) {
        return {
          success: false,
          error:
            injectionResult?.error ??
            "Unable to initialize the job page."
        };
      }

      return await chrome.tabs.sendMessage(tabId, {
        type: "EXTRACT_JOB"
      });
    }
  }

  function openResumePicker() {
    setError(null);
    setMessage(null);
    fileInputRef.current?.click();
  }

  async function handleResumeFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setImportingResume(true);
    setError(null);
    setMessage(null);
    setAnalysis(null);

    try {
      let importer;

      if (pdfImporter.canImport(file)) {
        importer = pdfImporter;
      } else if (docxImporter.canImport(file)) {
        importer = docxImporter;
      } else {
        throw new Error(
          "Unsupported resume format. Please select a PDF or DOCX file."
        );
      }

      const imported = await importer.import(file);

      if (!imported.text.trim()) {
        throw new Error(
          "The resume could not be read. The document may contain scanned images instead of selectable text."
        );
      }

      const parsed = parseResume(
        imported.text,
        imported.filename,
        imported.type
      );

      const builtEvidence = buildEvidence(parsed);

      parsed.evidenceIds =
        builtEvidence.map(item => item.id);

      await saveMasterResume(
        parsed,
        builtEvidence
      );

      setResume(parsed);
      setEvidence(builtEvidence);

      setMessage(
        `Resume imported successfully: ${imported.filename}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to import the resume."
      );
    } finally {
      setImportingResume(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleAnalyze() {
    if (!job || !resume) return;

    setAnalyzing(true);
    setError(null);
    setMessage(null);

    try {
      const result = analyzeJobEnhanced(
        job,
        resume,
        evidence
      );

      setAnalysis(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to analyze the resume against the job."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  const hasJob = Boolean(job);
  const hasResume = Boolean(resume);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.productName}>
          Resume & Job Intelligence
        </div>
        <div style={styles.subtitle}>
          Evidence-grounded resume analysis
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.message}>{message}</div>}

      <section style={styles.section}>
        <SectionHeader
          title="Current Job"
          status={hasJob ? "Captured" : "Not available"}
        />

        {loadingJob ? (
          <div style={styles.muted}>
            Reading current job page...
          </div>
        ) : job ? (
          <>
            <div style={styles.jobTitle}>
              {job.title || "Untitled role"}
            </div>

            {job.company && (
              <div style={styles.secondary}>
                {job.company}
              </div>
            )}

            {job.location && (
              <div style={styles.secondary}>
                {job.location}
              </div>
            )}

            <div style={styles.statRow}>
              <Stat
                value={job.requirements.length}
                label="Requirements"
              />
          </div>
          </>
        ) : (
          <div style={styles.muted}>
            Open a supported LinkedIn job page.
          </div>
        )}
      </section>

      <section style={styles.section}>
        <SectionHeader
          title="Master Resume"
          status={hasResume ? "Available" : "Not imported"}
        />

        {resume ? (
          <>
            <div style={styles.resumeFilename}>
              {resume.source.filename}
            </div>

            <div style={styles.secondary}>
              {resume.sections.length} sections
            </div>

            <div style={styles.secondary}>
              {evidence.length} evidence items
            </div>

            <button
              style={styles.secondaryButton}
              onClick={openResumePicker}
              disabled={importingResume}
            >
              Replace Resume
            </button>
          </>
        ) : (
          <>
            <div style={styles.muted}>
              Import your master resume to begin analysis.
            </div>

            <button
              style={styles.primaryButton}
              onClick={openResumePicker}
              disabled={importingResume}
            >
              {importingResume
                ? "Importing..."
                : "Import Resume"}
            </button>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleResumeFile}
          style={{ display: "none" }}
        />
      </section>

      <section style={styles.analysisSection}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>
            Job Analysis
          </h2>

          {analysis && (
            <span style={styles.statusReady}>
              Local Analysis
            </span>
          )}
        </div>

        {!hasJob && (
          <div style={styles.muted}>
            Open a supported job posting.
          </div>
        )}

        {hasJob && !hasResume && (
          <div style={styles.muted}>
            Import your master resume to analyze it
            against this job.
          </div>
        )}

        {hasJob && hasResume && !analysis && (
          <>
            <div style={styles.readyBox}>
              <div style={styles.readyTitle}>
                Ready for Analysis
              </div>

              <div style={styles.readyText}>
                Local retrieval will identify specific,
                evidence-backed matches. Generic resume
                language will not be treated as support
                for specific requirements.
              </div>
            </div>

            <button
              style={styles.primaryButton}
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing
                ? "Analyzing..."
                : "Analyze Resume Against Job"}
            </button>
          </>
        )}

        {analysis && (
          <>
            <div style={styles.modeNotice}>
              <strong>Analysis mode:</strong> Local
              <div style={styles.modeText}>
                No external AI semantic model is being
                used yet. Confidence represents evidence
                matching, not probability of getting the job.
              </div>
            </div>

            <div style={styles.summaryGrid}>
              <SummaryCard
                label="Strong"
                value={analysis.summary.strongSupport}
              />
              <SummaryCard
                label="Partial"
                value={analysis.summary.partialSupport}
              />
              <SummaryCard
                label="Related"
                value={analysis.summary.related}
              />
              <SummaryCard
                label="Missing"
                value={analysis.summary.noSupport}
              />
            </div>

            {analysis.groups.map(group => {
              const results =
                analysis.requirements.filter(
                  result =>
                    result.groupId === group.id
                );

              if (results.length === 0) return null;

              return (
                <div
                  key={group.id}
                  style={styles.group}
                >
                  <div style={styles.groupTitle}>
                    {group.title}
                    <span style={styles.groupCount}>
                      {results.length}
                    </span>
                  </div>

                  <div style={styles.requirements}>
                    {results.map(result => (
                      <RequirementCard
                        key={result.base.requirement.id}
                        result={result}
                        evidence={evidence}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            <button
              style={styles.secondaryButton}
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              Re-run Analysis
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function RequirementCard({
  result,
  evidence
}: {
  result: EnhancedJobResumeAnalysis["requirements"][number];
  evidence: Evidence[];
}) {
  const relationship =
    result.base.bestRelationship;

  return (
    <div style={styles.requirement}>
      <div style={styles.requirementHeader}>
        <span
          style={{
            ...styles.requirementSymbol,
            ...relationshipStyle(relationship)
          }}
        >
          {relationshipSymbol(relationship)}
        </span>

        <span style={styles.requirementText}>
          {result.base.requirement.text}
        </span>
      </div>

      <div style={styles.relationship}>
        {relationshipLabel(relationship)}

        {result.base.bestConfidence > 0 && (
          <>
            {" · "}
            {Math.round(
              result.base.bestConfidence * 100
            )}
            %
          </>
        )}
      </div>

      {result.candidates.length > 0 && (
        <div style={styles.evidenceList}>
          {result.candidates
            .slice(0, 3)
            .map(candidate => {
              const item = evidence.find(
                evidenceItem =>
                  evidenceItem.id ===
                  candidate.evidence.id
              );

              if (!item) return null;

              return (
                <div
                  key={item.id}
                  style={styles.evidence}
                >
                  <div style={styles.evidenceHeader}>
                    <span style={styles.evidenceLabel}>
                      Resume evidence
                    </span>
                    <span>
                      {Math.round(
                        candidate.score * 100
                      )}%
                    </span>
                  </div>

                  <div>{item.sourceText}</div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  status
}: {
  title: string;
  status: string;
}) {
  return (
    <div style={styles.sectionHeader}>
      <h2 style={styles.sectionTitle}>
        {title}
      </h2>
      <span style={styles.statusReady}>
        {status}
      </span>
    </div>
  );
}

function Stat({
  value,
  label
}: {
  value: number;
  label: string;
}) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function relationshipLabel(
  relationship:
    | "strong_support"
    | "partial_support"
    | "related"
    | "contradicts"
    | "no_support"
) {
  switch (relationship) {
    case "strong_support":
      return "Strong evidence";
    case "partial_support":
      return "Partial evidence";
    case "related":
      return "Related evidence";
    case "contradicts":
      return "Contradicting evidence";
    case "no_support":
      return "No evidence";
  }
}

function relationshipSymbol(
  relationship:
    | "strong_support"
    | "partial_support"
    | "related"
    | "contradicts"
    | "no_support"
) {
  switch (relationship) {
    case "strong_support":
      return "✓";
    case "partial_support":
      return "≈";
    case "related":
      return "•";
    case "contradicts":
      return "!";
    case "no_support":
      return "—";
  }
}

function relationshipStyle(
  relationship:
    | "strong_support"
    | "partial_support"
    | "related"
    | "contradicts"
    | "no_support"
): React.CSSProperties {
  switch (relationship) {
    case "strong_support":
      return { color: "#166534" };
    case "partial_support":
      return { color: "#a16207" };
    case "related":
      return { color: "#64748b" };
    case "contradicts":
      return { color: "#b91c1c" };
    default:
      return { color: "#94a3b8" };
  }
}

function SummaryCard({
  label,
  value
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryValue}>{value}</div>
      <div style={styles.summaryLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: "16px",
    background: "#f8fafc",
    color: "#172033",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  },

  header: { marginBottom: "18px" },

  productName: {
    fontSize: "18px",
    fontWeight: 700
  },

  subtitle: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#64748b"
  },

  section: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "12px"
  },

  analysisSection: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "12px"
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "12px"
  },

  sectionTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 700
  },

  statusReady: {
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 7px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534"
  },

  jobTitle: {
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1.35,
    marginBottom: "5px"
  },

  resumeFilename: {
    fontSize: "14px",
    fontWeight: 600,
    marginBottom: "5px",
    wordBreak: "break-word"
  },

  secondary: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "3px"
  },

  muted: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#64748b"
  },

  statRow: {
    display: "flex",
    marginTop: "14px"
  },

  stat: {
    padding: "9px 12px",
    background: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #e2e8f0"
  },

  statValue: {
    fontSize: "18px",
    fontWeight: 700
  },

  statLabel: {
    fontSize: "10px",
    color: "#64748b",
    marginTop: "2px"
  },

  readyBox: {
    padding: "12px",
    borderRadius: "8px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginTop: "10px",
    marginBottom: "12px"
  },

  readyTitle: {
    fontSize: "13px",
    fontWeight: 700,
    marginBottom: "5px"
  },

  readyText: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#64748b"
  },

  modeNotice: {
    padding: "9px 10px",
    borderRadius: "7px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    fontSize: "11px",
    marginBottom: "10px"
  },

  modeText: {
    marginTop: "3px",
    color: "#64748b",
    lineHeight: 1.4
  },

  primaryButton: {
    width: "100%",
    border: "none",
    borderRadius: "7px",
    padding: "10px 12px",
    marginTop: "12px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer"
  },

  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    padding: "8px 10px",
    marginTop: "10px",
    background: "#ffffff",
    color: "#334155",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer"
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    marginBottom: "14px"
  },

  summaryCard: {
    padding: "9px 5px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "7px",
    textAlign: "center"
  },

  summaryValue: {
    fontSize: "18px",
    fontWeight: 700
  },

  summaryLabel: {
    marginTop: "2px",
    fontSize: "9px",
    color: "#64748b"
  },

  group: {
    marginBottom: "16px"
  },

  groupTitle: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "13px",
    fontWeight: 700,
    paddingBottom: "6px",
    borderBottom: "1px solid #e2e8f0",
    marginBottom: "7px"
  },

  groupCount: {
    fontSize: "9px",
    fontWeight: 600,
    padding: "2px 5px",
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#64748b"
  },

  requirements: {
    display: "flex",
    flexDirection: "column",
    gap: "7px"
  },

  requirement: {
    padding: "10px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px"
  },

  requirementHeader: {
    display: "flex",
    gap: "7px",
    alignItems: "flex-start"
  },

  requirementSymbol: {
    fontWeight: 700,
    minWidth: "14px"
  },

  requirementText: {
    fontSize: "12px",
    lineHeight: 1.45,
    fontWeight: 600
  },

  relationship: {
    marginTop: "5px",
    marginLeft: "21px",
    fontSize: "10px",
    color: "#64748b"
  },

  evidenceList: {
    marginTop: "8px",
    marginLeft: "21px",
    display: "flex",
    flexDirection: "column",
    gap: "5px"
  },

  evidence: {
    padding: "7px",
    background: "#f8fafc",
    borderRadius: "5px",
    fontSize: "10px",
    lineHeight: 1.4,
    color: "#475569"
  },

  evidenceHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "2px"
  },

  evidenceLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "#64748b"
  },

  error: {
    padding: "10px",
    marginBottom: "12px",
    borderRadius: "8px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontSize: "12px",
    lineHeight: 1.4
  },

  message: {
    padding: "10px",
    marginBottom: "12px",
    borderRadius: "8px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e40af",
    fontSize: "12px",
    lineHeight: 1.4
  }
};

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Side panel root element was not found.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>
);
