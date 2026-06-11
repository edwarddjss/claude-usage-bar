#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { writeStateAtomically } = require("./bridge-common.js");
const { extractSanitizedState, STATE_PATH } = require("./codex-status-bridge.js");

const SESSIONS_ROOT = path.join(os.homedir(), ".codex", "sessions");
const DEFAULT_INTERVAL_MS = 2000;

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

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.includes("token_count")) {
      continue;
    }

    try {
      const event = JSON.parse(line);
      const payload = event.payload;
      if (
        event.type === "event_msg" &&
        payload?.type === "token_count" &&
        payload.rate_limits &&
        (payload.rate_limits.primary || payload.rate_limits.five_hour)
      ) {
        const sessionId = path.basename(sessionPath, ".jsonl").replace(/^rollout-[^-]+-[^-]+-[^-]+-/, "");
        return {
          session_id: sessionId,
          rate_limits: payload.rate_limits,
          info: payload.info,
          cwd: extractCwdFromSession(lines),
        };
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
 * @returns {string[]}
 */
function findRecentSessionFiles(limit = 8) {
  return listSessionFiles(SESSIONS_ROOT)
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
function pollOnce() {
  const sessionPaths = findRecentSessionFiles();
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

  writeStateAtomically(STATE_PATH, state);
  return true;
}

function runPollLoop(intervalMs) {
  pollOnce();
  setInterval(pollOnce, intervalMs);
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
};
