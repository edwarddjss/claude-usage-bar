const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it } = require("node:test");

const {
  readStateFileFingerprint,
  sameFingerprint,
} = require("../out/stateFileFingerprint");

describe("state file fingerprints", () => {
  it("compares metadata without requiring content hashes", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headroom-fingerprint-"));
    const filePath = path.join(dir, "state.json");
    fs.writeFileSync(filePath, "{\"value\":1}");

    const withContent = readStateFileFingerprint(filePath, true);
    const metadataOnly = readStateFileFingerprint(filePath, false);

    assert.equal(sameFingerprint(withContent, metadataOnly, false), true);
  });

  it("detects content changes when metadata is unchanged", () => {
    const previous = {
      exists: true,
      mtimeMs: 100,
      size: 10,
      contentHash: "one",
    };
    const next = {
      exists: true,
      mtimeMs: 100,
      size: 10,
      contentHash: "two",
    };

    assert.equal(sameFingerprint(previous, next, true), false);
  });

  it("treats missing files as stable after the first missing fingerprint", () => {
    const missing = path.join(os.tmpdir(), `headroom-missing-${Date.now()}.json`);
    const first = readStateFileFingerprint(missing, true);
    const second = readStateFileFingerprint(missing, true);

    assert.equal(sameFingerprint(first, second, true), true);
  });
});
