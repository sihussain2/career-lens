chrome.runtime.onInstalled.addListener(() => {
  console.log("Resume & Job Intelligence installed.");
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  await chrome.sidePanel.open({
    tabId: tab.id
  });
});

chrome.runtime.onMessage.addListener(
  async (message, _sender, sendResponse) => {
    if (message?.type !== "INJECT_CONTENT_SCRIPT") {
      return;
    }

    try {
      const tabId = message.tabId;

      if (!tabId) {
        sendResponse({
          success: false,
          error: "No tab ID provided."
        });
        return;
      }

      await chrome.scripting.executeScript({
        target: {
          tabId
        },
        files: ["content.js"]
      });

      sendResponse({
        success: true
      });
    } catch (error) {
      sendResponse({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to inject content script."
      });
    }

    return true;
  }
);
