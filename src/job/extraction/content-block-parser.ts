import type {
  JobSectionBlock,
} from "../model/JobSection";

/**
 * Parse content blocks (bullets and paragraphs) from raw lines.
 *
 * Handles:
 * - Various bullet characters (•, ◦, -, *, etc.)
 * - Multiline/wrapped bullets
 * - Paragraphs
 * - Mixed content
 *
 * Returns structured blocks that preserve source information.
 */

const BULLET_CHARS = /^[•●▪◦‣⁃\-*]\s+/;
const NUMBERED_BULLET_CHARS = /^\d+\.\s+/;

export interface ParseBlocksOptions {
  /**
   * If true, treat numbered lists (1., 2., etc) as bullets.
   */
  treatNumberedAsBullets?: boolean;

  /**
   * Maximum number of characters before wrapping is expected.
   * Used to detect continuation lines.
   */
  wrapThreshold?: number;
}

function isBulletLine(text: string, treatNumbered = true): boolean {
  if (BULLET_CHARS.test(text)) {
    return true;
  }

  if (treatNumbered && NUMBERED_BULLET_CHARS.test(text)) {
    return true;
  }

  return false;
}

function stripBulletMarker(text: string): string {
  let result = text.replace(BULLET_CHARS, "");

  if (NUMBERED_BULLET_CHARS.test(text)) {
    result = text.replace(NUMBERED_BULLET_CHARS, "");
  }

  return result.trim();
}

function extractBulletMarker(text: string): string | undefined {
  const match = text.match(/^[•●▪◦‣⁃\-*]|\d+\./);

  if (match) {
    return match[0];
  }

  return undefined;
}

export function parseContentBlocks(
  lines: Array<{
    text: string;
    index: number;
    sourceElement?: Element;
  }>,
  options: ParseBlocksOptions = {}
): JobSectionBlock[] {
  const { treatNumberedAsBullets = true, wrapThreshold = 400 } = options;

  const blocks: JobSectionBlock[] = [];
  let currentBlock: Partial<JobSectionBlock> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();

    if (!text) {
      // Empty line - flush current block
      if (currentBlock) {
        blocks.push(finalizeBlock(currentBlock));
        currentBlock = null;
      }

      continue;
    }

    const isBullet = isBulletLine(text, treatNumberedAsBullets);

    if (isBullet && !currentBlock) {
      // Start new bullet block
      const marker = extractBulletMarker(text);
      const content = stripBulletMarker(text);

      currentBlock = {
        text: content,
        sourceText: text,
        type: "bullet",
        bulletMarker: marker,
        sourceIndex: line.index,
        sourceElement: line.sourceElement,
        isContinuation: false,
      };
    } else if (isBullet && currentBlock?.type === "bullet") {
      // New bullet - flush current and start new
      blocks.push(finalizeBlock(currentBlock));

      const marker = extractBulletMarker(text);
      const content = stripBulletMarker(text);

      currentBlock = {
        text: content,
        sourceText: text,
        type: "bullet",
        bulletMarker: marker,
        sourceIndex: line.index,
        sourceElement: line.sourceElement,
        isContinuation: false,
      };
    } else if (!isBullet && currentBlock?.type === "bullet") {
      // Possible continuation of bullet
      // If line is short and non-empty, likely a continuation
      if (text.length < wrapThreshold / 2) {
        // Append to current bullet
        currentBlock.text = `${currentBlock.text} ${text}`;
        currentBlock.isContinuation = true;
      } else {
        // New paragraph block
        blocks.push(finalizeBlock(currentBlock));

        currentBlock = {
          text,
          sourceText: line.text,
          type: "paragraph",
          sourceIndex: line.index,
          sourceElement: line.sourceElement,
        };
      }
    } else if (!currentBlock) {
      // Start new paragraph block
      currentBlock = {
        text,
        sourceText: line.text,
        type: "paragraph",
        sourceIndex: line.index,
        sourceElement: line.sourceElement,
      };
    } else {
      // Append to current paragraph
      if (currentBlock.type === "paragraph") {
        currentBlock.text = `${currentBlock.text} ${text}`;
      }
    }
  }

  // Flush final block
  if (currentBlock) {
    blocks.push(finalizeBlock(currentBlock));
  }

  return blocks;
}

function finalizeBlock(
  partial: Partial<JobSectionBlock>
): JobSectionBlock {
  return {
    text: partial.text || "",
    sourceText: partial.sourceText || "",
    type: partial.type || "paragraph",
    bulletMarker: partial.bulletMarker,
    sourceIndex: partial.sourceIndex || 0,
    sourceElement: partial.sourceElement,
    isContinuation: partial.isContinuation || false,
  };
}
