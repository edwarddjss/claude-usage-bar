"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  extractSanitizedState,
  processStatusLineInput,
  parseInput,
  renderStatusLine,
} = require("../scripts/claude-status-bridge.js");

describe("bridge JSON extraction", () => {
  it("extracts sanitized fields from Claude statusline JSON", () => {
    const state = extractSanitizedState({
      session_id: "abc123",
      model: { display_name: "Sonnet" },
      rate_limits: {
        five_hour: { used_percentage: 62.4, resets_at: 1781129000 },
        seven_day: { used_percentage: 31.2, resets_at: 1781452800 },
      },
      context_window: {
        used_percentage: 42,
        input_tokens: 12345,
        output_tokens: 6789,
      },
      cost: { total_cost_usd: 0.18 },
      transcript: "should not be stored",
      messages: [{ role: "user", content: "secret" }],
    });

    assert.equal(state.sessionId, "abc123");
    assert.equal(state.model, "Sonnet");
    assert.equal(state.fiveHour.usedPercentage, 62.4);
    assert.equal(state.fiveHour.resetsAt, 1781129000000);
    assert.equal(state.sevenDay.usedPercentage, 31.2);
    assert.equal(state.context.usedPercentage, 42);
    assert.equal(state.context.remainingPercentage, 58);
    assert.equal(state.context.inputTokens, 12345);
    assert.equal(state.cost.sessionUsd, 0.18);
    assert.ok(state.updatedAt > 0);
    assert.equal(state.source, "claude");
    assert.equal("transcript" in state, false);
    assert.equal("messages" in state, false);
  });

  it("handles missing fields gracefully", () => {
    assert.equal(extractSanitizedState(null), null);

    const empty = extractSanitizedState({});
    assert.equal(empty.sessionId, null);
    assert.equal(empty.model, null);
    assert.equal(empty.fiveHour.usedPercentage, null);

    const partial = extractSanitizedState({
      rate_limits: { five_hour: { used_percentage: 10 } },
    });

    assert.equal(partial.fiveHour.usedPercentage, 10);
    assert.equal(partial.sevenDay.usedPercentage, null);
    assert.equal(partial.model, null);
  });
});

describe("bridge input handling", () => {
  it("parses valid JSON", () => {
    const parsed = parseInput('{"session_id":"x"}');
    assert.equal(parsed.session_id, "x");
  });

  it("returns null for malformed JSON", () => {
    assert.equal(parseInput("{not json"), null);
    assert.equal(parseInput(""), null);
  });

  it("returns a statusline without crashing on bad input", () => {
    assert.equal(processStatusLineInput("not json"), "Claude 5h ?%");
  });

  it("renders statusline from extracted state", () => {
    const line = renderStatusLine({
      fiveHour: { usedPercentage: 62.4 },
    });
    assert.equal(line, "Claude 5h 62%");
  });
});
