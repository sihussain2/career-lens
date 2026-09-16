import express from "express";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { CopilotClient } from "@github/copilot-sdk";

dotenv.config({ path: "gateway/.env" });

import {
  buildGitHubAuthorizationUrl,
  createOAuthState,
  exchangeCodeForToken,
  getGitHubUser,
} from "./auth/github-oauth";

import {
  createSession,
  deleteSession,
  getSession,
} from "./auth/session-store";

const app = express();

const PORT = Number(
  process.env.PORT ?? 8787
);

const MODEL =
  process.env.COPILOT_MODEL ?? "gpt-5.4";

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use((req, res, next) => {
  const allowedOrigin =
    process.env.CAREERLENS_ALLOWED_ORIGIN ?? "*";

  res.header(
    "Access-Control-Allow-Origin",
    allowedOrigin
  );

  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

const SYSTEM_PROMPT = `
You are the semantic reasoning engine for CareerLens.

Your job is to analyze whether supplied resume evidence
actually supports specific job requirements.

GROUNDING RULES:
1. Use ONLY supplied resume evidence.
2. Never invent skills, technologies, employers,
   responsibilities, qualifications, achievements,
   dates, metrics, or experience.
3. Do not infer a specific technology from generic
   engineering experience.
4. Do not treat a job requirement as candidate evidence.
5. Evidence IDs are authoritative.
6. Every supported conclusion must cite evidence IDs.
7. Confidence measures evidence strength, not hiring
   probability.
8. Be conservative.

RELATIONSHIPS:
strong_support
partial_support
related
contradicts
no_support

SUGGESTIONS:
REWORD
REORDER
ADD
REMOVE
EMPHASIZE
DE_EMPHASIZE
NO_CHANGE

Never create unsupported qualifications in ADD or REWORD.

Return JSON only.
`;

function buildPrompt(request: unknown): string {
  return [
    SYSTEM_PROMPT,
    "",
    "Analyze this structured request:",
    "",
    JSON.stringify(request, null, 2),
    "",
    "Return exactly:",
    "",
    JSON.stringify({
      requirements: [
        {
          requirementId: "existing requirement ID",
          relationship:
            "strong_support | partial_support | related | contradicts | no_support",
          confidence: 0.0,
          explanation: "short factual explanation",
          evidence: [
            {
              evidenceId: "existing evidence ID",
              relationship:
                "strong_support | partial_support | related | contradicts | no_support",
              confidence: 0.0,
              explanation:
                "why this evidence supports or does not support the requirement"
            }
          ]
        }
      ],
      suggestions: [
        {
          type:
            "REWORD | REORDER | ADD | REMOVE | EMPHASIZE | DE_EMPHASIZE | NO_CHANGE",
          sectionId: "existing section ID",
          original:
            "existing resume text when applicable",
          proposed:
            "proposed text when applicable",
          reason: "factual reason",
          evidenceIds: ["existing evidence ID"],
          requirementIds: ["existing requirement ID"],
          confidence: 0.0
        }
      ]
    }, null, 2),
    "",
    "Do not use markdown fences."
  ].join("\\n");
}

const oauthStates =
  new Map<string, string>();

function getAuthenticatedSession(
  req: express.Request
) {
  const value =
    req.header("authorization");

  if (!value?.startsWith("Bearer ")) {
    throw new Error(
      "Missing CareerLens session token."
    );
  }

  const sessionId =
    value.slice("Bearer ".length).trim();

  if (!sessionId) {
    throw new Error(
      "Missing CareerLens session token."
    );
  }

  const session =
    getSession(sessionId);

  if (!session) {
    throw new Error(
      "Invalid or expired CareerLens session."
    );
  }

  return session;
}

/*
 * Start GitHub OAuth.
 */
app.get(
  "/auth/github/:extensionId",
  (req, res) => {
    const state =
      createOAuthState();

    const extensionId =
      typeof req.params.extensionId === "string"
        ? req.params.extensionId
        : undefined;

    if (
      !extensionId ||
      !/^[a-z]{32}$/.test(extensionId)
    ) {
      res
        .status(400)
        .send(
          "Invalid Chrome extension ID."
        );
      return;
    }

    const extensionRedirectUri =
      `https://${extensionId}.chromiumapp.org/`;

    console.log(
      "OAuth start:",
      {
        extensionId,
        extensionRedirectUri
      }
    );

    /*
     * GitHub returns the OAuth state to our callback.
     * Store the extension callback URI against that state
     * so we can recover it after GitHub authentication.
     */
    oauthStates.set(
      state,
      extensionRedirectUri
    );

    const authorizationUrl =
      buildGitHubAuthorizationUrl(state);

    res.redirect(
      authorizationUrl
    );
  }
);

app.get(
  "/auth/github/callback",
  async (req, res) => {
    try {
      const code =
        typeof req.query.code === "string"
          ? req.query.code
          : undefined;

      const state =
        typeof req.query.state === "string"
          ? req.query.state
          : undefined;

      if (!code || !state) {
        res
          .status(400)
          .send(
            "Missing GitHub OAuth code or state."
          );
        return;
      }

      if (!oauthStates.has(state)) {
        res
          .status(400)
          .send(
            "Invalid OAuth state."
          );
        return;
      }

      const extensionRedirectUri =
        oauthStates.get(state);

      oauthStates.delete(state);

      const githubToken =
        await exchangeCodeForToken(code);

      const githubUser =
        await getGitHubUser(
          githubToken
        );

      const sessionId =
        createSession(
          githubUser.id,
          githubUser.login,
          githubToken
        );

      if (!extensionRedirectUri) {
        throw new Error(
          "Missing extension OAuth redirect URI."
        );
      }

      const redirectUrl =
        new URL(extensionRedirectUri);

      redirectUrl.searchParams.set(
        "session",
        sessionId
      );

      console.log(
        "GitHub OAuth successful. Redirecting to extension."
      );

      res.redirect(
        redirectUrl.toString()
      );
    } catch (error) {
      console.error(
        "GitHub OAuth callback failed:",
        error
      );

      res
        .status(500)
        .send(
          `GitHub authorization failed: ${
            error instanceof Error
              ? error.message
              : "Unknown error"
          }`
        );
    }
  }
);

app.get(
  "/auth/me",
  (req, res) => {
    try {
      const session =
        getAuthenticatedSession(req);

      res.json({
        authenticated: true,
        githubUserId:
          session.githubUserId,
        githubLogin:
          session.githubLogin,
      });
    } catch (error) {
      res
        .status(401)
        .json({
          authenticated: false,
          error:
            error instanceof Error
              ? error.message
              : "Not authenticated.",
        });
    }
  }
);

/*
 * Logout.
 */
app.post(
  "/auth/logout",
  (req, res) => {
    const value =
      req.header("authorization");

    if (value?.startsWith("Bearer ")) {
      const sessionId =
        value.slice("Bearer ".length).trim();

      if (sessionId) {
        deleteSession(sessionId);
      }
    }

    res.json({
      ok: true
    });
  }
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "github-copilot",
    model: MODEL
  });
});

app.post(
  "/semantic-analysis",
  async (req, res) => {
    let client: CopilotClient | undefined;

    try {
      /*
       * Production authentication boundary:
       * the bearer token must come from the application's
       * authenticated GitHub OAuth session.
       *
       * Do not expose raw GitHub tokens to arbitrary clients
       * in a production deployment. The OAuth/session layer
       * will own token acquisition and rotation.
       */
      const authenticatedSession =
        getAuthenticatedSession(req);

      const userToken =
        authenticatedSession.githubToken;

      client = new CopilotClient({
        gitHubToken: userToken,
        useLoggedInUser: false
      });

      await client.start();

      const session =
        await client.createSession({
          model: MODEL,
          sessionId:
            `career-lens-${crypto.randomUUID()}`
        });

      try {
        const response =
          await session.sendAndWait({
            prompt: buildPrompt(req.body)
          });

        const content =
          response?.data?.content;

        if (
          typeof content !== "string" ||
          !content.trim()
        ) {
          throw new Error(
            "Copilot returned no content."
          );
        }

        let parsed: unknown;

        try {
          parsed = JSON.parse(content);
        } catch {
          throw new Error(
            "Copilot returned non-JSON content."
          );
        }

        res.json(parsed);
      } finally {
        await session.disconnect();
      }
    } catch (error) {
      console.error(
        "CareerLens semantic analysis failed:",
        error
      );

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Semantic gateway failure."
      });
    } finally {
      if (client) {
        try {
          await client.stop();
        } catch {
          // Ignore shutdown error.
        }
      }
    }
  }
);

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log(
      "=============================================="
    );
    console.log(
      "CareerLens Semantic Gateway"
    );
    console.log(
      "=============================================="
    );
    console.log(
      `Listening: http://127.0.0.1:${PORT}`
    );
    console.log(
      `Provider:  GitHub Copilot`
    );
    console.log(
      `Model:     ${MODEL}`
    );
    console.log("");
    console.log(
      "Gateway requires a per-request GitHub token."
    );
    console.log(
      "OAuth/session handling is intentionally kept"
    );
    console.log(
      "outside this semantic service."
    );
    console.log(
      "=============================================="
    );
  }
);
