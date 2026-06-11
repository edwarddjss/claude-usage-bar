import type { UsageSource } from "./types";

const CLAUDE_PATTERN = /(?:^|[/\\])claude(?:\s|$|")|claude-code|@anthropic\/claude-code/i;
const CODEX_PATTERN = /(?:^|[/\\])codex(?:\s|$|")|@openai\/codex/i;

export function detectSourceFromCommand(commandLine: string | undefined): UsageSource | null {
  if (!commandLine) {
    return null;
  }

  const normalized = commandLine.trim();
  if (!normalized) {
    return null;
  }

  const claudeMatch = CLAUDE_PATTERN.test(normalized);
  const codexMatch = CODEX_PATTERN.test(normalized);

  if (claudeMatch && !codexMatch) {
    return "claude";
  }

  if (codexMatch && !claudeMatch) {
    return "codex";
  }

  return null;
}
