import { createHash } from "node:crypto";

/** Both login identifiers share the same account lock; unknown identifiers stay hashed. */
export function loginAttemptKey(identifier: string, userId?: string): string {
  return createHash("sha256")
    .update(userId ? `user:${userId}` : identifier)
    .digest("hex");
}
