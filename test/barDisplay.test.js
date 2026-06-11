"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolveBarDisplay } = require("../out/barDisplay");

const now = Date.now();

function makeState(source, usedPercentage) {
  return {
    source,
    updatedAt: now,
    fiveHour: { usedPercentage },
  };
}

describe("resolveBarDisplay", () => {
  it("shows dual when both sources have data in both mode", () => {
    const display = resolveBarDisplay(
      { claude: makeState("claude", 40), codex: makeState("codex", 20) },
      "both",
      undefined,
      now,
      120_000
    );

    assert.equal(display.kind, "dual");
  });

  it("shows stable dual split view in auto when both sources have data", () => {
    const display = resolveBarDisplay(
      { claude: makeState("claude", 40), codex: makeState("codex", 20) },
      "auto",
      { mode: "single", claudeLive: true, codexLive: false, claudeConnected: true, focusedSource: "claude", showClaude: true, showCodex: false, primarySource: "claude" },
      now,
      120_000
    );

    assert.equal(display.kind, "dual");
  });

  it("shows latest source when auto has only one snapshot", () => {
    const display = resolveBarDisplay(
      { claude: makeState("claude", 55), codex: null },
      "auto",
      { mode: "none", claudeLive: false, codexLive: false, claudeConnected: false, focusedSource: null, showClaude: false, showCodex: false, primarySource: null },
      now,
      120_000
    );

    assert.equal(display.kind, "single");
    assert.equal(display.source, "claude");
  });
});
