import * as pdfjsLib from "pdfjs-dist";

import type {
  ResumeImportResult,
  ResumeImporter
} from "./ResumeImporter";

export class PdfResumeImporter implements ResumeImporter {
  canImport(file: File): boolean {
    return (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    );
  }

  async import(
    file: File
  ): Promise<ResumeImportResult> {
    const buffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer)
    }).promise;

    const pages: string[] = [];

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      const text = content.items
        .map((item) =>
          "str" in item ? item.str : ""
        )
        .join(" ");

      pages.push(text);
    }

    return {
      text: pages.join("\n\n").trim(),
      filename: file.name,
      type: "pdf"
    };
  }
}
