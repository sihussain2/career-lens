
import express from "express";
import { CopilotClient } from "@github/copilot-sdk";

const app = express();
const PORT = Number(process.env.COPILOT_BRIDGE_PORT ?? 8765);
const MODEL = process.env.COPILOT_MODEL ?? "claude-haiku-4.5";

app.use(express.json({ limit: "2mb" }));

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

const client = new CopilotClient();

let started = false;

async function ensureStarted() {
  if (!started) {
    await client.start();
    started = true;
  }
}

const SYSTEM_PROMPT = `
You are the semantic reasoning engine for a resume intelligence
application.

You analyze whether supplied resume evidence actually supports
specific job requirements.

STRICT GROUNDING RULES:

1. Use ONLY the supplied evidence.
2. Never invent experience, skills, technologies, employers,
   responsibilities, qualifications, achievements, or metrics.
3. Do not infer a specific technology merely from generic engineering
   experience.
4. Do not treat job requirements as evidence that the candidate has
   the capability.
5. Evidence IDs are authoritative identifiers. Never create IDs.
6. Every supported conclusion must reference one or more supplied
   evidence IDs.
7. Confidence measures evidence strength, NOT probability of getting
   the job.
8. Be conservative.

RELATIONSHIPS:

strong_support:
  The evidence directly demonstrates the requirement.

partial_support:
  The evidence clearly demonstrates an important part of the
  requirement but not the complete requirement.

related:
  The experience is relevant or adjacent but does not establish
  that the requirement is satisfied.

contradicts:
  The supplied evidence conflicts with the requirement.

no_support:
  The supplied evidence does not establish the requirement.

SUGGESTIONS:

Suggestions must be evidence-grounded.

Allowed suggestion types:
REWORD
REORDER
ADD
REMOVE
EMPHASIZE
DE_EMPHASIZE
NO_CHANGE

Never create an ADD or REWORD statement containing a qualification
that is not supported by supplied evidence.

Return JSON only.
`;

function buildPrompt(request: unknown): string {
  return `${SYSTEM_PROMPT}

Analyze the following structured request.

${JSON.stringify(request, null, 2)}

Return exactly this JSON structure:

{
  "requirements": [
    {
      "requirementId": "existing requirement ID",
      "relationship": "strong_support | partial_support | related | contradicts | no_support",
      "confidence": 0.0,
      "explanation": "short factual explanation",
      "evidence": [
        {
          "evidenceId": "existing evidence ID",
          "relationship": "strong_support | partial_support | related | contradicts | no_support",
          "confidence": 0.0,
          "explanation": "why this evidence has this relationship"
        }
      ]
    }
  ],
  "suggestions": [
    {
      "type": "REWORD | REORDER | ADD | REMOVE | EMPHASIZE | DE_EMPHASIZE | NO_CHANGE",
      "sectionId": "existing section ID",
      "original": "existing resume text when applicable",
      "proposed": "proposed text when applicable",
      "reason": "factual reason",
      "evidenceIds": ["existing evidence ID"],
      "requirementIds": ["existing requirement ID"],
      "confidence": 0.0
    }
  ]
}

For NO_CHANGE, evidenceIds may still be supplied when useful.

Do not output markdown fences.
`;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "github-copilot",
    model: MODEL
  });
});

app.post("/semantic-analysis", async (req, res) => {
  try {
    await ensureStarted();

    const session = await client.createSession({
      model: MODEL
    });

    try {
      const response = await session.sendAndWait({
        prompt: buildPrompt(req.body)
      });

      const content = response?.data?.content;

      if (typeof content !== "string" || !content.trim()) {
        throw new Error("Copilot returned no content.");
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
    console.error("Semantic analysis failed:", error);

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unknown Copilot bridge error."
    });
  }
});

const server = app.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("==============================================");
  console.log("Resume & Job Intelligence - Copilot Bridge");
  console.log("==============================================");
  console.log(`Listening: http://127.0.0.1:${PORT}`);
  console.log(`Provider:  GitHub Copilot`);
  console.log(`Model:     ${MODEL}`);
  console.log("");
  console.log("Using Copilot CLI authentication.");
  console.log("==============================================");
});

async function shutdown() {
  console.log("Stopping Copilot bridge...");

  try {
    await client.stop();
  } finally {
    server.close(() => process.exit(0));
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
