import { LinkedInJobExtractor } from "../../job/extraction/linkedin-extractor";

type ExtensionMessage =
  | {
      type: "GET_PAGE_INFO";
    }
  | {
      type: "EXTRACT_JOB";
    };

console.log(
  "Resume & Job Intelligence content script loaded."
);

const extractor = new LinkedInJobExtractor();

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
            : "Unknown extraction error."
      });

      return true;
    }
  }
);
