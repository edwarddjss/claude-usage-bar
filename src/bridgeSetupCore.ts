import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface BridgePaths {
  claudeDir: string;
  codexDir: string;
  claudeBridge: string;
  codexBridge: string;
  codexPoller: string;
}

export interface BridgeSetupStatus {
  scriptsInstalled: boolean;
  claudeConfigured: boolean;
  codexConfigured: boolean;
}

export interface BridgeInstallResult extends BridgeSetupStatus {
  errors: string[];
}

const BRIDGE_SCRIPT_TARGETS = [
  { dirKey: "claudeDir" as const, files: ["bridge-common.js", "claude-status-bridge.js"] },
  {
    dirKey: "codexDir" as const,
    files: ["bridge-common.js", "codex-status-bridge.js", "codex-usage-poller.js"],
  },
];

export function getBridgePaths(): BridgePaths {
  const claudeDir = path.join(os.homedir(), ".claude");
  const codexDir = path.join(os.homedir(), ".codex");

  return {
    claudeDir,
    codexDir,
    claudeBridge: path.join(claudeDir, "claude-status-bridge.js"),
    codexBridge: path.join(codexDir, "codex-status-bridge.js"),
    codexPoller: path.join(codexDir, "codex-usage-poller.js"),
  };
}

/** Absolute path with forward slashes — works in Node on Windows, macOS, and Linux. */
export function formatNodeCommand(scriptPath: string): string {
  const isWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(scriptPath);
  const isPosixAbsolute = scriptPath.startsWith("/");
  const absolute = isWindowsAbsolute || isPosixAbsolute ? scriptPath : path.resolve(scriptPath);
  const normalized = absolute.replace(/\\/g, "/");
  return `node "${normalized}"`;
}

export function mergeClaudeSettings(
  existing: Record<string, unknown>,
  statusLineCommand: string
): Record<string, unknown> {
  return {
    ...existing,
    statusLine: {
      type: "command",
      command: statusLineCommand,
      refreshInterval: 1,
    },
  };
}

export function checkBridgeSetupStatus(paths: BridgePaths = getBridgePaths()): BridgeSetupStatus {
  const scriptsInstalled =
    fs.existsSync(paths.claudeBridge) &&
    fs.existsSync(paths.codexBridge) &&
    fs.existsSync(paths.codexPoller);

  const claudeConfigured = isClaudeStatusLineConfigured(paths.claudeBridge);
  const codexConfigured = scriptsInstalled;

  return { scriptsInstalled, claudeConfigured, codexConfigured };
}

export function removeLegacyCodexHookConfig(existingToml: string): {
  changed: boolean;
  content: string;
} {
  const lines = existingToml.split(/\r?\n/);
  const output: string[] = [];
  let index = 0;
  let changed = false;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed.startsWith("[hooks") && trimmed !== "[[hooks]]") {
      output.push(line);
      index += 1;
      continue;
    }

    const block: string[] = [line];
    index += 1;

    while (index < lines.length && !lines[index].trim().startsWith("[")) {
      block.push(lines[index]);
      index += 1;
    }

    const blockText = block.join("\n");
    if (blockText.includes("codex-status-bridge.js")) {
      changed = true;
      continue;
    }

    output.push(...block);
  }

  if (!changed) {
    return { changed: false, content: existingToml };
  }

  return { changed: true, content: `${output.join("\n").trimEnd()}\n` };
}

export function cleanupLegacyCodexHook(codexDir: string): boolean {
  const configPath = path.join(codexDir, "config.toml");
  if (!fs.existsSync(configPath)) {
    return false;
  }

  const existing = fs.readFileSync(configPath, "utf8");
  const result = removeLegacyCodexHookConfig(existing);
  if (!result.changed) {
    return false;
  }

  fs.writeFileSync(configPath, result.content, "utf8");
  return true;
}

export function configureClaudeStatusLine(claudeBridgePath: string): boolean {
  const settingsPath = path.join(path.dirname(claudeBridgePath), "settings.json");
  const command = formatNodeCommand(claudeBridgePath);

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    existing = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
  }

  const merged = mergeClaudeSettings(existing, command);
  if (JSON.stringify(existing.statusLine) === JSON.stringify(merged.statusLine)) {
    return false;
  }

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return true;
}

function isClaudeStatusLineConfigured(claudeBridgePath: string): boolean {
  const settingsPath = path.join(path.dirname(claudeBridgePath), "settings.json");
  if (!fs.existsSync(settingsPath)) {
    return false;
  }

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
    const statusLine = settings.statusLine;
    if (!statusLine || typeof statusLine !== "object") {
      return false;
    }

    const command = (statusLine as Record<string, unknown>).command;
    return typeof command === "string" && command.includes("claude-status-bridge.js");
  } catch {
    return false;
  }
}

export function ensureBridgeStateDir(): void {
  const bridgeDir = path.join(os.homedir(), ".ai-usage-bridge");
  fs.mkdirSync(bridgeDir, { recursive: true });
}

export function installBridgeScriptsToDisk(extensionPath: string): BridgeInstallResult {
  const paths = getBridgePaths();
  const scriptsDir = path.join(extensionPath, "scripts");
  const errors: string[] = [];

  ensureBridgeStateDir();

  for (const target of BRIDGE_SCRIPT_TARGETS) {
    const dir = paths[target.dirKey];
    fs.mkdirSync(dir, { recursive: true });

    for (const file of target.files) {
      try {
        const source = path.join(scriptsDir, file);
        const destination = path.join(dir, file);
        fs.copyFileSync(source, destination);

        if (process.platform !== "win32") {
          try {
            fs.chmodSync(destination, 0o755);
          } catch {
            // Non-fatal on platforms with limited chmod support.
          }
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  let claudeConfigured = false;
  try {
    claudeConfigured = configureClaudeStatusLine(paths.claudeBridge);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    cleanupLegacyCodexHook(paths.codexDir);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const status = checkBridgeSetupStatus(paths);
  return {
    scriptsInstalled: status.scriptsInstalled,
    claudeConfigured: status.claudeConfigured || claudeConfigured,
    codexConfigured: status.codexConfigured,
    errors,
  };
}
