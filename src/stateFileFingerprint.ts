import * as fs from "fs";
import { createHash } from "crypto";

export interface StateFileFingerprint {
  exists: boolean;
  mtimeMs?: number;
  size?: number;
  contentHash?: string;
}

export function readStateFileFingerprint(
  filePath: string,
  includeContent: boolean
): StateFileFingerprint {
  try {
    const stat = fs.statSync(filePath);

    if (!stat.isFile()) {
      return { exists: false };
    }

    const fingerprint: StateFileFingerprint = {
      exists: true,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    };

    if (includeContent) {
      fingerprint.contentHash = createHash("sha256")
        .update(fs.readFileSync(filePath))
        .digest("hex");
    }

    return fingerprint;
  } catch {
    return { exists: false };
  }
}

export function sameFingerprint(
  previous: StateFileFingerprint | undefined,
  next: StateFileFingerprint,
  includeContent: boolean
): boolean {
  if (!previous) {
    return false;
  }

  const sameMetadata =
    previous.exists === next.exists &&
    previous.mtimeMs === next.mtimeMs &&
    previous.size === next.size;

  if (!sameMetadata || !includeContent) {
    return sameMetadata;
  }

  return previous.contentHash === next.contentHash;
}
