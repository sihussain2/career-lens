import crypto from "node:crypto";

const GITHUB_AUTHORIZE_URL =
  "https://github.com/login/oauth/authorize";

const GITHUB_TOKEN_URL =
  "https://github.com/login/oauth/access_token";

const GITHUB_USER_URL =
  "https://api.github.com/user";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function createOAuthState(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function buildGitHubAuthorizationUrl(
  state: string
): string {
  const clientId =
    requiredEnv("GITHUB_CLIENT_ID");

  const redirectUri =
    requiredEnv("GITHUB_CALLBACK_URL");

  const url =
    new URL(GITHUB_AUTHORIZE_URL);

  url.searchParams.set(
    "client_id",
    clientId
  );

  url.searchParams.set(
    "redirect_uri",
    redirectUri
  );

  url.searchParams.set(
    "scope",
    "read:user"
  );

  url.searchParams.set(
    "state",
    state
  );

  return url.toString();
}

export async function exchangeCodeForToken(
  code: string
): Promise<string> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: requiredEnv("GITHUB_CLIENT_ID"),
      client_secret: requiredEnv("GITHUB_CLIENT_SECRET"),
      code,
      redirect_uri: requiredEnv("GITHUB_CALLBACK_URL"),
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        "GitHub OAuth token exchange failed."
    );
  }

  return data.access_token;
}

export interface GitHubUser {
  id: number;
  login: string;
}

export async function getGitHubUser(
  accessToken: string
): Promise<GitHubUser> {
  const response = await fetch(GITHUB_USER_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "CareerLens",
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub user lookup failed: HTTP ${response.status}`
    );
  }

  const data = (await response.json()) as GitHubUser;

  if (!data.id || !data.login) {
    throw new Error("GitHub returned an invalid user.");
  }

  return data;
}
