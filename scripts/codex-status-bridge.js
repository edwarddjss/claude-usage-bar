#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  BRIDGE_DIR,
  toNumber,
  normalizeTimestamp,
  writeStateAtomically,
  formatPercentage,
  parseInput,
} = require("./bridge-common.js");

const STATE_PATH = path.join(BRIDGE_DIR, "codex.json");

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
    data.rate_limits && typeof data.rate_limits === "object" ? data.rate_limits : null;
  const limits = data.limits && typeof data.limits === "object" ? data.limits : {};
  const context = data.context && typeof data.context === "object" ? data.context : {};
  const contextWindow =
    data.context_window && typeof data.context_window === "object"
      ? data.context_window
      : {};

  const fiveHourSource =
    (limits.five_hour && typeof limits.five_hour === "object" && limits.five_hour) ||
    (rateLimits?.primary && typeof rateLimits.primary === "object" && rateLimits.primary) ||
    (rateLimits?.five_hour && typeof rateLimits.five_hour === "object" && rateLimits.five_hour) ||
    {};

  const sevenDaySource =
    (limits.weekly && typeof limits.weekly === "object" && limits.weekly) ||
    (limits.seven_day && typeof limits.seven_day === "object" && limits.seven_day) ||
    (rateLimits?.secondary && typeof rateLimits.secondary === "object" && rateLimits.secondary) ||
    (rateLimits?.seven_day && typeof rateLimits.seven_day === "object" && rateLimits.seven_day) ||
    {};

  const usedContext =
    toNumber(context.used_percent) ??
    toNumber(context.used_percentage) ??
    toNumber(contextWindow.used_percentage) ??
    toNumber(contextWindow.used_percent);

  const remainingContext =
    toNumber(context.remaining_percent) ??
    toNumber(context.remaining_percentage) ??
    toNumber(contextWindow.remaining_percentage) ??
    toNumber(contextWindow.remaining_percent);

  const tokenInfo =
    data.info && typeof data.info === "object" ? data.info : {};
  const credits =
    rateLimits?.credits && typeof rateLimits.credits === "object"
      ? rateLimits.credits
      : {};
  const lastUsage =
    tokenInfo.last_token_usage && typeof tokenInfo.last_token_usage === "object"
      ? tokenInfo.last_token_usage
      : {};
  const contextWindowSize =
    toNumber(tokenInfo.model_context_window) ??
    toNumber(contextWindow.size) ??
    toNumber(contextWindow.total_tokens);

  const inputTokens = toNumber(lastUsage.input_tokens ?? contextWindow.input_tokens);
  const outputTokens = toNumber(lastUsage.output_tokens ?? contextWindow.output_tokens);
  const totalContextTokens =
    toNumber(lastUsage.total_tokens) ??
    sumNumbers(
      toNumber(contextWindow.input_tokens),
      toNumber(contextWindow.output_tokens)
    );
  const calculatedContext =
    contextWindowSize && totalContextTokens != null
      ? (totalContextTokens / contextWindowSize) * 100
      : null;

  const fiveHourPct = getUsedPercentage(fiveHourSource);
  const sevenDayPct = getUsedPercentage(sevenDaySource);

  return {
    source: "codex",
    updatedAt: normalizeTimestamp(data.updated_at ?? data.timestamp) ?? Date.now(),
    sessionId:
      typeof data.session_id === "string"
        ? data.session_id
        : typeof data.thread_id === "string"
          ? data.thread_id
          : null,
    model:
      typeof data.model === "string"
        ? data.model
        : typeof data.model_name === "string"
          ? data.model_name
          : typeof rateLimits?.limit_name === "string"
            ? rateLimits.limit_name
            : null,
    cwd: typeof data.cwd === "string" ? data.cwd : null,
    pid: typeof data.pid === "number" ? data.pid : null,
    fiveHour: {
      usedPercentage: fiveHourPct,
      resetsAt: normalizeTimestamp(
        fiveHourSource.resets_at ?? fiveHourSource.resets_at_raw
      ),
    },
    sevenDay: {
      usedPercentage: sevenDayPct,
      resetsAt: normalizeTimestamp(
        sevenDaySource.resets_at ?? sevenDaySource.resets_at_raw
      ),
    },
    context: {
      usedPercentage: usedContext ?? calculatedContext,
      remainingPercentage:
        remainingContext ??
        (usedContext != null
          ? Math.max(0, 100 - usedContext)
          : calculatedContext != null
            ? Math.max(0, 100 - calculatedContext)
            : null),
      inputTokens,
      outputTokens,
    },
    cost: {
      sessionUsd: toNumber(data.cost?.total_cost_usd ?? data.cost?.session_usd),
    },
    credits: {
      hasCredits:
        typeof credits.has_credits === "boolean" ? credits.has_credits : null,
      unlimited:
        typeof credits.unlimited === "boolean" ? credits.unlimited : null,
      balance: toNumber(credits.balance),
      planType: typeof rateLimits?.plan_type === "string" ? rateLimits.plan_type : null,
      rateLimitReachedType:
        typeof rateLimits?.rate_limit_reached_type === "string"
          ? rateLimits.rate_limit_reached_type
          : null,
    },
  };
}

function getUsedPercentage(source) {
  const direct =
    toNumber(source.used_percent) ??
    toNumber(source.used_percentage) ??
    toNumber(source.percent_used);
  if (direct != null) {
    return direct <= 1 && direct >= 0 ? direct * 100 : direct;
  }

  const used = toNumber(source.used);
  const limit = toNumber(source.limit ?? source.total);
  if (used != null && limit && limit > 0) {
    return (used / limit) * 100;
  }

  const remaining =
    toNumber(source.remaining_percent) ??
    toNumber(source.remaining_percentage) ??
    toNumber(source.percent_remaining);
  if (remaining != null) {
    const normalized = remaining <= 1 && remaining >= 0 ? remaining * 100 : remaining;
    return 100 - normalized;
  }

  return null;
}

function sumNumbers(...values) {
  const present = values.filter((value) => value != null);
  if (present.length === 0) {
    return null;
  }

  return present.reduce((sum, value) => sum + value, 0);
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

  return `Codex 5h ${formatPercentage(percentage)}`;
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
      writeStateAtomically(STATE_PATH, state);
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
    process.stdout.write("Codex 5h ?%\n");
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
  STATE_PATH,
};
