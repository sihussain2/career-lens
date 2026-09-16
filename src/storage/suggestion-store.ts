import type {
  Suggestion,
  SuggestionStatus
} from "../suggestions/Suggestion";

const KEY = "careerLensSuggestionDecisions";

export interface SuggestionDecision {
  suggestionId: string;
  status: SuggestionStatus;
  proposed?: string;
  updatedAt: string;
}

export async function saveSuggestionDecision(
  suggestionId: string,
  status: SuggestionStatus,
  proposed?: string
): Promise<void> {
  const result =
    await chrome.storage.local.get(KEY);

  const existing =
    (result[KEY] as SuggestionDecision[] | undefined) ??
    [];

  const decision: SuggestionDecision = {
    suggestionId,
    status,
    proposed,
    updatedAt: new Date().toISOString()
  };

  const remaining =
    existing.filter(
      item => item.suggestionId !== suggestionId
    );

  await chrome.storage.local.set({
    [KEY]: [decision, ...remaining]
  });
}

export async function getSuggestionDecisions():
  Promise<SuggestionDecision[]> {
  const result =
    await chrome.storage.local.get(KEY);

  return (
    (result[KEY] as SuggestionDecision[] | undefined) ??
    []
  );
}

export function applySuggestionDecision(
  suggestion: Suggestion,
  decision: SuggestionDecision | undefined
): Suggestion {
  if (!decision) return suggestion;

  return {
    ...suggestion,
    status: decision.status,
    proposed:
      decision.proposed ?? suggestion.proposed
  };
}
