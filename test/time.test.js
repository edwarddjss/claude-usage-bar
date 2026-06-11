"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  formatTimeRemaining,
  formatResetTime,
  formatLastUpdated,
  isStale,
  normalizeTimestamp,
  STALE_THRESHOLD_MS,
} = require("../out/time");

describe("formatTimeRemaining", () => {
  const now = 1_700_000_000_000;

  it("formats minutes", () => {
    assert.equal(formatTimeRemaining(now + 30 * 60_000, now), "30m");
  });

  it("formats hours and minutes", () => {
    assert.equal(formatTimeRemaining(now + 2 * 3_600_000 + 15 * 60_000, now), "2h 15m");
  });

  it("handles unknown and past values", () => {
    assert.equal(formatTimeRemaining(null, now), "unknown");
    assert.equal(formatTimeRemaining(now - 1_000, now), "now");
  });
});

describe("formatLastUpdated", () => {
  const now = 1_700_000_000_000;

  it("formats relative times", () => {
    assert.equal(formatLastUpdated(now - 2_000, now), "just now");
    assert.equal(formatLastUpdated(now - 10_000, now), "10s ago");
    assert.equal(formatLastUpdated(now - 90_000, now), "1m ago");
  });
});

describe("isStale", () => {
  const now = 1_700_000_000_000;

  it("detects stale data", () => {
    assert.equal(isStale(now - STALE_THRESHOLD_MS - 1, now), true);
    assert.equal(isStale(now - 30_000, now), false);
    assert.equal(isStale(null, now), true);
  });
});

describe("normalizeTimestamp", () => {
  it("converts seconds to milliseconds", () => {
    assert.equal(normalizeTimestamp(1_700_000_000), 1_700_000_000_000);
  });

  it("keeps millisecond timestamps", () => {
    assert.equal(normalizeTimestamp(1_700_000_000_000), 1_700_000_000_000);
  });
});
