"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveActivity,
  isSourceLive,
  isClaudeConnectedToWorkspace,
} = require("../out/activity");

const now = Date.now();

function makeState(source, updatedAt = now) {
  return {
    source,
    updatedAt,
    fiveHour: { usedPercentage: 50, resetsAt: updatedAt + 3_600_000 },
  };
}

describe("isSourceLive", () => {
  it("detects recent updates", () => {
    assert.equal(isSourceLive(makeState("claude", now - 5_000), 15_000, now), true);
    assert.equal(isSourceLive(makeState("claude", now - 60_000), 15_000, now), false);
  });
});

describe("isClaudeConnectedToWorkspace", () => {
  it("matches workspace folders from IDE lock files", () => {
    const locks = [
      {
        pid: 1,
        workspaceFolders: ["/home/nazk/Projects/claude-usage-bar"],
      },
    ];

    assert.equal(
      isClaudeConnectedToWorkspace(locks, ["/home/nazk/Projects/claude-usage-bar"]),
      true
    );
    assert.equal(isClaudeConnectedToWorkspace(locks, ["/tmp/other"]), false);
  });
});

describe("resolveActivity", () => {
  it("prefers focused terminal source in auto mode", () => {
    const snapshot = {
      claude: makeState("claude"),
      codex: makeState("codex"),
    };

    const activity = resolveActivity(snapshot, "auto", {
      nowMs: now,
      activeThresholdMs: 15_000,
      workspaceFolders: [],
      focusedTerminalSource: "codex",
    });

    assert.equal(activity.showCodex, true);
    assert.equal(activity.showClaude, false);
    assert.equal(activity.primarySource, "codex");
  });

  it("shows dual view when both sources are live", () => {
    const snapshot = {
      claude: makeState("claude"),
      codex: makeState("codex"),
    };

    const activity = resolveActivity(snapshot, "auto", {
      nowMs: now,
      activeThresholdMs: 15_000,
      workspaceFolders: [],
      focusedTerminalSource: null,
    });

    assert.equal(activity.mode, "dual");
    assert.equal(activity.showClaude, true);
    assert.equal(activity.showCodex, true);
  });

  it("uses Claude IDE lock as active signal", () => {
    const snapshot = {
      claude: makeState("claude", now - 120_000),
      codex: null,
    };

    const locks = [
      {
        pid: 1,
        workspaceFolders: ["/home/nazk/Projects/claude-usage-bar"],
      },
    ];

    const activity = resolveActivity(
      snapshot,
      "auto",
      {
        nowMs: now,
        activeThresholdMs: 15_000,
        workspaceFolders: ["/home/nazk/Projects/claude-usage-bar"],
        focusedTerminalSource: null,
      },
      locks
    );

    assert.equal(activity.claudeConnected, true);
    assert.equal(activity.showClaude, true);
  });
});
