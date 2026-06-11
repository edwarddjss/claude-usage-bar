"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { detectSourceFromCommand } = require("../out/detectSource");

describe("detectSourceFromCommand", () => {
  it("detects Claude commands", () => {
    assert.equal(detectSourceFromCommand("claude"), "claude");
    assert.equal(detectSourceFromCommand("/usr/bin/claude --dangerously-skip-permissions"), "claude");
  });

  it("detects Codex commands", () => {
    assert.equal(detectSourceFromCommand("codex"), "codex");
    assert.equal(detectSourceFromCommand("npx @openai/codex"), "codex");
  });

  it("returns null for unrelated commands", () => {
    assert.equal(detectSourceFromCommand("pnpm test"), null);
    assert.equal(detectSourceFromCommand(""), null);
  });
});
