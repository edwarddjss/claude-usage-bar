import * as os from "os";
import * as path from "path";

export function expandHome(filePath: string): string {
  if (!filePath) {
    return filePath;
  }

  if (filePath === "~") {
    return os.homedir();
  }

  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }

  return filePath;
}

export function pathDirname(filePath: string): string {
  return path.dirname(expandHome(filePath));
}

export function pathBasename(filePath: string): string {
  return path.basename(filePath);
}

export function toTildePath(filePath: string): string {
  const home = os.homedir();
  if (filePath === home) {
    return "~";
  }

  if (filePath.startsWith(`${home}/`) || filePath.startsWith(`${home}\\`)) {
    return `~${filePath.slice(home.length)}`.replace(/\\/g, "/");
  }

  return filePath;
}
