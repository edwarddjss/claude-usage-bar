import * as fs from "fs";
import * as path from "path";
import { DEFAULT_CLAUDE_IDE_LOCK_DIR } from "./constants";
import { expandHome } from "./paths";
import type {
  ActivityContext,
  BridgeState,
  ClaudeIdeLock,
  DisplayMode,
  ResolvedActivity,
  UsageSnapshot,
  UsageSource,
} from "./types";

export type { ActivityContext, ClaudeIdeLock, DisplayMode, ResolvedActivity } from "./types";

export function readClaudeIdeLocks(ideDir = DEFAULT_CLAUDE_IDE_LOCK_DIR): ClaudeIdeLock[] {
  const resolvedDir = expandHome(ideDir);
  const locks: ClaudeIdeLock[] = [];

  try {
    if (!fs.existsSync(resolvedDir)) {
      return locks;
    }

    for (const entry of fs.readdirSync(resolvedDir)) {
      if (!entry.endsWith(".lock")) {
        continue;
      }

      try {
        const raw = fs.readFileSync(path.join(resolvedDir, entry), "utf8");
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const workspaceFolders = Array.isArray(parsed.workspaceFolders)
          ? parsed.workspaceFolders.filter((value): value is string => typeof value === "string")
          : [];
        const pid = typeof parsed.pid === "number" ? parsed.pid : null;

        if (pid != null) {
          locks.push({
            pid,
            workspaceFolders,
            ideName: typeof parsed.ideName === "string" ? parsed.ideName : undefined,
          });
        }
      } catch {
        // Ignore malformed lock files.
      }
    }
  } catch {
    return locks;
  }

  return locks;
}

export function isSourceLive(
  state: BridgeState | null,
  thresholdMs: number,
  nowMs = Date.now()
): boolean {
  if (!state?.updatedAt || !Number.isFinite(state.updatedAt)) {
    return false;
  }

  return nowMs - state.updatedAt <= thresholdMs;
}

export function isClaudeConnectedToWorkspace(
  locks: ClaudeIdeLock[],
  workspaceFolders: string[]
): boolean {
  if (workspaceFolders.length === 0) {
    return locks.length > 0;
  }

  const normalizedWorkspaces = new Set(workspaceFolders.map(normalizePath));

  return locks.some((lock) =>
    lock.workspaceFolders.some((folder) => normalizedWorkspaces.has(normalizePath(folder)))
  );
}

export function resolveActivity(
  snapshot: UsageSnapshot,
  displayMode: DisplayMode,
  context: ActivityContext,
  locks: ClaudeIdeLock[] = readClaudeIdeLocks()
): ResolvedActivity {
  const claudeLive = isSourceLive(snapshot.claude, context.activeThresholdMs, context.nowMs);
  const codexLive = isSourceLive(snapshot.codex, context.activeThresholdMs, context.nowMs);
  const claudeConnected = isClaudeConnectedToWorkspace(locks, context.workspaceFolders);

  const claudeActive = claudeLive || claudeConnected;
  const codexActive = codexLive;

  let focusedSource = context.focusedTerminalSource;
  if (!focusedSource) {
    if (claudeLive && !codexLive) {
      focusedSource = "claude";
    } else if (codexLive && !claudeLive) {
      focusedSource = "codex";
    } else if (claudeLive && codexLive) {
      focusedSource = pickMostRecent(snapshot.claude, snapshot.codex);
    }
  }

  let showClaude = false;
  let showCodex = false;

  switch (displayMode) {
    case "claude":
      showClaude = Boolean(snapshot.claude);
      break;
    case "codex":
      showCodex = Boolean(snapshot.codex);
      break;
    case "both":
      showClaude = Boolean(snapshot.claude);
      showCodex = Boolean(snapshot.codex);
      break;
    case "auto":
    default:
      if (context.focusedTerminalSource === "claude") {
        showClaude = Boolean(snapshot.claude);
      } else if (context.focusedTerminalSource === "codex") {
        showCodex = Boolean(snapshot.codex);
      } else if (claudeActive && codexActive) {
        showClaude = Boolean(snapshot.claude);
        showCodex = Boolean(snapshot.codex);
      } else if (claudeActive) {
        showClaude = Boolean(snapshot.claude);
      } else if (codexActive) {
        showCodex = Boolean(snapshot.codex);
      } else {
        const fallback = pickMostRecent(snapshot.claude, snapshot.codex);
        if (fallback === "claude") {
          showClaude = Boolean(snapshot.claude);
        } else if (fallback === "codex") {
          showCodex = Boolean(snapshot.codex);
        }
      }
      break;
  }

  const mode =
    showClaude && showCodex ? "dual" : showClaude || showCodex ? "single" : "none";

  const primarySource =
    focusedSource ??
    (showClaude && !showCodex
      ? "claude"
      : showCodex && !showClaude
        ? "codex"
        : pickMostRecent(snapshot.claude, snapshot.codex));

  return {
    claudeLive,
    codexLive,
    claudeConnected,
    focusedSource,
    showClaude,
    showCodex,
    mode,
    primarySource,
  };
}

function pickMostRecent(
  claude: BridgeState | null,
  codex: BridgeState | null
): UsageSource | null {
  const claudeUpdated = claude?.updatedAt ?? 0;
  const codexUpdated = codex?.updatedAt ?? 0;

  if (claudeUpdated === 0 && codexUpdated === 0) {
    return null;
  }

  return claudeUpdated >= codexUpdated ? "claude" : "codex";
}

function normalizePath(value: string): string {
  return path.normalize(value).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}
