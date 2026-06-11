"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  extractSanitizedState,
  processStatusLineInput,
} = require("../scripts/codex-status-bridge.js");
const {
  acquirePollerLock,
  extractLatestTokenCountPayload,
  extractModelFromSession,
  hasStateChanged,
  pollOnce,
  readLockPid,
} = require("../scripts/codex-usage-poller.js");

describe("codex bridge extraction", () => {
  it("extracts primary/secondary rate limits", () => {
    const state = extractSanitizedState({
      session_id: "abc",
      model: "gpt-5.5",
      cwd: "/repo",
      rate_limits: {
        primary: { used_percent: 55, resets_at: 1781033548, window_minutes: 300 },
        secondary: { used_percent: 99, resets_at: 1781143312, window_minutes: 10080 },
        credits: { has_credits: true, unlimited: false, balance: 10 },
        plan_type: "plus",
      },
      context: { used_percent: 17.6, remaining_percent: 82.4 },
    });

    assert.equal(state.source, "codex");
    assert.equal(state.sessionId, "abc");
    assert.equal(state.fiveHour.usedPercentage, 55);
    assert.equal(state.fiveHour.resetsAt, 1781033548000);
    assert.equal(state.sevenDay.usedPercentage, 99);
    assert.equal(state.context.usedPercentage, 17.6);
    assert.equal(state.credits.hasCredits, true);
    assert.equal(state.credits.balance, 10);
    assert.equal(state.credits.planType, "plus");
  });

  it("supports limits.five_hour schema", () => {
    const state = extractSanitizedState({
      limits: {
        five_hour: { used_percent: 12 },
        weekly: { used_percent: 30 },
      },
    });

    assert.equal(state.fiveHour.usedPercentage, 12);
    assert.equal(state.sevenDay.usedPercentage, 30);
  });

  it("computes context from last token usage and context window", () => {
    const state = extractSanitizedState({
      info: {
        total_token_usage: { total_tokens: 5000000 },
        last_token_usage: { input_tokens: 100, output_tokens: 50, total_tokens: 129200 },
        model_context_window: 258400,
      },
      rate_limits: {
        primary: { used_percent: 10 },
        secondary: { used_percent: 20 },
      },
    });

    assert.equal(state.context.usedPercentage, 50);
    assert.equal(state.context.remainingPercentage, 50);
    assert.equal(state.context.inputTokens, 100);
    assert.equal(state.context.outputTokens, 50);
  });

  it("normalizes fractional percentages", () => {
    const state = extractSanitizedState({
      rate_limits: {
        primary: { percent_used: 0.25 },
        secondary: { remaining_percent: 0.7 },
      },
    });

    assert.equal(state.fiveHour.usedPercentage, 25);
    assert.equal(Math.round(state.sevenDay.usedPercentage), 30);
  });

  it("returns a statusline without crashing on bad input", () => {
    assert.equal(processStatusLineInput("not json"), "Codex 5h ?%");
  });
});

describe("codex session poller", () => {
  it("extracts latest real Codex token_count payload from a session file", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "headroom-codex-"));
    const sessionPath = path.join(tempDir, "rollout-2026-06-08T00-21-02-019ea576-6c7f-7693-ab98-026ed4a01afe.jsonl");
    fs.writeFileSync(
      sessionPath,
      [
        JSON.stringify({
          type: "event_msg",
          payload: {
            type: "token_count",
            rate_limits: {
              limit_id: "codex",
              primary: { used_percent: 55, resets_at: 1781033548 },
              secondary: { used_percent: 99, resets_at: 1781143312 },
            },
          },
        }),
        JSON.stringify({
          type: "event_msg",
          payload: {
            type: "token_count",
            rate_limits: {
              limit_id: "codex_model",
              limit_name: "Model Limit",
              primary: { used_percent: 0, resets_at: 1781033548 },
              secondary: { used_percent: 0, resets_at: 1781143312 },
            },
          },
        }),
      ].join("\n"),
      "utf8"
    );

    const payload = extractLatestTokenCountPayload(sessionPath);

    assert.equal(payload.rate_limits.primary.used_percent, 55);
    assert.equal(payload.rate_limits.secondary.used_percent, 99);
  });

  it("pollOnce writes codex state when session data exists", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "headroom-codex-"));
    const sessionDir = path.join(tempDir, "sessions", "2026", "06", "08");
    const statePath = path.join(tempDir, "codex.json");
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(
      path.join(sessionDir, "rollout-2026-06-08T00-21-02-abc.jsonl"),
      JSON.stringify({
        type: "event_msg",
        payload: {
          type: "token_count",
          rate_limits: {
            limit_id: "codex",
            primary: { used_percent: 42 },
            secondary: { used_percent: 12 },
          },
        },
      }),
      "utf8"
    );

    const ok = pollOnce({ sessionsRoot: path.join(tempDir, "sessions"), statePath });
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

    assert.equal(ok, true);
    assert.equal(state.fiveHour.usedPercentage, 42);
  });

  it("does not rewrite unchanged state", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "headroom-codex-"));
    const statePath = path.join(tempDir, "codex.json");
    const state = {
      source: "codex",
      updatedAt: 1781152762554,
      fiveHour: { usedPercentage: 42 },
    };
    fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

    assert.equal(hasStateChanged(statePath, state), false);
    assert.equal(hasStateChanged(statePath, { ...state, model: "gpt-5.5" }), true);
  });

  it("extracts model from session context", () => {
    const lines = [
      JSON.stringify({ type: "turn_context", payload: { model: "gpt-5.5" } }),
    ];

    assert.equal(extractModelFromSession(lines), "gpt-5.5");
  });

  it("prevents duplicate live pollers", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "headroom-codex-"));
    const lockPath = path.join(tempDir, "codex-poller.lock");

    const first = acquirePollerLock(lockPath);
    const second = acquirePollerLock(lockPath);

    assert.equal(first.acquired, true);
    assert.equal(second.acquired, false);
    assert.equal(readLockPid(lockPath), process.pid);
  });

  it("replaces stale poller locks", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "headroom-codex-"));
    const lockPath = path.join(tempDir, "codex-poller.lock");
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999999 }), "utf8");

    const lock = acquirePollerLock(lockPath);

    assert.equal(lock.acquired, true);
    assert.equal(readLockPid(lockPath), process.pid);
  });
});
