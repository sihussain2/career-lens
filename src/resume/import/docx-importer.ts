import mammoth from "mammoth";

import type {
  ResumeImportResult,
  ResumeImporter
} from "./ResumeImporter";

export class DocxResumeImporter implements ResumeImporter {
  canImport(file: File): boolean {
    return (
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    );
  }

  async import(
    file: File
  ): Promise<ResumeImportResult> {
    const buffer = await file.arrayBuffer();

    const result = await mammoth.extractRawText({
      arrayBuffer: buffer
    });

    return {
      text: result.value.trim(),
      filename: file.name,
      type: "docx"
    };
  }
}
