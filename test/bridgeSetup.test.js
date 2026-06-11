"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  formatNodeCommand,
  mergeClaudeSettings,
  removeLegacyCodexHookConfig,
} = require("../out/bridgeSetupCore.js");

describe("formatNodeCommand", () => {
  it("quotes absolute paths for Windows-safe node invocation", () => {
    const command = formatNodeCommand("C:\\Users\\gianl\\.claude\\claude-status-bridge.js");
    assert.equal(command, 'node "C:/Users/gianl/.claude/claude-status-bridge.js"');
  });

  it("normalizes posix paths", () => {
    const command = formatNodeCommand("/home/nazk/.claude/claude-status-bridge.js");
    assert.equal(command, 'node "/home/nazk/.claude/claude-status-bridge.js"');
  });
});

describe("mergeClaudeSettings", () => {
  it("adds statusLine while preserving other settings", () => {
    const merged = mergeClaudeSettings(
      { theme: "dark" },
      'node "C:/Users/gianl/.claude/claude-status-bridge.js"'
    );

    assert.equal(merged.theme, "dark");
    assert.deepEqual(merged.statusLine, {
      type: "command",
      command: 'node "C:/Users/gianl/.claude/claude-status-bridge.js"',
      refreshInterval: 1,
    });
  });
});

describe("removeLegacyCodexHookConfig", () => {
  it("removes only the old codex-status-bridge hook block", () => {
    const existing = [
      'model = "gpt-5"',
      "",
      "[[hooks]]",
      'event = "AfterAgent"',
      'command = "node /home/nazk/.codex/codex-status-bridge.js"',
      "",
      "[tools]",
      'web_search = true',
      "",
    ].join("\n");

    const result = removeLegacyCodexHookConfig(existing);

    assert.equal(result.changed, true);
    assert.doesNotMatch(result.content, /codex-status-bridge/);
    assert.match(result.content, /model = "gpt-5"/);
    assert.match(result.content, /\[tools\]/);
    assert.match(result.content, /web_search = true/);
  });

  it("keeps unrelated hook blocks", () => {
    const existing = [
      "[[hooks]]",
      'event = "AfterAgent"',
      'command = "echo done"',
      "",
    ].join("\n");

    const result = removeLegacyCodexHookConfig(existing);

    assert.equal(result.changed, false);
    assert.equal(result.content, existing);
  });
});
