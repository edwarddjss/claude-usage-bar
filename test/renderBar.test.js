"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  clampPercentage,
  renderProgressBar,
  formatPercentage,
  renderStatusBarText,
  renderTooltip,
  getPrimaryPercentage,
} = require("../out/renderBar");
const { resolveActivity } = require("../out/activity");
const { STALE_THRESHOLD_MS } = require("../out/time");

const now = Date.now();

function makeState(source, usedPercentage, updatedAt = now) {
  return {
    source,
    updatedAt,
    model: source === "claude" ? "Sonnet" : "gpt-5.5",
    fiveHour: { usedPercentage, resetsAt: updatedAt + 3_600_000 },
    sevenDay: { usedPercentage: 20, resetsAt: updatedAt + 86_400_000 },
    context: { usedPercentage: 10 },
    cost: { sessionUsd: 0.18 },
  };
}

describe("renderProgressBar", () => {
  it("renders filled and empty blocks", () => {
    assert.equal(renderProgressBar(50, 8), "████░░░░");
    assert.equal(renderProgressBar(null, 8), "????????");
  });
});

describe("renderStatusBarText", () => {
  it("renders single Claude status text", () => {
    const snapshot = { claude: makeState("claude", 62), codex: null };
    const activity = resolveActivity(snapshot, "claude", {
      nowMs: now,
      activeThresholdMs: 15_000,
      workspaceFolders: [],
      focusedTerminalSource: null,
    });

    const text = renderStatusBarText(snapshot, {
      primaryMetric: "fiveHour",
      barWidth: 8,
      showIcon: true,
      nowMs: now,
      activity,
    });

    assert.match(text, /Claude 5h █████░░░ 62%/);
  });

  it("renders dual split view when both are active", () => {
    const snapshot = {
      claude: makeState("claude", 62),
      codex: makeState("codex", 25),
    };
    const activity = resolveActivity(snapshot, "auto", {
      nowMs: now,
      activeThresholdMs: 15_000,
      workspaceFolders: [],
      focusedTerminalSource: null,
    });

    const text = renderStatusBarText(snapshot, {
      primaryMetric: "fiveHour",
      barWidth: 8,
      showIcon: false,
      nowMs: now,
      activity,
    });

    assert.match(text, /C .*│ X .*/);
    assert.match(text, /62%/);
    assert.match(text, /25%/);
  });

  it("renders unavailable when no data", () => {
    const activity = resolveActivity({ claude: null, codex: null }, "auto", {
      nowMs: now,
      activeThresholdMs: 15_000,
      workspaceFolders: [],
      focusedTerminalSource: null,
    });

    const text = renderStatusBarText(
      { claude: null, codex: null },
      {
        primaryMetric: "fiveHour",
        barWidth: 8,
        showIcon: true,
        activity,
      }
    );

    assert.match(text, /AI usage unavailable/);
  });

  it("renders stale when data is old", () => {
    const snapshot = {
      claude: makeState("claude", 62, now - STALE_THRESHOLD_MS - 1_000),
      codex: null,
    };
    const activity = resolveActivity(
      snapshot,
      "claude",
      {
        nowMs: now,
        activeThresholdMs: 15_000,
        workspaceFolders: [],
        focusedTerminalSource: null,
      },
      []
    );

    const text = renderStatusBarText(snapshot, {
      primaryMetric: "fiveHour",
      barWidth: 8,
      showIcon: true,
      nowMs: now,
      activity,
    });

    assert.match(text, /Claude usage stale/);
  });
});

describe("renderTooltip", () => {
  it("includes both sources in dual mode", () => {
    const snapshot = {
      claude: makeState("claude", 50),
      codex: makeState("codex", 25),
    };
    const activity = resolveActivity(snapshot, "both", {
      nowMs: now,
      activeThresholdMs: 15_000,
      workspaceFolders: [],
      focusedTerminalSource: null,
    });

    const tooltip = renderTooltip(snapshot, {
      primaryMetric: "fiveHour",
      barWidth: 8,
      showIcon: true,
      nowMs: now,
      activity,
    });

    assert.match(tooltip, /\[Claude\]/);
    assert.match(tooltip, /\[Codex\]/);
  });
});

describe("getPrimaryPercentage", () => {
  it("reads alternate metrics", () => {
    const state = makeState("claude", 62);
    assert.equal(getPrimaryPercentage(state, "sevenDay"), 20);
    assert.equal(getPrimaryPercentage(state, "context"), 10);
  });
});

describe("clampPercentage", () => {
  it("clamps and preserves null", () => {
    assert.equal(clampPercentage(120), 100);
    assert.equal(clampPercentage(null), null);
  });
});
