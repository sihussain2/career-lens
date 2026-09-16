import { LinkedInJobExtractor } from "../../job/extraction/linkedin-extractor";

type ExtensionMessage =
  | {
      type: "GET_PAGE_INFO";
    }
  | {
      type: "EXTRACT_JOB";
    }
  | {
      type: "HIGHLIGHT_REQUIREMENT";
      text: string;
    }
  | {
      type: "CLEAR_REQUIREMENT_HIGHLIGHT";
    };

const HIGHLIGHT_ATTRIBUTE = "data-careerlens-highlight";

console.log(
  "CareerLens content script loaded."
);

const extractor = new LinkedInJobExtractor();

function normalizeText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function clearRequirementHighlight(): void {
  const highlights = document.querySelectorAll(
    `[${HIGHLIGHT_ATTRIBUTE}]`
  );

  highlights.forEach(element => {
    const parent = element.parentNode;

    if (!parent) {
      return;
    }

    while (element.firstChild) {
      parent.insertBefore(
        element.firstChild,
        element
      );
    }

    parent.removeChild(element);
    parent.normalize();
  });
}

function highlightRequirement(
  requirementText: string
): boolean {
  clearRequirementHighlight();

  const target = normalizeText(requirementText);

  if (!target) {
    return false;
  }

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );

  let node: Node | null;

  while ((node = walker.nextNode())) {
    const text = node.textContent ?? "";
    const normalized = normalizeText(text);

    if (!normalized) {
      continue;
    }

    const index = normalized.indexOf(target);

    if (index === -1) {
      continue;
    }

    /*
     * For LinkedIn requirements the text is normally contained
     * in a single text node. Map the normalized match back to
     * the original text using a whitespace-tolerant search.
     */
    const originalIndex = text
      .toLowerCase()
      .indexOf(
        requirementText
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase()
      );

    if (originalIndex === -1) {
      continue;
    }

    const range = document.createRange();

    range.setStart(
      node,
      originalIndex
    );

    range.setEnd(
      node,
      originalIndex + requirementText.trim().length
    );

    const mark = document.createElement("mark");

    mark.setAttribute(
      HIGHLIGHT_ATTRIBUTE,
      "true"
    );

    mark.style.background = "#fff3a3";
    mark.style.outline = "3px solid #f59e0b";
    mark.style.borderRadius = "4px";
    mark.style.padding = "1px 2px";
    mark.style.boxShadow =
      "0 2px 10px rgba(245, 158, 11, 0.25)";

    try {
      range.surroundContents(mark);
    } catch {
      /*
       * LinkedIn occasionally splits text across nested elements.
       * In that case, use the browser selection as a fallback.
       */
      try {
        const selection = window.getSelection();

        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch {
        return false;
      }
    }

    mark.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    return true;
  }

  /*
   * Fallback: find a reasonably distinctive phrase from the
   * requirement instead of requiring an exact DOM text node.
   */
  const words = target
    .split(" ")
    .filter(word => word.length >= 5)
    .slice(0, 8);

  if (words.length === 0) {
    return false;
  }

  const fallbackTarget = words.join(" ");

  const allElements =
    document.querySelectorAll(
      "li, p, div"
    );

  for (const element of allElements) {
    const text = normalizeText(
      element.textContent ?? ""
    );

    if (!text.includes(fallbackTarget)) {
      continue;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    element.setAttribute(
      HIGHLIGHT_ATTRIBUTE,
      "true"
    );

    (element as HTMLElement).style.background =
      "#fff3a3";

    (element as HTMLElement).style.outline =
      "3px solid #f59e0b";

    (element as HTMLElement).style.borderRadius =
      "4px";

    return true;
  }

  return false;
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    try {
      if (message.type === "GET_PAGE_INFO") {
        sendResponse({
          success: true,
          url: window.location.href,
          title: document.title
        });

        return true;
      }

      if (message.type === "EXTRACT_JOB") {
        if (!extractor.canExtract()) {
          sendResponse({
            success: false,
            error:
              "Current page is not a supported LinkedIn job page."
          });

          return true;
        }

        const job = extractor.extract();

        sendResponse({
          success: true,
          job
        });

        return true;
      }

      if (
        message.type ===
        "HIGHLIGHT_REQUIREMENT"
      ) {
        const found =
          highlightRequirement(
            message.text
          );

        sendResponse({
          success: true,
          found
        });

        return true;
      }

      if (
        message.type ===
        "CLEAR_REQUIREMENT_HIGHLIGHT"
      ) {
        clearRequirementHighlight();

        sendResponse({
          success: true
        });

        return true;
      }

      sendResponse({
        success: false,
        error: "Unknown message type."
      });

      return true;
    } catch (error) {
      sendResponse({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown CareerLens content-script error."
      });

      return true;
    }
  }
);
