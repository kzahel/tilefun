import { timingSafeEqual } from "node:crypto";

/** Browser hosts retain trusted co-op; Node hosts opt in explicitly or require a secret. */
export function adminAuthorization(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.TILEFUN_ADMIN_TOKEN;
  if (secret !== undefined && secret.length < 32)
    throw new Error("TILEFUN_ADMIN_TOKEN must contain at least 32 characters.");
  const expected = secret ? Buffer.from(secret) : null;
  const trusted = env.TILEFUN_TRUSTED_COOP === "1" && !expected;
  return (_clientId: string, token?: string): boolean => {
    if (trusted) return true;
    if (!expected || typeof token !== "string" || token.length > 512) return false;
    const supplied = Buffer.from(token);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  };
}
