const SESSION_KEY = "careerLensSession";

const GATEWAY_BASE_URL =
  "http://127.0.0.1:8787";

export async function getCareerLensSession(): Promise<string | null> {
  const result =
    await chrome.storage.local.get(SESSION_KEY);

  const session =
    result[SESSION_KEY];

  if (
    typeof session !== "string" ||
    session.length === 0
  ) {
    return null;
  }

  return session;
}

export async function clearCareerLensSession(): Promise<void> {
  await chrome.storage.local.remove(
    SESSION_KEY
  );
}

/**
 * Starts GitHub OAuth using Chrome's identity API.
 *
 * Chrome owns the OAuth browser flow and returns the
 * final redirect URL to the extension. This avoids:
 *
 *   - window.opener
 *   - web -> chrome-extension:// redirects
 *   - manually copying session tokens
 */
export async function connectCareerLens(): Promise<void> {
  const extensionId =
    chrome.runtime.id;

  if (!extensionId) {
    throw new Error(
      "CareerLens could not determine the extension ID."
    );
  }

  const startUrl =
    `${GATEWAY_BASE_URL}/auth/github/${extensionId}`;

  const callbackUrl =
    chrome.identity.getRedirectURL();

  console.log(
    "CareerLens OAuth extension ID:",
    extensionId
  );

  console.log(
    "CareerLens OAuth start URL:",
    startUrl
  );

  console.log(
    "CareerLens OAuth callback URL:",
    callbackUrl
  );

  const url =
    new URL(startUrl);

  const finalUrl =
    await chrome.identity.launchWebAuthFlow({
      url: url.toString(),
      interactive: true
    });

  if (!finalUrl) {
    throw new Error(
      "GitHub OAuth did not return a callback URL."
    );
  }

  const callback =
    new URL(finalUrl);

  const session =
    callback.searchParams.get("session");

  const error =
    callback.searchParams.get("error");

  if (error) {
    throw new Error(
      `GitHub authorization failed: ${error}`
    );
  }

  if (
    !session ||
    session.length === 0
  ) {
    throw new Error(
      "GitHub OAuth completed but no CareerLens session was returned."
    );
  }

  await chrome.storage.local.set({
    [SESSION_KEY]: session
  });
}

export function getCareerLensLoginUrl(): string {
  return `${GATEWAY_BASE_URL}/auth/github`;
}
