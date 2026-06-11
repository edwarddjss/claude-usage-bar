#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  BRIDGE_DIR,
  toNumber,
  normalizeTimestamp,
  writeStateAtomically,
  formatPercentage,
  parseInput,
} = require("./bridge-common.js");

const LEGACY_STATE_PATH = path.join(os.homedir(), ".claude-usage-bridge", "state.json");
const STATE_PATH = path.join(BRIDGE_DIR, "claude.json");

/**
 * @param {unknown} input
 * @returns {Record<string, unknown>|null}
 */
function extractSanitizedState(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const data = input;
  const rateLimits =
    data.rate_limits && typeof data.rate_limits === "object" ? data.rate_limits : {};
  const fiveHour =
    rateLimits.five_hour && typeof rateLimits.five_hour === "object"
      ? rateLimits.five_hour
      : {};
  const sevenDay =
    rateLimits.seven_day && typeof rateLimits.seven_day === "object"
      ? rateLimits.seven_day
      : {};
  const contextWindow =
    data.context_window && typeof data.context_window === "object"
      ? data.context_window
      : {};
  const cost = data.cost && typeof data.cost === "object" ? data.cost : {};
  const model = data.model && typeof data.model === "object" ? data.model : {};
  const workspace =
    data.workspace && typeof data.workspace === "object" ? data.workspace : {};

  const usedContext = toNumber(contextWindow.used_percentage);
  const remainingContext = toNumber(contextWindow.remaining_percentage);

  const cwd =
    typeof data.cwd === "string"
      ? data.cwd
      : typeof workspace.current_working_directory === "string"
        ? workspace.current_working_directory
        : typeof workspace.cwd === "string"
          ? workspace.cwd
          : null;

  return {
    source: "claude",
    updatedAt: Date.now(),
    sessionId: typeof data.session_id === "string" ? data.session_id : null,
    model: typeof model.display_name === "string" ? model.display_name : null,
    cwd,
    pid: typeof data.pid === "number" ? data.pid : process.ppid,
    fiveHour: {
      usedPercentage: toNumber(fiveHour.used_percentage),
      resetsAt: normalizeTimestamp(fiveHour.resets_at),
    },
    sevenDay: {
      usedPercentage: toNumber(sevenDay.used_percentage),
      resetsAt: normalizeTimestamp(sevenDay.resets_at),
    },
    context: {
      usedPercentage: usedContext,
      remainingPercentage:
        remainingContext ??
        (usedContext != null ? Math.max(0, 100 - usedContext) : null),
      inputTokens: toNumber(contextWindow.input_tokens),
      outputTokens: toNumber(contextWindow.output_tokens),
    },
    cost: {
      sessionUsd: toNumber(cost.total_cost_usd),
    },
  };
}

/**
 * @param {Record<string, unknown>|null} state
 * @returns {string}
 */
function renderStatusLine(state) {
  const percentage =
    state &&
    state.fiveHour &&
    typeof state.fiveHour === "object" &&
    "usedPercentage" in state.fiveHour
      ? state.fiveHour.usedPercentage
      : null;

  return `Claude 5h ${formatPercentage(percentage)}`;
}

/**
 * @param {Record<string, unknown>} state
 */
function persistState(state) {
  writeStateAtomically(STATE_PATH, state);

  try {
    writeStateAtomically(LEGACY_STATE_PATH, state);
  } catch {
    // Legacy path is best-effort for backward compatibility.
  }
}

/**
 * @param {string} raw
 * @returns {string}
 */
function processStatusLineInput(raw) {
  const parsed = parseInput(raw);
  const state = extractSanitizedState(parsed);

  if (state) {
    try {
      persistState(state);
    } catch {
      // Continue and still return a statusline string.
    }
  }

  return renderStatusLine(state);
}

async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  try {
    const input = await readStdin();
    const statusLine = processStatusLineInput(input);
    process.stdout.write(`${statusLine}\n`);
  } catch {
    process.stdout.write("Claude 5h ?%\n");
    process.exitCode = 0;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  extractSanitizedState,
  formatPercentage,
  renderStatusLine,
  processStatusLineInput,
  parseInput,
  toNumber,
  normalizeTimestamp,
  STATE_PATH,
};
