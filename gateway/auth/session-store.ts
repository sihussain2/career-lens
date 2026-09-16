import crypto from "node:crypto";

export interface UserSession {
  sessionId: string;
  githubUserId: number;
  githubLogin: string;
  githubToken: string;
  createdAt: number;
}

const sessions = new Map<string, UserSession>();

export function createSession(
  githubUserId: number,
  githubLogin: string,
  githubToken: string
): string {
  const sessionId = crypto.randomBytes(32).toString("hex");

  sessions.set(sessionId, {
    sessionId,
    githubUserId,
    githubLogin,
    githubToken,
    createdAt: Date.now(),
  });

  return sessionId;
}

export function getSession(sessionId: string): UserSession | undefined {
  return sessions.get(sessionId);
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}
