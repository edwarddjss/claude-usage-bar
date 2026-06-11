"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  clampPercentage,
  renderProgressBar,
  formatPercentage,
  formatRemainingPercentage,
  renderStatusBarText,
  renderTooltip,
  getPrimaryPercentage,
  getPrimaryRemainingPercentage,
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
      displayMode: "claude",
      nowMs: now,
      activity,
    });

    assert.match(text, /Claude 5h ███░░░░░ 38% left/);
  });

  it("renders dual split view when both have data", () => {
    const snapshot = {
      claude: makeState("claude", 62),
      codex: makeState("codex", 25),
    };

    const text = renderStatusBarText(snapshot, {
      primaryMetric: "fiveHour",
      barWidth: 8,
      showIcon: false,
      displayMode: "both",
      nowMs: now,
    });

    assert.match(text, /Claude .*│ Codex .*/);
    assert.match(text, /38% left/);
    assert.match(text, /75% left/);
  });

  it("renders unavailable when no data", () => {
    const text = renderStatusBarText(
      { claude: null, codex: null },
      {
        primaryMetric: "fiveHour",
        barWidth: 8,
        showIcon: true,
        displayMode: "auto",
      }
    );

    assert.match(text, /No usage data/);

    const waiting = renderStatusBarText(
      { claude: null, codex: null },
      {
        primaryMetric: "fiveHour",
        barWidth: 8,
        showIcon: true,
        displayMode: "auto",
        bridgeConfigured: true,
      }
    );
    assert.match(waiting, /Start Claude or Codex/);
  });

  it("keeps percentages visible when data is stale", () => {
    const snapshot = {
      claude: makeState("claude", 62, now - STALE_THRESHOLD_MS - 1_000),
      codex: null,
    };

    const text = renderStatusBarText(snapshot, {
      primaryMetric: "fiveHour",
      barWidth: 8,
      showIcon: true,
      displayMode: "claude",
      nowMs: now,
    });

    assert.match(text, /38% left/);
    assert.match(text, /left/);
    assert.doesNotMatch(text, /usage unavailable/);
  });

  it("keeps stale expired reset windows numeric instead of showing refresh", () => {
    const snapshot = {
      claude: {
        ...makeState("claude", 21, now - STALE_THRESHOLD_MS - 1_000),
        fiveHour: { usedPercentage: 21, resetsAt: now - 60_000 },
      },
      codex: null,
    };

    const text = renderStatusBarText(snapshot, {
      primaryMetric: "fiveHour",
      barWidth: 8,
      showIcon: true,
      displayMode: "claude",
      nowMs: now,
    });

    assert.match(text, /Claude 5h .*79% left/);
    assert.doesNotMatch(text, /refresh/);
  });

  it("floors Codex remaining usage to match displayed used percentage", () => {
    const snapshot = {
      claude: null,
      codex: makeState("codex", 7),
    };

    const text = renderStatusBarText(snapshot, {
      primaryMetric: "fiveHour",
      barWidth: 8,
      showIcon: false,
      displayMode: "codex",
      nowMs: now,
    });

    assert.match(text, /Codex 5h .*93% left/);
    assert.doesNotMatch(text, /94% left/);
  });

  it("floors remaining percentages to avoid overstating headroom", () => {
    const snapshot = {
      claude: makeState("claude", 5.4),
      codex: null,
    };

    const text = renderStatusBarText(snapshot, {
      primaryMetric: "fiveHour",
      barWidth: 8,
      showIcon: false,
      displayMode: "claude",
      nowMs: now,
    });

    assert.match(text, /94% left/);
    assert.doesNotMatch(text, /95% left/);
  });
});

describe("renderTooltip", () => {
  it("includes both sources when present", () => {
    const snapshot = {
      claude: makeState("claude", 50),
      codex: makeState("codex", 25),
    };

    const tooltip = renderTooltip(snapshot, {
      primaryMetric: "fiveHour",
      barWidth: 8,
      showIcon: true,
      nowMs: now,
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

describe("getPrimaryRemainingPercentage", () => {
  it("shows remaining headroom for visible status text", () => {
    const state = makeState("claude", 62);
    assert.equal(getPrimaryRemainingPercentage(state, "fiveHour"), 38);
    assert.equal(getPrimaryRemainingPercentage(state, "sevenDay"), 80);
    assert.equal(getPrimaryRemainingPercentage(state, "context"), 90);
  });
});

describe("clampPercentage", () => {
  it("clamps and preserves null", () => {
    assert.equal(clampPercentage(120), 100);
    assert.equal(clampPercentage(null), null);
  });
});

describe("formatRemainingPercentage", () => {
  it("floors remaining headroom", () => {
    assert.equal(formatRemainingPercentage(94.6), "94%");
    assert.equal(formatPercentage(94.6), "95%");
  });
});
