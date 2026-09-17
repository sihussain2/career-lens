# CareerLens

CareerLens is a Chrome extension that helps you tailor your resume to LinkedIn job postings. It extracts job requirements and matches them against your resume, showing which requirements you can evidence and where your resume needs improvement.

---

## What It Does Today

✅ **Job Requirement Extraction**
- Automatically extracts and structures requirements from LinkedIn job postings
- Classifies requirements into categories (skills, responsibilities, qualifications, experience, education)
- Intelligently deduplicates similar or overlapping requirements
- Preserves exact source text for highlighting on the job page

✅ **Resume Evidence Matching**
- Matches job requirements against your resume using concept-based, deterministic logic
- Ranks resume sections by relevance to each requirement
- Shows confidence levels for each match (strong support, partial support, no support)
- Groups similar requirements by category (people leadership, technical leadership, execution, technology, domain experience)

✅ **Review & Refinement Workflow**
- Review each requirement requirement-by-requirement with a master/detail interface
- Accept, reject, or edit proposed evidence matches
- Highlights the original requirement text on the LinkedIn job page
- Maintains a clean separation between your master resume and job-specific tailoring

✅ **Resume Generation**
- Generate a tailored DOCX resume with accepted evidence suggestions applied
- **Preserves original formatting**: Existing styles, fonts, spacing, tables, headers, footers, and numbering remain intact — only the text you choose to modify is changed
- Export to PDF for quick review
- Keep your master resume unchanged; all work is stored locally in the browser

✅ **Data Privacy**
- All extraction, matching, and analysis happens locally in your browser
- No job postings or resume content is sent to external servers
- No AI/LLM calls during extraction or local matching
- Browser storage keeps your master resume and reviews private

---

## AI / Semantic Intelligence — In Development

The current system uses **deterministic, keyword-based logic** for extraction and matching. This works well for structured requirements and obvious matches, but it has limitations.

The next major development phase is the **AI/semantic layer**, which will combine the existing deterministic engineering logic with AI reasoning to understand job requirements and resume evidence at a deeper level.

### Planned AI/Semantic Capabilities

> ⚠️ **These are planned features, not yet implemented in the UI.**

- **Semantic requirement understanding**: Move beyond keyword matching to understand the actual intent and context of each requirement
- **Indirect/deeper evidence relationships**: Find resume evidence that indirectly demonstrates a requirement (e.g., "led a refactoring effort" demonstrates "system architecture" even without the exact keywords)
- **Better requirement isolation**: Distinguish between actual job requirements and incidental context (e.g., company culture descriptions, technology stack context)
- **Intelligent requirement atomicity**: Break compound requirements into meaningful atomic units without over-fragmenting
- **Semantic normalization & deduplication**: Recognize that "backend engineering", "server-side development", and "REST API design" are related even if not identical
- **Evidence-grounded suggestions**: Propose concrete, specific improvements to your resume based on how it compares to similar candidates
- **AI-assisted evidence refinement**: Rewrite resume bullets to better highlight relevant experience without losing authenticity
- **Intelligent resume review**: Evaluate your tailored resume against the job requirements to flag gaps and opportunities

The AI layer is designed to enhance, not replace, your judgment. You remain in control—all AI suggestions are reviewed and you decide what to accept.

---

## Quick Install (Beta)

CareerLens is currently distributed as a developer extension. Installation takes about 2 minutes:

1. **Download** the latest CareerLens ZIP from [GitHub Releases](https://github.com/sihussain2/career-lens/releases)
2. **Extract** the ZIP to a folder on your computer
3. Open **`chrome://extensions`** in your browser
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **"Load unpacked"**
6. Select the extracted CareerLens folder
7. Navigate to any LinkedIn job posting and click the **CareerLens** button in your browser toolbar

You should see the CareerLens panel open on the right side of the page. Click **"Import Resume"** to get started.

**Note:** This is beta software under active development. The UI, workflow, and data format may change.

---

## Build from Source

If you want to build and modify CareerLens locally:

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Build the extension
npm run build

# Package for distribution (creates release/CareerLens-v<version>.zip)
npm run package
```

The packaged extension is created under `release/` and can be loaded via Chrome's "Load unpacked" workflow.

---

## Architecture

CareerLens is built with:
- **React + TypeScript** for the UI (sidepanel)
- **Chrome Extension APIs** for LinkedIn integration
- **Vite** for bundling
- **Local deterministic matching** for requirement/evidence pairing (current)
- **Modular extraction pipeline** for job requirement parsing

### Key Components

- **Extraction**: LinkedIn DOM parsing with section classification and deduplication
- **Analysis**: Local concept-based matching between requirements and resume
- **UI**: Master/detail review interface for accepting/rejecting evidence
- **Export**: DOCX and PDF generation with formatting preservation

---

## Status

🚀 **Active Development**

CareerLens is under active development. Current focus:
- Stabilizing the extraction and local matching pipelines
- Improving the review workflow based on user feedback
- **Next phase:** Integrating the AI/semantic layer for deeper requirement understanding

**Known Limitations:**
- Requires Chrome browser
- Only works on LinkedIn job postings
- Matching is concept-based, not semantic (AI layer coming)
- No mobile/tablet support

---

## Contributing

To contribute to CareerLens, see the repository at [https://github.com/sihussain2/career-lens](https://github.com/sihussain2/career-lens).

---

## License

ISC

---

**Questions or Feedback?**  
Open an issue on GitHub or check the repository for the latest updates.
