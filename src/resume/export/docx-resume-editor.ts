import JSZip from "jszip";

export interface DocxTextReplacement {
  original: string;
  replacement: string;
}

/**
 * Applies text replacements directly to a copy of the original DOCX.
 *
 * The important design property is that we modify the existing OOXML
 * instead of reconstructing the document. Existing runs, styles,
 * paragraphs, tables, margins, headers, footers, numbering, etc. remain
 * untouched unless their text is explicitly replaced.
 */
export async function applyDocxTextReplacements(
  originalFile: Blob,
  replacements: DocxTextReplacement[]
): Promise<Blob> {
  if (replacements.length === 0) {
    return originalFile;
  }

  const arrayBuffer = await originalFile.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const documentXml = zip.file("word/document.xml");

  if (!documentXml) {
    throw new Error(
      "The DOCX file does not contain word/document.xml."
    );
  }

  let xml = await documentXml.async("string");

  for (const replacement of replacements) {
    if (!replacement.original.trim()) {
      continue;
    }

    xml = replaceTextPreservingRuns(
      xml,
      replacement.original,
      replacement.replacement
    );
  }

  zip.file("word/document.xml", xml);

  /*
   * Also process headers and footers so future supported edits can
   * target those parts without changing the document architecture.
   */
  for (const name of Object.keys(zip.files)) {
    if (
      /^word\/(header|footer)\d+\.xml$/.test(name)
    ) {
      let part = await zip
        .file(name)!
        .async("string");

      for (const replacement of replacements) {
        if (!replacement.original.trim()) {
          continue;
        }

        part = replaceTextPreservingRuns(
          part,
          replacement.original,
          replacement.replacement
        );
      }

      zip.file(name, part);
    }
  }

  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

/**
 * DOCX text is commonly split across multiple w:t elements:
 *
 *   <w:r><w:t>Technical</w:t></w:r>
 *   <w:r><w:t> Specialist</w:t></w:r>
 *
 * Therefore a plain XML string replacement is insufficient.
 *
 * We locate the visible text represented by w:t nodes and replace the
 * characters inside the existing run structure. This deliberately keeps
 * the surrounding w:r / w:rPr / w:p structure intact.
 */
function replaceTextPreservingRuns(
  xml: string,
  original: string,
  replacement: string
): string {
  const textNodePattern =
    /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;

  const nodes: {
    start: number;
    end: number;
    text: string;
    decodedText: string;
  }[] = [];

  let match: RegExpExecArray | null;

  while (
    (match = textNodePattern.exec(xml)) !== null
  ) {
    nodes.push({
      start: match.index,
      end:
        match.index + match[0].length,
      text: match[0],
      decodedText: decodeXml(match[1])
    });
  }

  if (nodes.length === 0) {
    return xml;
  }

  const fullText = nodes
    .map(node => node.decodedText)
    .join("");

  const startIndex = fullText.indexOf(original);

  if (startIndex < 0) {
    return xml;
  }

  const endIndex =
    startIndex + original.length;

  let accumulated = 0;
  let firstNode = -1;
  let lastNode = -1;
  let firstOffset = 0;
  let lastOffset = 0;

  for (let i = 0; i < nodes.length; i += 1) {
    const nodeStart = accumulated;
    const nodeEnd =
      accumulated + nodes[i].decodedText.length;

    if (
      firstNode === -1 &&
      startIndex >= nodeStart &&
      startIndex <= nodeEnd
    ) {
      firstNode = i;
      firstOffset =
        startIndex - nodeStart;
    }

    if (
      endIndex >= nodeStart &&
      endIndex <= nodeEnd
    ) {
      lastNode = i;
      lastOffset =
        endIndex - nodeStart;
      break;
    }

    accumulated = nodeEnd;
  }

  if (
    firstNode === -1 ||
    lastNode === -1
  ) {
    return xml;
  }

  /*
   * If the replacement is contained in one run, this is the ideal case:
   * simply replace that run's visible text.
   */
  if (firstNode === lastNode) {
    const node = nodes[firstNode];

    const newText =
      node.decodedText.slice(
        0,
        firstOffset
      ) +
      replacement +
      node.decodedText.slice(lastOffset);

    return replaceNodeText(
      xml,
      node,
      newText
    );
  }

  /*
   * Multi-run replacement:
   *
   * Keep the formatting of the first run, put the replacement there,
   * remove only the consumed text from subsequent runs.
   *
   * This preserves the existing paragraph/run properties rather than
   * recreating the paragraph.
   */
  let result = xml;

  const affected = nodes.slice(
    firstNode,
    lastNode + 1
  );

  for (
    let i = affected.length - 1;
    i >= 0;
    i -= 1
  ) {
    const node = affected[i];

    let newText = node.decodedText;

    if (i === 0) {
      newText =
        node.decodedText.slice(
          0,
          firstOffset
        ) + replacement;
    } else if (
      i === affected.length - 1
    ) {
      newText =
        node.decodedText.slice(
          lastOffset
        );
    } else {
      newText = "";
    }

    result = replaceNodeText(
      result,
      node,
      newText
    );
  }

  return result;
}

function replaceNodeText(
  xml: string,
  node: {
    start: number;
    end: number;
    text: string;
  },
  value: string
): string {
  const replacementNode =
    node.text.replace(
      />([\s\S]*?)<\/w:t>/,
      `>${encodeXml(value)}</w:t>`
    );

  return (
    xml.slice(0, node.start) +
    replacementNode +
    xml.slice(node.end)
  );
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
