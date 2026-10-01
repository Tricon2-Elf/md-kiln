import fs from "fs/promises";
import { z } from "zod";
import { CONFIG_PATH } from "../paths";
import { getConfig } from "./content";
import { navLinkSchema, validateConfig } from "./config-schema";
import type { NavLink } from "./config-schema";

export class AdminConfigError extends Error {}

export function readNavLinks(): NavLink[] {
  return getConfig().nav.links;
}

function parseNavLinks(input: unknown): NavLink[] {
  if (!Array.isArray(input)) {
    throw new AdminConfigError("Navigation links must be a list.");
  }

  const result = z.array(navLinkSchema).safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new AdminConfigError(
      `Invalid navigation link — ${where}${issue?.message ?? "invalid entry"}`,
    );
  }

  return result.data;
}

/**
 * Replace `nav.links` in config.json. Other fields are preserved as-is (the
 * raw parsed file is written back, not the Zod-normalised object, so key order
 * and passthrough data survive). The file watcher rebuilds the site afterwards.
 */
export async function updateNavLinks(input: unknown): Promise<NavLink[]> {
  const links = parseNavLinks(input);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8")) as Record<
      string,
      unknown
    >;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AdminConfigError(`Could not read config.json: ${message}`);
  }

  const nav =
    parsed.nav && typeof parsed.nav === "object"
      ? (parsed.nav as Record<string, unknown>)
      : {};
  nav.links = links;
  parsed.nav = nav;

  // Re-validate the whole document so a bad edit can never break the build.
  validateConfig(parsed);

  await fs.writeFile(
    CONFIG_PATH,
    `${JSON.stringify(parsed, null, 2)}\n`,
    "utf8",
  );

  return links;
}
