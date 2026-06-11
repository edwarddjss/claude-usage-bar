#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const BRIDGE_DIR = path.join(os.homedir(), ".ai-usage-bridge");

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeTimestamp(value) {
  const numeric = toNumber(value);
  if (numeric != null) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * @param {string} filePath
 * @param {Record<string, unknown>} state
 */
function writeStateAtomically(filePath, state) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  const tempPath = path.join(
    directory,
    `${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  const payload = `${JSON.stringify(state, null, 2)}\n`;

  fs.writeFileSync(tempPath, payload, "utf8");
  fs.renameSync(tempPath, filePath);
}

/**
 * @param {number|null|undefined} percentage
 * @returns {string}
 */
function formatPercentage(percentage) {
  if (percentage == null || !Number.isFinite(percentage)) {
    return "?%";
  }

  return `${Math.round(Math.max(0, Math.min(100, percentage)))}%`;
}

/**
 * @param {string} raw
 * @returns {Record<string, unknown>|null}
 */
function parseInput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

module.exports = {
  BRIDGE_DIR,
  toNumber,
  normalizeTimestamp,
  writeStateAtomically,
  formatPercentage,
  parseInput,
};
