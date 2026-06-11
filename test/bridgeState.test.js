"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeBridgeState } = require("../out/bridgeState");
const { expandHome } = require("../out/paths");
const os = require("os");
const path = require("path");

describe("sanitizeBridgeState", () => {
  it("normalizes bridge file JSON", () => {
    const state = sanitizeBridgeState({
      updatedAt: 1781122334455,
      sessionId: "abc",
      model: "Sonnet",
      fiveHour: { usedPercentage: 62.4, resetsAt: 1781129000 },
      sevenDay: { usedPercentage: 31.2, resetsAt: 1781452800 },
      context: { usedPercentage: 42, inputTokens: 100 },
      cost: { sessionUsd: 0.18 },
    });

    assert.equal(state?.sessionId, "abc");
    assert.equal(state?.fiveHour?.usedPercentage, 62.4);
    assert.equal(state?.fiveHour?.resetsAt, 1781129000000);
    assert.equal(state?.cost?.sessionUsd, 0.18);
  });

  it("returns null for invalid input", () => {
    assert.equal(sanitizeBridgeState(null), null);
    assert.equal(sanitizeBridgeState("bad"), null);
  });

  it("handles missing nested fields", () => {
    const state = sanitizeBridgeState({ updatedAt: Date.now() });
    assert.equal(state?.fiveHour, undefined);
    assert.equal(state?.model, undefined);
  });
});

describe("expandHome", () => {
  it("expands tilde paths", () => {
    assert.equal(
      expandHome("~/.claude-usage-bridge/state.json"),
      path.join(os.homedir(), ".claude-usage-bridge", "state.json")
    );
    assert.equal(expandHome("~"), os.homedir());
  });

  it("leaves absolute paths unchanged", () => {
    assert.equal(expandHome("/tmp/state.json"), "/tmp/state.json");
  });
});
