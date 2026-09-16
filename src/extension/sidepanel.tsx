import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  createRoot
} from "react-dom/client";

import jsPDF from "jspdf";

import type { Job } from "../job/model/Job";
import type { Resume } from "../resume/model/Resume";
import type { Evidence } from "../resume/evidence/evidence";

import {
  PdfResumeImporter
} from "../resume/import/pdf-importer";

import {
  DocxResumeImporter
} from "../resume/import/docx-importer";

import {
  parseResume
} from "../resume/parsing/resume-parser";

import {
  buildEvidence
} from "../resume/evidence/evidence-builder";

import {
  getMasterResume,
  saveMasterResume
} from "../storage/resume-store";

import {
  saveOriginalDocx,
  getOriginalDocx
} from "../storage/original-document-store";

import {
  applyDocxTextReplacements
} from "../resume/export/docx-resume-editor";

import {
  analyzeJobEnhanced,
  type EnhancedJobResumeAnalysis,
  type EnhancedRequirementResult
} from "../analysis/enhanced-analysis";

import type {
  Suggestion
} from "../suggestions/Suggestion";

type ExtractJobResponse =
  | {
      success: true;
      job: Job;
    }
  | {
      success: false;
      error: string;
    };

type EvidenceDecision =
  | "pending"
  | "accepted"
  | "rejected"
  | "edited";

type RequirementReviewState = {
  status:
    | "pending"
    | "reviewed";
  evidence: Record<
    string,
    EvidenceDecision
  >;
};

type ReviewState = {
  selectedRequirementId?: string;
  requirements: Record<
    string,
    RequirementReviewState
  >;
  suggestions: Suggestion[];
};

type View =
  | "review"
  | "final";

const pdfImporter =
  new PdfResumeImporter();

const docxImporter =
  new DocxResumeImporter();

const REVIEW_PREFIX =
  "careerLensReview:";

function reviewStorageKey(
  jobId: string,
  resumeId: string
): string {
  return `${REVIEW_PREFIX}${jobId}:${resumeId}`;
}

function createEmptyReview(
  job: Job
): ReviewState {
  const requirements: ReviewState["requirements"] =
    {};

  for (const requirement of job.requirements) {
    requirements[requirement.id] = {
      status: "pending",
      evidence: {}
    };
  }

  return {
    selectedRequirementId:
      job.requirements[0]?.id,
    requirements,
    suggestions: []
  };
}

function downloadBlob(
  blob: Blob,
  filename: string
): void {
  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function safeFilename(
  value: string
): string {
  return value
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .trim();
}

function buildResumeText(
  resume: Resume,
  suggestions: Suggestion[]
): {
  heading: string;
  sections: {
    title: string;
    lines: string[];
  }[];
} {
  const accepted =
    suggestions.filter(
      suggestion =>
        suggestion.status ===
          "ACCEPTED" ||
        suggestion.status ===
          "EDITED"
    );

  const acceptedByContent =
    new Map<string, Suggestion>();

  for (const suggestion of accepted) {
    if (
      suggestion.proposed &&
      suggestion.proposed.trim()
    ) {
      acceptedByContent.set(
        suggestion.sectionId,
        suggestion
      );
    }
  }

  return {
    heading:
      resume.contact.name ??
      "Resume",
    sections:
      resume.sections.map(section => {
        const suggestion =
          acceptedByContent.get(
            section.id
          );

        if (
          suggestion?.proposed &&
          suggestion.proposed.trim()
        ) {
          return {
            title: section.title,
            lines: [
              suggestion.proposed
            ]
          };
        }

        return {
          title: section.title,
          lines:
            section.content.map(
              content =>
                content.text
            )
        };
      })
  };
}

async function generateDocx(
  resume: Resume,
  suggestions: Suggestion[],
  filename: string
): Promise<void> {
  const original = await getOriginalDocx(
    resume.id
  );

  if (!original) {
    throw new Error(
      "The original DOCX document is not available. Please re-import your master resume."
    );
  }

  const replacements = suggestions
    .filter(
      suggestion =>
        (
          suggestion.status === "ACCEPTED" ||
          suggestion.status === "EDITED"
        ) &&
        Boolean(suggestion.original) &&
        Boolean(suggestion.proposed) &&
        suggestion.original !== suggestion.proposed
    )
    .map(
      suggestion => ({
        original:
          suggestion.original!,
        replacement:
          suggestion.proposed!
      })
    );

  const blob =
    await applyDocxTextReplacements(
      new Blob(
        [original.data],
        {
          type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
      ),
      replacements
    );

  downloadBlob(
    blob,
    `${filename}.docx`
  );
}

function generatePdf(
  resume: Resume,
  suggestions: Suggestion[],
  filename: string
): void {
  const content =
    buildResumeText(
      resume,
      suggestions
    );

  const pdf =
    new jsPDF({
      unit: "pt",
      format: "letter"
    });

  const margin = 48;

  let y = 52;

  pdf.setFontSize(20);

  pdf.text(
    content.heading,
    margin,
    y
  );

  y += 24;

  pdf.setFontSize(10);

  if (resume.contact.email) {
    pdf.text(
      resume.contact.email,
      margin,
      y
    );

    y += 14;
  }

  if (resume.contact.phone) {
    pdf.text(
      resume.contact.phone,
      margin,
      y
    );

    y += 18;
  }

  for (
    const section of content.sections
  ) {
    if (y > 720) {
      pdf.addPage();
      y = 52;
    }

    y += 10;

    pdf.setFontSize(13);

    pdf.text(
      section.title,
      margin,
      y
    );

    y += 18;

    pdf.setFontSize(10);

    for (
      const line of section.lines
    ) {
      const wrapped =
        pdf.splitTextToSize(
          line,
          500
        );

      for (
        const wrappedLine of wrapped
      ) {
        if (y > 740) {
          pdf.addPage();
          y = 52;
        }

        pdf.text(
          `• ${wrappedLine}`,
          margin,
          y
        );

        y += 14;
      }

      y += 3;
    }
  }

  pdf.save(
    `${filename}.pdf`
  );
}

function SidePanel() {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [
    job,
    setJob
  ] = useState<Job | null>(null);

  const [
    resume,
    setResume
  ] = useState<Resume | null>(
    null
  );

  const [
    evidence,
    setEvidence
  ] = useState<Evidence[]>([]);

  const [
    analysis,
    setAnalysis
  ] =
    useState<EnhancedJobResumeAnalysis | null>(
      null
    );

  const [
    review,
    setReview
  ] = useState<ReviewState | null>(
    null
  );

  const [
    view,
    setView
  ] = useState<View>("review");

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    importing,
    setImporting
  ] = useState(false);

  const [
    analyzing,
    setAnalyzing
  ] = useState(false);

  const [
    error,
    setError
  ] = useState<string | null>(
    null
  );

  const [
    message,
    setMessage
  ] = useState<string | null>(
    null
  );

  const [
    showGenerate,
    setShowGenerate
  ] = useState(false);

  const [
    generating,
    setGenerating
  ] = useState(false);

  const [
    generateFormat,
    setGenerateFormat
  ] = useState<
    "docx" | "pdf" | "both"
  >("both");

  const [
    editEvidence,
    setEditEvidence
  ] = useState<{
    requirementId: string;
    evidenceId: string;
  } | null>(null);

  const [
    editedEvidenceText,
    setEditedEvidenceText
  ] = useState("");

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    if (!job || !resume) {
      return;
    }

    const key =
      reviewStorageKey(
        job.id,
        resume.id
      );

    chrome.storage.local.get(
      key,
      result => {
        const stored =
          result[key] as
            | ReviewState
            | undefined;

        if (stored) {
          setReview(
            stored
          );
        } else {
          const initial =
            createEmptyReview(
              job
            );

          setReview(
            initial
          );

          void persistReview(
            key,
            initial
          );
        }
      }
    );
  }, [job?.id, resume?.id]);

  async function persistReview(
    key: string,
    state: ReviewState
  ): Promise<void> {
    await chrome.storage.local.set({
      [key]: state
    });
  }

  async function updateReview(
    updater: (
      current: ReviewState
    ) => ReviewState
  ): Promise<void> {
    if (!review || !job || !resume) {
      return;
    }

    const next =
      updater(review);

    setReview(next);

    await persistReview(
      reviewStorageKey(
        job.id,
        resume.id
      ),
      next
    );
  }

  async function initialize() {
    setLoading(true);
    setError(null);

    try {
      await loadMasterResume();
      await extractCurrentJob();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to initialize CareerLens."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadMasterResume() {
    const stored =
      await getMasterResume();

    setResume(
      stored.resume
    );

    setEvidence(
      stored.evidence
    );
  }

  async function extractCurrentJob() {
    const tabs =
      await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

    const tab = tabs[0];

    if (!tab?.id) {
      throw new Error(
        "No active browser tab was found."
      );
    }

    const response =
      await sendExtractJobMessage(
        tab.id
      );

    if (!response.success) {
      throw new Error(
        response.error
      );
    }

    setJob(
      response.job
    );
  }

  async function sendExtractJobMessage(
    tabId: number
  ): Promise<ExtractJobResponse> {
    try {
      return await chrome.tabs.sendMessage(
        tabId,
        {
          type: "EXTRACT_JOB"
        }
      );
    } catch {
      const injection =
        await chrome.runtime.sendMessage({
          type:
            "INJECT_CONTENT_SCRIPT",
          tabId
        });

      if (!injection?.success) {
        return {
          success: false,
          error:
            injection?.error ??
            "Unable to initialize the job page."
        };
      }

      return await chrome.tabs.sendMessage(
        tabId,
        {
          type: "EXTRACT_JOB"
        }
      );
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
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setImporting(true);
    setError(null);
    setMessage(null);

    try {
      let importer;

      if (
        pdfImporter.canImport(file)
      ) {
        importer = pdfImporter;
      } else if (
        docxImporter.canImport(file)
      ) {
        importer = docxImporter;
      } else {
        throw new Error(
          "Unsupported resume format. Please select a PDF or DOCX file."
        );
      }

      const imported =
        await importer.import(
          file
        );

      if (
        !imported.text.trim()
      ) {
        throw new Error(
          "The resume could not be read. It may contain scanned images instead of selectable text."
        );
      }

      const parsed =
        parseResume(
          imported.text,
          imported.filename,
          imported.type
        );

      const builtEvidence =
        buildEvidence(
          parsed
        );

      parsed.evidenceIds =
        builtEvidence.map(
          item => item.id
        );

      // Keep the original DOCX artifact as the formatting source of truth.
      // The parsed Resume model is used for analysis, but generated resumes
      // must be derived from the original document to preserve formatting.
      if (
        imported.type === "docx" &&
        imported.originalData
      ) {
        await saveOriginalDocx(
          parsed.id,
          imported.filename,
          imported.originalData
        );

        parsed.originalDocument = {
          type: "docx",
          filename: imported.filename
        };
      }

      await saveMasterResume(
        parsed,
        builtEvidence
      );

      setResume(parsed);
      setEvidence(
        builtEvidence
      );

      setAnalysis(null);
      setReview(null);

      setMessage(
        `Resume imported: ${imported.filename}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to import the resume."
      );
    } finally {
      setImporting(false);

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  function analyze() {
    if (!job || !resume) {
      return;
    }

    setAnalyzing(true);
    setError(null);
    setMessage(null);

    try {
      const result =
        analyzeJobEnhanced(
          job,
          resume,
          evidence
        );

      setAnalysis(result);

      setReview(
        current =>
          current ??
          createEmptyReview(
            job
          )
      );

      setMessage(
        "Local analysis complete."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to analyze the resume."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  const selectedRequirement =
    useMemo(() => {
      if (!job || !review) {
        return null;
      }

      return (
        job.requirements.find(
          requirement =>
            requirement.id ===
            review.selectedRequirementId
        ) ??
        job.requirements[0] ??
        null
      );
    }, [
      job,
      review
    ]);

  const selectedResult =
    useMemo(() => {
      if (
        !analysis ||
        !selectedRequirement
      ) {
        return null;
      }

      return (
        analysis.requirements.find(
          result =>
            result.base.requirement.id ===
            selectedRequirement.id
        ) ?? null
      );
    }, [
      analysis,
      selectedRequirement
    ]);

  const reviewedCount =
    useMemo(() => {
      if (!job || !review) {
        return 0;
      }

      return job.requirements.filter(
        requirement =>
          review.requirements[
            requirement.id
          ]?.status === "reviewed"
      ).length;
    }, [
      job,
      review
    ]);

  const acceptedEvidenceCount =
    useMemo(() => {
      if (!review) {
        return 0;
      }

      return Object.values(
        review.requirements
      ).reduce(
        (total, item) =>
          total +
          Object.values(
            item.evidence
          ).filter(
            decision =>
              decision ===
              "accepted" ||
              decision ===
              "edited"
          ).length,
        0
      );
    }, [review]);

  async function selectRequirement(
    requirementId: string
  ) {
    await updateReview(
      current => ({
        ...current,
        selectedRequirementId:
          requirementId
      })
    );

    await highlightRequirement(
      requirementId
    );
  }

  async function highlightRequirement(
    requirementId: string
  ) {
    const requirement =
      job?.requirements.find(
        item =>
          item.id ===
          requirementId
      );

    if (!requirement) {
      return;
    }

    const tabs =
      await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

    const tab = tabs[0];

    if (!tab?.id) {
      return;
    }

    try {
      await chrome.tabs.sendMessage(
        tab.id,
        {
          type:
            "HIGHLIGHT_REQUIREMENT",
          text:
            requirement.sourceText ||
            requirement.text
        }
      );
    } catch {
      /*
       * The job page may no longer have the
       * content script. The next extraction/
       * injection will restore it.
       */
    }
  }

  function requirementIsReviewed(
    requirementId: string
  ): boolean {
    return (
      review?.requirements[
        requirementId
      ]?.status ===
      "reviewed"
    );
  }

  async function setEvidenceDecision(
    requirementId: string,
    evidenceId: string,
    decision: EvidenceDecision,
    text?: string
  ) {
    await updateReview(
      current => {
        const requirement =
          current.requirements[
            requirementId
          ];

        const evidenceDecisions = {
          ...requirement.evidence
        };

        evidenceDecisions[
          evidenceId
        ] = decision;

        /*
         * An edit is a real resume change.
         *
         * Store it as a Suggestion so that:
         *
         *   user edit
         *       ↓
         *   ReviewState.suggestions
         *       ↓
         *   generateDocx()
         *       ↓
         *   OOXML text replacement
         *
         * The original evidence remains the source
         * of truth and the user's typed text becomes
         * the proposed replacement.
         */
        let suggestions =
          current.suggestions;

        if (
          decision === "edited" &&
          text !== undefined
        ) {
          const evidenceItem =
            evidence.find(
              item =>
                item.id === evidenceId
            );

          if (evidenceItem) {
            const existingIndex =
              suggestions.findIndex(
                suggestion =>
                  suggestion.evidenceIds.includes(
                    evidenceId
                  ) &&
                  suggestion.requirementIds.includes(
                    requirementId
                  )
              );

            const suggestion: Suggestion = {
              id:
                existingIndex >= 0
                  ? suggestions[
                      existingIndex
                    ].id
                  : `manual-edit-${Date.now()}-${evidenceId}`,
              type: "REWORD",
              sectionId:
                evidenceItem.sectionId,
              original:
                evidenceItem.sourceText,
              proposed: text,
              reason:
                "User-edited resume evidence for this job requirement.",
              evidenceIds: [
                evidenceId
              ],
              requirementIds: [
                requirementId
              ],
              confidence: 1,
              status: "EDITED"
            };

            if (existingIndex >= 0) {
              suggestions = [
                ...suggestions
              ];

              suggestions[
                existingIndex
              ] = suggestion;
            } else {
              suggestions = [
                ...suggestions,
                suggestion
              ];
            }
          }
        }

        /*
         * If an edited suggestion is subsequently
         * rejected, remove it from the generation
         * set. Accepting the evidence does not
         * manufacture a text change.
         */
        if (
          decision === "rejected"
        ) {
          suggestions =
            suggestions.filter(
              suggestion =>
                !(
                  suggestion.evidenceIds.includes(
                    evidenceId
                  ) &&
                  suggestion.requirementIds.includes(
                    requirementId
                  )
                )
            );
        }

        return {
          ...current,
          requirements: {
            ...current.requirements,
            [requirementId]: {
              ...requirement,
              evidence:
                evidenceDecisions
            }
          },
          suggestions
        };
      }
    );

    setMessage(
      decision === "accepted"
        ? "Evidence accepted."
        : decision === "rejected"
          ? "Evidence rejected."
          : "Evidence edited and saved."
    );
  }

  async function finishRequirement() {
    if (
      !selectedRequirement ||
      !review
    ) {
      return;
    }

    await updateReview(
      current => ({
        ...current,
        requirements: {
          ...current.requirements,
          [selectedRequirement.id]: {
            ...current.requirements[
              selectedRequirement.id
            ],
            status: "reviewed"
          }
        }
      })
    );

    moveRequirement(1);
  }

  function moveRequirement(
    direction: number
  ) {
    if (!job || !review) {
      return;
    }

    const currentIndex =
      job.requirements.findIndex(
        requirement =>
          requirement.id ===
          review.selectedRequirementId
      );

    const nextIndex =
      Math.max(
        0,
        Math.min(
          job.requirements.length - 1,
          currentIndex +
            direction
        )
      );

    const next =
      job.requirements[
        nextIndex
      ];

    if (next) {
      void selectRequirement(
        next.id
      );
    }
  }

  function getEvidenceForResult(
    result: EnhancedRequirementResult
  ): Evidence[] {
    const candidateIds =
      new Set(
        result.candidates.map(
          candidate =>
            candidate.evidence.id
        )
      );

    return evidence.filter(
      item =>
        candidateIds.has(
          item.id
        )
    );
  }

  const groupedResults =
    useMemo(() => {
      if (!analysis) {
        return [];
      }

      return analysis.groups
        .map(group => ({
          group,
          results:
            analysis.requirements.filter(
              result =>
                result.groupId ===
                group.id
            )
        }))
        .filter(
          item =>
            item.results.length > 0
        );
    }, [analysis]);

  async function generateResume() {
    if (!resume) {
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const filename =
        safeFilename(
          [
            resume.contact.name ??
              "Resume",
            job?.title ??
              "Tailored_Resume",
            job?.company ??
              ""
          ]
            .filter(Boolean)
            .join("_")
        );

      if (
        generateFormat ===
          "docx" ||
        generateFormat ===
          "both"
      ) {
        await generateDocx(
          resume,
          review?.suggestions ??
            [],
          filename
        );
      }

      if (
        generateFormat ===
          "pdf" ||
        generateFormat ===
          "both"
      ) {
        generatePdf(
          resume,
          review?.suggestions ??
            [],
          filename
        );
      }

      setShowGenerate(false);
      setMessage(
        "Resume generated successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate the resume."
      );
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>
          <div style={styles.brand}>
            CareerLens
          </div>

          <div style={styles.muted}>
            Reading current job...
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div style={styles.page}>
        <Header
          reviewed={0}
          total={0}
          onGenerate={() => {}}
          disabled
        />

        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            JOB
          </div>

          <h2 style={styles.emptyTitle}>
            Open a job posting
          </h2>

          <p style={styles.muted}>
            Open a supported LinkedIn job
            page, then reopen the
            CareerLens side panel.
          </p>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div style={styles.page}>
        <Header
          reviewed={0}
          total={job.requirements.length}
          onGenerate={() => {}}
          disabled
        />

        <div style={styles.emptyState}>
          <h2 style={styles.emptyTitle}>
            Import your master resume
          </h2>

          <p style={styles.muted}>
            CareerLens keeps your master
            resume unchanged and creates
            job-specific versions from it.
          </p>

          <button
            style={styles.primaryButton}
            onClick={
              openResumePicker
            }
            disabled={importing}
          >
            {importing
              ? "Importing..."
              : "Import Resume"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={
              handleResumeFile
            }
            style={{
              display: "none"
            }}
          />

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={styles.page}>
        <Header
          reviewed={0}
          total={job.requirements.length}
          onGenerate={() => {}}
          disabled
        />

        <JobSummary job={job} />

        <div style={styles.setupCard}>
          <div style={styles.setupTitle}>
            Ready to review
          </div>

          <p style={styles.muted}>
            CareerLens will compare the
            requirements against your
            resume evidence locally.
          </p>

          <button
            style={styles.primaryButton}
            onClick={analyze}
            disabled={analyzing}
          >
            {analyzing
              ? "Analyzing..."
              : "Analyze Resume"}
          </button>

          <button
            style={styles.secondaryButton}
            onClick={
              openResumePicker
            }
            disabled={importing}
          >
            Replace Resume
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={
              handleResumeFile
            }
            style={{
              display: "none"
            }}
          />
        </div>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}
      </div>
    );
  }

  if (!review) {
    return null;
  }

  return (
    <div style={styles.page}>
      <Header
        reviewed={reviewedCount}
        total={job.requirements.length}
        onGenerate={() =>
          setShowGenerate(true)
        }
        disabled={
          reviewedCount === 0
        }
      />

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {message && (
        <div style={styles.message}>
          {message}
        </div>
      )}

      {view === "final" ? (
        <FinalReview
          job={job}
          resume={resume}
          review={review}
          reviewedCount={
            reviewedCount
          }
          acceptedEvidenceCount={
            acceptedEvidenceCount
          }
          onBack={() =>
            setView("review")
          }
          onGenerate={() =>
            setShowGenerate(true)
          }
        />
      ) : (
        <>
          <JobSummary job={job} />

          <div style={styles.progressRow}>
            <div>
              <strong>
                Review requirements
              </strong>

              <div
                style={
                  styles.progressSubtext
                }
              >
                {reviewedCount} of{" "}
                {job.requirements.length}{" "}
                reviewed
              </div>
            </div>

            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${
                    job.requirements.length
                      ? (reviewedCount /
                          job.requirements
                            .length) *
                        100
                      : 0
                  }%`
                }}
              />
            </div>
          </div>

          <div style={styles.workspace}>
            <aside style={styles.requirementNav}>
              {groupedResults.map(
                ({ group, results }) => {
                  const groupReviewed =
                    results.filter(
                      result =>
                        requirementIsReviewed(
                          result.base
                            .requirement
                            .id
                        )
                    ).length;

                  return (
                    <div
                      key={group.id}
                      style={
                        styles.requirementGroup
                      }
                    >
                      <div
                        style={
                          styles.groupHeader
                        }
                      >
                        <span>
                          {group.title}
                        </span>

                        <span
                          style={
                            styles.groupProgress
                          }
                        >
                          {groupReviewed}/
                          {results.length}
                        </span>
                      </div>

                      {results.map(
                        result => {
                          const requirement =
                            result.base
                              .requirement;

                          const selected =
                            requirement.id ===
                            selectedRequirement?.id;

                          const reviewed =
                            requirementIsReviewed(
                              requirement.id
                            );

                          return (
                            <button
                              key={
                                requirement.id
                              }
                              style={{
                                ...styles.requirementItem,
                                ...(selected
                                  ? styles.requirementItemSelected
                                  : {})
                              }}
                              onClick={() =>
                                void selectRequirement(
                                  requirement.id
                                )
                              }
                            >
                              <span
                                style={
                                  reviewed
                                    ? styles.checkCircle
                                    : styles.emptyCircle
                                }
                              >
                                {reviewed
                                  ? "✓"
                                  : ""}
                              </span>

                              <span
                                style={
                                  styles.requirementItemText
                                }
                              >
                                {
                                  requirement.text
                                }
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  );
                }
              )}
            </aside>

            <main style={styles.reviewPane}>
              {selectedRequirement &&
              selectedResult ? (
                <RequirementReview
                  requirement={
                    selectedRequirement
                  }
                  result={
                    selectedResult
                  }
                  evidence={
                    getEvidenceForResult(
                      selectedResult
                    )
                  }
                  decisions={
                    review
                      .requirements[
                        selectedRequirement
                          .id
                      ]?.evidence ??
                    {}
                  }
                  onDecision={
                    setEvidenceDecision
                  }
                  onEditStart={(
                    evidenceItem
                  ) => {
                    setEditEvidence({
                      requirementId:
                        selectedRequirement.id,
                      evidenceId:
                        evidenceItem.id
                    });

                    setEditedEvidenceText(
                      evidenceItem.sourceText
                    );
                  }}
                  onFinish={
                    finishRequirement
                  }
                  onRegenerateAI={(evidenceItem) => {
                    setMessage(
                      "AI regeneration will be connected to the semantic AI provider."
                    );
                  }}
                  reviewed={
                    requirementIsReviewed(
                      selectedRequirement.id
                    )
                  }
                />
              ) : (
                <div
                  style={
                    styles.emptyState
                  }
                >
                  Select a requirement.
                </div>
              )}
            </main>
          </div>

          <div style={styles.bottomBar}>
            <button
              style={
                styles.secondaryButton
              }
              onClick={() =>
                moveRequirement(-1)
              }
            >
              ← Previous
            </button>

            <button
              style={
                styles.finalReviewButton
              }
              onClick={() =>
                setView("final")
              }
            >
              Final Review
            </button>

            <button
              style={
                styles.secondaryButton
              }
              onClick={() =>
                moveRequirement(1)
              }
            >
              Next →
            </button>
          </div>
        </>
      )}

      {showGenerate && (
        <GenerateModal
          format={generateFormat}
          setFormat={
            setGenerateFormat
          }
          generating={generating}
          onClose={() =>
            setShowGenerate(false)
          }
          onGenerate={() =>
            void generateResume()
          }
        />
      )}

      {editEvidence && (
        <EditEvidenceModal
          value={
            editedEvidenceText
          }
          setValue={
            setEditedEvidenceText
          }
          onClose={() =>
            setEditEvidence(null)
          }
          onSave={() => {
            void setEvidenceDecision(
              editEvidence.requirementId,
              editEvidence.evidenceId,
              "edited",
              editedEvidenceText
            );

            setEditEvidence(null);
          }}
        />
      )}
    </div>
  );
}

function Header({
  reviewed,
  total,
  onGenerate,
  disabled
}: {
  reviewed: number;
  total: number;
  onGenerate: () => void;
  disabled?: boolean;
}) {
  return (
    <header style={styles.header}>
      <div>
        <div style={styles.brand}>
          CareerLens
        </div>

        <div style={styles.headerSubtitle}>
          Evidence-grounded resume review
        </div>
      </div>

      <div style={styles.headerRight}>
        <div style={styles.headerProgress}>
          {reviewed}/{total}
        </div>

        <button
          style={
            disabled
              ? styles.disabledButton
              : styles.headerButton
          }
          disabled={disabled}
          onClick={onGenerate}
        >
          Generate Resume
        </button>
      </div>
    </header>
  );
}

function JobSummary({
  job
}: {
  job: Job;
}) {
  return (
    <section style={styles.jobSummary}>
      <div style={styles.jobSummaryTitle}>
        {job.title ||
          "Untitled position"}
      </div>

      <div style={styles.jobSummaryMeta}>
        {job.company ??
          "Company not detected"}

        {job.location
          ? ` · ${job.location}`
          : ""}
      </div>

      <div style={styles.jobStats}>
        <Stat
          value={
            job.requirements.length
          }
          label="requirements"
        />

        <Stat
          value={
            job.requirements.filter(
              requirement =>
                requirement.priority ===
                "high"
            ).length
          }
          label="high priority"
        />
      </div>
    </section>
  );
}

function RequirementReview({
  requirement,
  result,
  evidence,
  decisions,
  onDecision,
  onEditStart,
  onRegenerateAI,
  onFinish,
  reviewed
}: {
  requirement: EnhancedRequirementResult["base"]["requirement"];
  result: EnhancedRequirementResult;
  evidence: Evidence[];
  decisions: Record<string, EvidenceDecision>;
  onDecision: (
    requirementId: string,
    evidenceId: string,
    decision: EvidenceDecision
  ) => void;
  onEditStart: (evidence: Evidence) => void;
  onRegenerateAI: (evidence: Evidence) => void;
  onFinish: () => void;
  reviewed: boolean;
}) {
  return (
    <div>
      <section>
        <div style={styles.sectionHeading}>
          Resume evidence
        </div>

        <div style={styles.sectionDescription}>
          Review the existing resume evidence that could support this requirement.
        </div>

        {evidence.length === 0 ? (
          <div style={styles.noEvidence}>
            No candidate evidence was retrieved for this requirement.
          </div>
        ) : (
          evidence.map(item => (
            <EvidenceCard
              key={item.id}
              evidence={item}
              decision={decisions[item.id] ?? "pending"}
              onAccept={() =>
                onDecision(
                  requirement.id,
                  item.id,
                  "accepted"
                )
              }
              onReject={() =>
                onDecision(
                  requirement.id,
                  item.id,
                  "rejected"
                )
              }
              onEdit={() => onEditStart(item)}
              onRegenerateAI={() => onRegenerateAI(item)}
            />
          ))
        )}
      </section>

      <section style={styles.reasonSection}>
        <div style={styles.sectionHeading}>
          Local analysis
        </div>

        <div style={styles.analysisExplanation}>
          {localAnalysisExplanation(result)}
        </div>

        <div style={styles.analysisNote}>
          Local matching identifies candidate evidence. It does not claim semantic support or predict hiring outcomes.
        </div>
      </section>

      <div style={styles.requirementFooter}>
        <button
          style={styles.primaryButton}
          onClick={onFinish}
        >
          {reviewed
            ? "Reviewed ✓"
            : "Mark Requirement Reviewed"}
        </button>
      </div>
    </div>
  );
}

function localAnalysisExplanation(
  result: EnhancedRequirementResult
): string {
  const relationship = result.base.bestRelationship;

  switch (relationship) {
    case "strong_support":
      return "Local matching found strong evidence overlap. Review the candidate evidence above before accepting it.";

    case "partial_support":
      return "Local matching found partial evidence overlap. The evidence may support part of the requirement but should be reviewed manually.";

    case "related":
      return "Local retrieval found related resume concepts, but this is not treated as direct support.";

    case "contradicts":
      return "The local analysis detected concepts that may conflict with this requirement. Review the evidence carefully.";

    case "no_support":
    default:
      return "No sufficiently strong local evidence match was established for this requirement.";
  }
}

function EvidenceCard({
  evidence,
  decision,
  onAccept,
  onReject,
  onEdit,
  onRegenerateAI
}: {
  evidence: Evidence;
  decision: EvidenceDecision;
  onAccept: () => void;
  onReject: () => void;
  onEdit: () => void;
  onRegenerateAI: () => void;
}) {
  const selected =
    decision === "accepted" ||
    decision === "edited";

  return (
    <div
      style={{
        ...styles.evidenceCard,
        ...(selected
          ? styles.evidenceCardAccepted
          : {}),
        ...(decision === "rejected"
          ? styles.evidenceCardRejected
          : {})
      }}
    >
      <div style={styles.evidenceTop}>
        <div>
          <div style={styles.evidenceSection}>
            Resume evidence
          </div>

          <div style={styles.evidenceText}>
            {evidence.sourceText}
          </div>
        </div>

        <div style={styles.evidenceDecision}>
          {decision}
        </div>
      </div>

      {evidence.skills.length > 0 && (
        <div style={styles.tagRow}>
          {evidence.skills.map(skill => (
            <span
              key={skill}
              style={styles.tag}
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <div style={styles.evidenceActions}>
        <button
          style={styles.acceptButton}
          onClick={onAccept}
        >
          Accept
        </button>

        <button
          style={styles.rejectButton}
          onClick={onReject}
        >
          Reject
        </button>

        <button
          style={styles.editButton}
          onClick={onEdit}
        >
          Edit
        </button>

        <button
          style={styles.aiButton}
          onClick={onRegenerateAI}
        >
          Regenerate using AI
        </button>
      </div>
    </div>
  );
}


function FinalReview({
  job,
  resume,
  review,
  reviewedCount,
  acceptedEvidenceCount,
  onBack,
  onGenerate
}: {
  job: Job;
  resume: Resume;
  review: ReviewState;
  reviewedCount: number;
  acceptedEvidenceCount: number;
  onBack: () => void;
  onGenerate: () => void;
}) {
  const acceptedSuggestions =
    review.suggestions.filter(
      suggestion =>
        suggestion.status === "ACCEPTED" ||
        suggestion.status === "EDITED"
    );

  const rejectedSuggestions =
    review.suggestions.filter(
      suggestion =>
        suggestion.status === "REJECTED"
    );

  const pendingSuggestions =
    review.suggestions.filter(
      suggestion =>
        suggestion.status === "PENDING"
    );

  const changedSections = new Set(
    acceptedSuggestions.map(
      suggestion => suggestion.sectionId
    )
  );

  return (
    <div>
      <section style={styles.finalSummary}>
        <div style={styles.sectionHeading}>
          Final Review
        </div>

        <div style={styles.sectionDescription}>
          Review the decisions that will be used to create the job-specific resume.
        </div>

        <div style={styles.finalStats}>
          <SummaryCard
            label="Requirements reviewed"
            value={`${reviewedCount}/${job.requirements.length}`}
          />

          <SummaryCard
            label="Evidence accepted"
            value={String(acceptedEvidenceCount)}
          />

          <SummaryCard
            label="Changes accepted"
            value={String(acceptedSuggestions.length)}
          />
        </div>
      </section>

      <section style={styles.reasonSection}>
        <div style={styles.sectionHeading}>
          Resume changes
        </div>

        {acceptedSuggestions.length === 0 ? (
          <div style={styles.noEvidence}>
            No resume changes have been accepted yet.
          </div>
        ) : (
          acceptedSuggestions.map(suggestion => (
            <div
              key={suggestion.id}
              style={styles.suggestionCard}
            >
              <div style={styles.suggestionType}>
                {suggestion.type}
              </div>

              {suggestion.original && (
                <div style={styles.suggestionOriginal}>
                  <strong>Original</strong>
                  <div>
                    {suggestion.original}
                  </div>
                </div>
              )}

              {suggestion.proposed && (
                <div style={styles.suggestionProposed}>
                  <strong>Proposed</strong>
                  <div>
                    {suggestion.proposed}
                  </div>
                </div>
              )}

              <div style={styles.analysisNote}>
                {suggestion.reason}
              </div>
            </div>
          ))
        )}
      </section>

      <section style={styles.reasonSection}>
        <div style={styles.sectionHeading}>
          Generation summary
        </div>

        <div style={styles.analysisNote}>
          Master resume: {resume.contact.name ?? "Resume"}
        </div>

        <div style={styles.analysisNote}>
          Job: {job.title || "Untitled position"}
        </div>

        <div style={styles.analysisNote}>
          {changedSections.size} resume section
          {changedSections.size === 1 ? "" : "s"} will
          be changed.
        </div>

        {pendingSuggestions.length > 0 && (
          <div style={styles.analysisNote}>
            {pendingSuggestions.length} suggestion
            {pendingSuggestions.length === 1 ? "" : "s"} remain
            pending and will not be applied.
          </div>
        )}

        {rejectedSuggestions.length > 0 && (
          <div style={styles.analysisNote}>
            {rejectedSuggestions.length} rejected suggestion
            {rejectedSuggestions.length === 1 ? "" : "s"} will
            not be applied.
          </div>
        )}
      </section>

      <div style={styles.requirementFooter}>
        <button
          style={styles.secondaryButton}
          onClick={onBack}
        >
          ← Back to Review
        </button>

        <button
          style={styles.primaryButton}
          onClick={onGenerate}
        >
          Generate Resume
        </button>
      </div>
    </div>
  );
}

function GenerateModal({
  format,
  setFormat,
  generating,
  onClose,
  onGenerate
}: {
  format: "docx" | "pdf" | "both";
  setFormat: (
    format: "docx" | "pdf" | "both"
  ) => void;
  generating: boolean;
  onClose: () => void;
  onGenerate: () => void;
}) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.sectionHeading}>
              Generate Resume
            </div>

            <div style={styles.sectionDescription}>
              Create a job-specific resume from the reviewed changes.
            </div>
          </div>

          <button
            style={styles.modalClose}
            onClick={onClose}
            disabled={generating}
          >
            ×
          </button>
        </div>

        <div style={styles.formatOptions}>
          <button
            style={
              format === "docx"
                ? styles.formatOptionSelected
                : styles.formatOption
            }
            onClick={() =>
              setFormat("docx")
            }
            disabled={generating}
          >
            DOCX
          </button>

          <button
            style={
              format === "pdf"
                ? styles.formatOptionSelected
                : styles.formatOption
            }
            onClick={() =>
              setFormat("pdf")
            }
            disabled={generating}
          >
            PDF
          </button>

          <button
            style={
              format === "both"
                ? styles.formatOptionSelected
                : styles.formatOption
            }
            onClick={() =>
              setFormat("both")
            }
            disabled={generating}
          >
            Both
          </button>
        </div>

        <div style={styles.modalActions}>
          <button
            style={styles.secondaryButton}
            onClick={onClose}
            disabled={generating}
          >
            Cancel
          </button>

          <button
            style={styles.primaryButton}
            onClick={onGenerate}
            disabled={generating}
          >
            {generating
              ? "Generating..."
              : "Generate Resume"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditEvidenceModal({
  value,
  setValue,
  onClose,
  onSave
}: {
  value: string;
  setValue: (
    value: string
  ) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.eyebrow}>
              EDIT EVIDENCE
            </div>

            <h2 style={styles.modalTitle}>
              Edit wording
            </h2>
          </div>

          <button
            style={styles.closeButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <textarea
          value={value}
          onChange={event =>
            setValue(
              event.target.value
            )
          }
          style={styles.textarea}
          rows={8}
        />

        <div style={styles.modalHint}>
          Keep this grounded in your actual
          resume experience. CareerLens
          will not invent qualifications.
        </div>

        <div style={styles.modalActions}>
          <button
            style={styles.secondaryButton}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            style={styles.primaryButton}
            onClick={onSave}
          >
            Save Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryValue}>
        {value}
      </div>

      <div style={styles.summaryLabel}>
        {label}
      </div>
    </div>
  );
}

function Stat({
  value,
  label
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>
        {value}
      </div>

      <div style={styles.statLabel}>
        {label}
      </div>
    </div>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f7f8fa",
    color: "#172033",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    fontSize: "13px"
  },

  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 18px",
    background: "#ffffff",
    borderBottom:
      "1px solid #e5e7eb"
  },

  brand: {
    fontSize: "18px",
    fontWeight: 800,
    letterSpacing: "-0.3px"
  },

  headerSubtitle: {
    marginTop: "2px",
    fontSize: "11px",
    color: "#6b7280"
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "10px"
  },

  headerProgress: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#475569"
  },

  headerButton: {
    border: 0,
    borderRadius: "7px",
    background: "#111827",
    color: "#ffffff",
    padding: "8px 11px",
    fontWeight: 700,
    cursor: "pointer"
  },

  disabledButton: {
    border: 0,
    borderRadius: "7px",
    background: "#d1d5db",
    color: "#ffffff",
    padding: "8px 11px",
    fontWeight: 700,
    cursor: "not-allowed"
  },

  jobSummary: {
    padding: "16px 18px",
    background: "#ffffff",
    borderBottom:
      "1px solid #e5e7eb"
  },

  jobSummaryTitle: {
    fontSize: "17px",
    fontWeight: 750
  },

  jobSummaryMeta: {
    marginTop: "4px",
    color: "#64748b"
  },

  jobStats: {
    display: "flex",
    gap: "20px",
    marginTop: "12px"
  },

  stat: {
    display: "flex",
    gap: "5px",
    alignItems: "baseline"
  },

  statValue: {
    fontWeight: 800
  },

  statLabel: {
    color: "#64748b",
    fontSize: "11px"
  },

  progressRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    padding: "13px 18px",
    background: "#ffffff",
    borderBottom:
      "1px solid #e5e7eb"
  },

  progressSubtext: {
    color: "#64748b",
    fontSize: "11px",
    marginTop: "3px"
  },

  progressTrack: {
    width: "130px",
    height: "5px",
    background: "#e5e7eb",
    borderRadius: "999px",
    overflow: "hidden"
  },

  progressFill: {
    height: "100%",
    background: "#111827",
    borderRadius: "999px"
  },

  workspace: {
    display: "grid",
    gridTemplateColumns:
      "42% 58%",
    minHeight: "calc(100vh - 170px)"
  },

  requirementNav: {
    background: "#f1f3f6",
    borderRight:
      "1px solid #e1e5ea",
    overflowY: "auto"
  },

  requirementGroup: {
    borderBottom:
      "1px solid #e1e5ea"
  },

  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    padding: "11px 12px 8px",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "#475569"
  },

  groupProgress: {
    color: "#94a3b8"
  },

  requirementItem: {
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    textAlign: "left",
    border: 0,
    borderTop:
      "1px solid rgba(0,0,0,0.025)",
    background: "transparent",
    padding: "10px 11px",
    cursor: "pointer",
    color: "#334155"
  },

  requirementItemSelected: {
    background: "#ffffff",
    boxShadow:
      "inset 3px 0 0 #111827"
  },

  requirementItemText: {
    lineHeight: 1.4,
    fontSize: "12px"
  },

  checkCircle: {
    flex: "0 0 17px",
    width: "17px",
    height: "17px",
    borderRadius: "50%",
    background: "#111827",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: 800
  },

  emptyCircle: {
    flex: "0 0 17px",
    width: "17px",
    height: "17px",
    borderRadius: "50%",
    border:
      "1px solid #cbd5e1"
  },

  reviewPane: {
    background: "#ffffff",
    padding: "22px",
    overflowY: "auto"
  },

  reviewHeader: {
    marginBottom: "14px"
  },

  eyebrow: {
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "1px",
    color: "#64748b",
    marginBottom: "7px"
  },

  requirementTitle: {
    margin: 0,
    fontSize: "20px",
    lineHeight: 1.3,
    letterSpacing: "-0.3px"
  },

  requirementMeta: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginTop: "9px",
    color: "#64748b",
    fontSize: "11px"
  },

  priorityBadge: {
    background: "#f1f5f9",
    borderRadius: "999px",
    padding: "3px 7px",
    fontWeight: 700
  },

  jobPageHint: {
    padding: "9px 11px",
    background: "#f8fafc",
    border:
      "1px solid #e2e8f0",
    borderRadius: "7px",
    color: "#64748b",
    fontSize: "11px",
    marginBottom: "20px"
  },

  sectionHeading: {
    fontSize: "13px",
    fontWeight: 800,
    marginBottom: "4px"
  },

  sectionDescription: {
    color: "#64748b",
    fontSize: "11px",
    marginBottom: "11px"
  },

  evidenceCard: {
    border:
      "1px solid #e2e8f0",
    borderRadius: "9px",
    padding: "12px",
    marginBottom: "9px",
    background: "#ffffff"
  },

  evidenceCardAccepted: {
    border:
      "1px solid #a7f3d0",
    background: "#f0fdf4"
  },

  evidenceCardRejected: {
    border:
      "1px solid #fecaca",
    background: "#fffafa"
  },

  evidenceTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px"
  },

  evidenceSection: {
    fontSize: "10px",
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: "6px"
  },

  evidenceText: {
    lineHeight: 1.5,
    color: "#1e293b"
  },

  pendingBadge: {
    color: "#64748b",
    fontSize: "10px",
    fontWeight: 700
  },

  acceptedBadge: {
    color: "#047857",
    fontSize: "10px",
    fontWeight: 800
  },

  rejectedBadge: {
    color: "#b91c1c",
    fontSize: "10px",
    fontWeight: 800
  },

  evidenceMetadata: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    marginTop: "9px"
  },

  tag: {
    padding: "3px 6px",
    background: "#eef2ff",
    borderRadius: "4px",
    color: "#475569",
    fontSize: "10px"
  },

  evidenceActions: {
    display: "flex",
    gap: "6px",
    marginTop: "11px"
  },

  acceptButton: {
    border: 0,
    borderRadius: "5px",
    background: "#111827",
    color: "#ffffff",
    padding: "6px 9px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer"
  },

  rejectButton: {
    border:
      "1px solid #fecaca",
    borderRadius: "5px",
    background: "#ffffff",
    color: "#b91c1c",
    padding: "6px 9px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer"
  },

  editButton: {
    border:
      "1px solid #cbd5e1",
    borderRadius: "5px",
    background: "#ffffff",
    color: "#334155",
    padding: "6px 9px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer"
  },

  reasonSection: {
    marginTop: "22px",
    borderTop:
      "1px solid #e5e7eb",
    paddingTop: "18px"
  },

  analysisExplanation: {
    padding: "11px",
    background: "#f8fafc",
    borderRadius: "7px",
    color: "#334155",
    lineHeight: 1.5
  },

  analysisNote: {
    marginTop: "7px",
    color: "#94a3b8",
    fontSize: "10px"
  },

  noEvidence: {
    padding: "16px",
    border:
      "1px dashed #cbd5e1",
    borderRadius: "8px",
    color: "#64748b",
    textAlign: "center"
  },

  requirementFooter: {
    marginTop: "22px",
    paddingTop: "15px",
    borderTop:
      "1px solid #e5e7eb"
  },

  bottomBar: {
    position: "sticky",
    bottom: 0,
    zIndex: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    padding: "10px 18px",
    background: "#ffffff",
    borderTop:
      "1px solid #e5e7eb"
  },

  finalReviewButton: {
    border: 0,
    background: "#111827",
    color: "#ffffff",
    borderRadius: "7px",
    padding: "8px 13px",
    fontWeight: 750,
    cursor: "pointer"
  },

  primaryButton: {
    border: 0,
    borderRadius: "7px",
    background: "#111827",
    color: "#ffffff",
    padding: "9px 13px",
    fontWeight: 750,
    cursor: "pointer"
  },

  secondaryButton: {
    border:
      "1px solid #cbd5e1",
    borderRadius: "7px",
    background: "#ffffff",
    color: "#334155",
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer"
  },

  setupCard: {
    margin: "18px",
    padding: "18px",
    background: "#ffffff",
    border:
      "1px solid #e2e8f0",
    borderRadius: "10px"
  },

  setupTitle: {
    fontWeight: 800,
    fontSize: "15px",
    marginBottom: "6px"
  },

  muted: {
    color: "#64748b",
    lineHeight: 1.5
  },

  error: {
    margin: "10px 14px",
    padding: "9px 11px",
    borderRadius: "7px",
    background: "#fef2f2",
    border:
      "1px solid #fecaca",
    color: "#b91c1c",
    fontSize: "11px"
  },

  message: {
    margin: "10px 14px",
    padding: "9px 11px",
    borderRadius: "7px",
    background: "#f0fdf4",
    border:
      "1px solid #bbf7d0",
    color: "#166534",
    fontSize: "11px"
  },

  loading: {
    padding: "40px 20px",
    textAlign: "center"
  },

  emptyState: {
    margin: "40px auto",
    maxWidth: "430px",
    padding: "20px",
    textAlign: "center"
  },

  emptyIcon: {
    margin: "0 auto 15px",
    width: "50px",
    height: "50px",
    borderRadius: "12px",
    background: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: 800,
    color: "#475569"
  },

  emptyTitle: {
    margin: "0 0 8px",
    fontSize: "18px"
  },

  progressNote: {
    color: "#64748b"
  },

  finalPage: {
    padding: "24px 20px 40px",
    maxWidth: "800px",
    margin: "0 auto"
  },

  backButton: {
    border: 0,
    background: "transparent",
    padding: 0,
    color: "#475569",
    cursor: "pointer",
    fontWeight: 700,
    marginBottom: "25px"
  },

  finalTitle: {
    margin: 0,
    fontSize: "24px"
  },

  finalCompany: {
    marginTop: "4px",
    color: "#64748b"
  },

  finalGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, 1fr)",
    gap: "9px",
    marginTop: "22px"
  },

  summaryCard: {
    background: "#f8fafc",
    border:
      "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "12px"
  },

  summaryValue: {
    fontSize: "20px",
    fontWeight: 800
  },

  summaryLabel: {
    marginTop: "3px",
    color: "#64748b",
    fontSize: "10px"
  },

  finalSection: {
    marginTop: "24px"
  },

  noChanges: {
    padding: "15px",
    background: "#f8fafc",
    borderRadius: "8px",
    color: "#475569",
    lineHeight: 1.5
  },

  finalChange: {
    padding: "12px",
    border:
      "1px solid #e2e8f0",
    borderRadius: "8px",
    marginTop: "8px"
  },

  finalChangeType: {
    fontSize: "10px",
    fontWeight: 800,
    color: "#64748b",
    marginBottom: "5px"
  },

  finalActions: {
    marginTop: "25px"
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    background:
      "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px"
  },

  modal: {
    width: "100%",
    maxWidth: "430px",
    background: "#ffffff",
    borderRadius: "11px",
    padding: "20px",
    boxShadow:
      "0 20px 60px rgba(0,0,0,0.25)"
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },

  modalTitle: {
    margin: 0,
    fontSize: "19px"
  },

  closeButton: {
    border: 0,
    background: "transparent",
    fontSize: "24px",
    color: "#64748b",
    cursor: "pointer"
  },

  modalLabel: {
    fontSize: "11px",
    fontWeight: 800,
    marginTop: "22px",
    marginBottom: "8px"
  },

  formatOption: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "9px 0",
    cursor: "pointer"
  },

  modalHint: {
    marginTop: "12px",
    padding: "9px",
    borderRadius: "6px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "10px",
    lineHeight: 1.5
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "20px"
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: "18px",
    border:
      "1px solid #cbd5e1",
    borderRadius: "7px",
    padding: "10px",
    fontFamily: "inherit",
    fontSize: "13px",
    resize: "vertical",
    outline: "none"
  }
};

const rootElement =
  document.getElementById(
    "root"
  );

if (!rootElement) {
  throw new Error(
    "CareerLens side panel root element was not found."
  );
}

createRoot(
  rootElement
).render(
  <SidePanel />
);
