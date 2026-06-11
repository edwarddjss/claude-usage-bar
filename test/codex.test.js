"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  extractSanitizedState,
  processStatusLineInput,
} = require("../scripts/codex-status-bridge.js");
const {
  extractLatestTokenCountPayload,
  pollOnce,
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
      },
      context: { used_percent: 17.6, remaining_percent: 82.4 },
    });

    assert.equal(state.source, "codex");
    assert.equal(state.sessionId, "abc");
    assert.equal(state.fiveHour.usedPercentage, 55);
    assert.equal(state.fiveHour.resetsAt, 1781033548000);
    assert.equal(state.sevenDay.usedPercentage, 99);
    assert.equal(state.context.usedPercentage, 17.6);
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

  it("returns a statusline without crashing on bad input", () => {
    assert.equal(processStatusLineInput("not json"), "Codex 5h ?%");
  });
});

describe("codex session poller", () => {
  it("extracts latest token_count payload from a session file", () => {
    const payload = extractLatestTokenCountPayload(
      "/home/nazk/.codex/sessions/2026/06/08/rollout-2026-06-08T00-21-02-019ea576-6c7f-7693-ab98-026ed4a01afe.jsonl"
    );

    assert.equal(payload.rate_limits.primary.used_percent, 55);
    assert.equal(payload.rate_limits.secondary.used_percent, 99);
  });

  it("pollOnce writes codex state when session data exists", () => {
    const ok = pollOnce();
    assert.equal(ok, true);
  });
});
