#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { writeStateAtomically } = require("./bridge-common.js");
const { extractSanitizedState, STATE_PATH } = require("./codex-status-bridge.js");

const SESSIONS_ROOT = path.join(os.homedir(), ".codex", "sessions");
const LOCK_PATH = path.join(os.homedir(), ".ai-usage-bridge", "codex-poller.lock");
const DEFAULT_INTERVAL_MS = 5000;

/**
 * @param {string} directory
 * @returns {string[]}
 */
function listSessionFiles(directory) {
  const results = [];

  if (!fs.existsSync(directory)) {
    return results;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSessionFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      results.push(entryPath);
    }
  }

  return results;
}

/**
 * @param {string} sessionPath
 * @returns {Record<string, unknown>|null}
 */
function extractLatestTokenCountPayload(sessionPath) {
  let content = "";

  try {
    content = fs.readFileSync(sessionPath, "utf8");
  } catch {
    return null;
  }

  const lines = content.trim().split("\n");

  let fallback = null;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.includes("token_count")) {
      continue;
    }

    try {
      const event = JSON.parse(line);
      const payload = event.payload;
      if (event.type !== "event_msg" || payload?.type !== "token_count") {
        continue;
      }

      if (!hasUsableRateLimits(payload.rate_limits)) {
        continue;
      }

      const sessionId = path
        .basename(sessionPath, ".jsonl")
        .replace(/^rollout-[^-]+-[^-]+-[^-]+-/, "");
      const candidate = {
        session_id: sessionId,
        timestamp: event.timestamp,
        rate_limits: payload.rate_limits,
        info: payload.info,
        model: extractModelFromSession(lines),
        cwd: extractCwdFromSession(lines),
      };

      if (isPrimaryCodexLimit(payload.rate_limits)) {
        return candidate;
      }

      fallback = fallback ?? candidate;
    } catch {
      // Skip malformed lines.
    }
  }

  return fallback;
}

function hasUsableRateLimits(rateLimits) {
  return Boolean(
    rateLimits &&
      typeof rateLimits === "object" &&
      (rateLimits.primary || rateLimits.five_hour)
  );
}

function isPrimaryCodexLimit(rateLimits) {
  if (!rateLimits || typeof rateLimits !== "object") {
    return false;
  }

  return rateLimits.limit_id === "codex" || !("limit_id" in rateLimits);
}

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function extractCwdFromSession(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.includes("cwd")) {
      continue;
    }

    try {
      const event = JSON.parse(line);
      const cwd = event.payload?.cwd ?? event.payload?.workspace?.cwd;
      if (typeof cwd === "string") {
        return cwd;
      }
    } catch {
      // Skip malformed lines.
    }
  }

  return null;
}

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function extractModelFromSession(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.includes('"model"')) {
      continue;
    }

    try {
      const event = JSON.parse(line);
      const model = event.payload?.model ?? event.payload?.model_name;
      if (typeof model === "string") {
        return model;
      }
    } catch {
      // Skip malformed lines.
    }
  }

  return null;
}

/**
 * @returns {string[]}
 */
function findRecentSessionFiles(limit = 8, sessionsRoot = SESSIONS_ROOT) {
  return listSessionFiles(sessionsRoot)
    .map((filePath) => ({
      filePath,
      mtimeMs: fs.statSync(filePath).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, limit)
    .map((entry) => entry.filePath);
}

/**
 * @returns {boolean}
 */
function pollOnce(options = {}) {
  const sessionPaths = findRecentSessionFiles(
    options.limit ?? 8,
    options.sessionsRoot ?? SESSIONS_ROOT
  );
  let payload = null;

  for (const sessionPath of sessionPaths) {
    payload = extractLatestTokenCountPayload(sessionPath);
    if (payload) {
      break;
    }
  }

  if (!payload) {
    return false;
  }

  const state = extractSanitizedState(payload);
  if (!state) {
    return false;
  }

  const statePath = options.statePath ?? STATE_PATH;
  if (!hasStateChanged(statePath, state)) {
    return true;
  }

  writeStateAtomically(statePath, state);
  return true;
}

function hasStateChanged(statePath, nextState) {
  try {
    if (!fs.existsSync(statePath)) {
      return true;
    }

    const current = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return JSON.stringify(current) !== JSON.stringify(nextState);
  } catch {
    return true;
  }
}

function runPollLoop(intervalMs, options = {}) {
  const lock = acquirePollerLock(options.lockPath ?? LOCK_PATH);
  if (!lock.acquired) {
    return false;
  }

  pollOnce();
  setInterval(pollOnce, intervalMs);
  return true;
}

function acquirePollerLock(lockPath) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
    fs.closeSync(fd);
    registerLockCleanup(lockPath);
    return { acquired: true };
  } catch (error) {
    if (error?.code !== "EEXIST") {
      return { acquired: false };
    }
  }

  const existingPid = readLockPid(lockPath);
  if (existingPid != null && isProcessRunning(existingPid)) {
    return { acquired: false };
  }

  try {
    fs.unlinkSync(lockPath);
  } catch {
    return { acquired: false };
  }

  return acquirePollerLock(lockPath);
}

function readLockPid(lockPath) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    return typeof lock.pid === "number" && Number.isInteger(lock.pid) ? lock.pid : null;
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function registerLockCleanup(lockPath) {
  const cleanup = () => {
    try {
      const pid = readLockPid(lockPath);
      if (pid === process.pid) {
        fs.unlinkSync(lockPath);
      }
    } catch {
      // Best effort.
    }
  };

  process.once("exit", cleanup);
  process.once("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--once")) {
    const ok = pollOnce();
    process.exit(ok ? 0 : 1);
    return;
  }

  const intervalFlagIndex = args.indexOf("--interval");
  const intervalMs =
    intervalFlagIndex >= 0 && args[intervalFlagIndex + 1]
      ? Number(args[intervalFlagIndex + 1])
      : DEFAULT_INTERVAL_MS;

  runPollLoop(Number.isFinite(intervalMs) ? intervalMs : DEFAULT_INTERVAL_MS);
}

if (require.main === module) {
  main();
}

module.exports = {
  listSessionFiles,
  extractLatestTokenCountPayload,
  findRecentSessionFiles,
  pollOnce,
  hasUsableRateLimits,
  isPrimaryCodexLimit,
  extractModelFromSession,
  hasStateChanged,
  acquirePollerLock,
  readLockPid,
  isProcessRunning,
};
