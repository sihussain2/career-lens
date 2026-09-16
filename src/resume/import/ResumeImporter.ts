export interface ResumeImportResult {
  text: string;
  filename: string;
  type: "pdf" | "docx";
}

export interface ResumeImporter {
  canImport(file: File): boolean;
  import(file: File): Promise<ResumeImportResult>;
}
