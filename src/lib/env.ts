import fs from "fs";
import path from "path";

/**
 * Minimal, dependency-free `.env` loader.
 *
 * Variables already present in the environment always win, so values injected
 * by Docker Compose / the host are never overridden. The file is looked up in
 * the current working directory first, then at the project root (useful when
 * the server is launched from a different directory).
 */
export function loadEnvFile(directory: string): boolean {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(directory, ".env"), "utf8");
  } catch {
    return false;
  }

  for (const line of raw.split(/\r?\n/)) {
    let entry = line.trim();
    if (!entry || entry.startsWith("#")) continue;
    if (entry.startsWith("export ")) entry = entry.slice(7).trim();

    const separator = entry.indexOf("=");
    if (separator === -1) continue;

    const key = entry.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = entry.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    if (quoted) {
      value = value.slice(1, -1);
    } else {
      const comment = value.indexOf(" #");
      if (comment !== -1) value = value.slice(0, comment).trim();
    }

    process.env[key] = value;
  }

  return true;
}

function findProjectRoot(): string {
  // Compiled location is build/lib/env.js → project root is two levels up.
  return path.join(__dirname, "..", "..");
}

const candidates = [process.cwd(), findProjectRoot()];
for (const directory of new Set(candidates)) {
  if (loadEnvFile(directory)) break;
}
