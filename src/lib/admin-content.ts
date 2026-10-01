import fs from "fs/promises";
import path from "path";
import { CONTENT_DIR, POSTS_DIR } from "../paths";
import { parseFrontmatter } from "./frontmatter";
import { getConfig } from "./content";
import { parseTagDef } from "./tags";

export type AdminKind = "post" | "page";

export interface AdminItem {
  slug: string;
  kind: AdminKind;
  title: string;
  date: string;
  tag: string;
  excerpt: string;
  image: string;
}

export interface AdminItemSource extends AdminItem {
  markdown: string;
}

export interface AdminWriteInput {
  title: string;
  date?: string;
  tag?: string;
  excerpt?: string;
  image?: string;
  markdown: string;
}

export interface AdminTag {
  key: string;
  label: string;
  color: string;
}

export class AdminContentError extends Error {}

// Matches the slug pattern used by the public loaders so the admin can never
// create a file the site would refuse to serve.
const SLUG_PATTERN = /^[a-z0-9-]+$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isSafeSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 120 && SLUG_PATTERN.test(slug);
}

function dirFor(kind: AdminKind): string {
  return kind === "post" ? POSTS_DIR : CONTENT_DIR;
}

function fileFor(kind: AdminKind, slug: string): string {
  return path.join(dirFor(kind), `${slug}.md`);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeMarkdown(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\s+$/, "");
}

/**
 * The frontmatter parser strips a single pair of surrounding quotes. If the
 * value already starts and ends with a quote character, wrap it in the other
 * quote style so the author's characters survive a round trip.
 */
function encodeValue(value: string): string {
  const single = value.replace(/\r?\n/g, " ").trim();
  const quoted =
    (single.startsWith('"') && single.endsWith('"')) ||
    (single.startsWith("'") && single.endsWith("'"));
  if (quoted) {
    const quote = single.startsWith('"') ? "'" : '"';
    return `${quote}${single}${quote}`;
  }
  return single;
}

function serializeDocument(
  fields: Array<[string, string]>,
  markdown: string,
): string {
  const lines = ["---"];
  for (const [key, value] of fields) {
    if (!value) continue;
    lines.push(`${key}: ${encodeValue(value)}`);
  }
  lines.push("---", "", markdown, "");
  return lines.join("\n");
}

export function listTags(): AdminTag[] {
  const tags = getConfig().posts.tags;
  const result: AdminTag[] = [];
  for (const [key, def] of Object.entries(tags)) {
    const parsed = parseTagDef(def);
    if (!parsed) continue;
    result.push({ key, label: parsed.label, color: parsed.color });
  }
  return result;
}

export function getDefaultTag(): string {
  return getConfig().posts.defaultTag;
}

export async function listItems(kind: AdminKind): Promise<AdminItem[]> {
  let files: string[];
  try {
    files = await fs.readdir(dirFor(kind));
  } catch {
    return [];
  }

  const items: AdminItem[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = file.slice(0, -3);
    if (!isSafeSlug(slug)) continue;
    const item = await readItem(kind, slug);
    if (item) items.push(item);
  }

  if (kind === "post") {
    items.sort(
      (a, b) =>
        (b.date || "").localeCompare(a.date || "") ||
        a.title.localeCompare(b.title),
    );
  } else {
    items.sort((a, b) => a.title.localeCompare(b.title));
  }

  return items;
}

export async function readItem(
  kind: AdminKind,
  slug: string,
): Promise<AdminItemSource | null> {
  if (!isSafeSlug(slug)) return null;

  try {
    const raw = await fs.readFile(fileFor(kind, slug), "utf8");
    const { data, content } = parseFrontmatter(raw);
    return {
      slug,
      kind,
      title: data.title || slug,
      date: data.date || "",
      tag: data.tag || "",
      excerpt: data.excerpt || "",
      image: data.image || "",
      markdown: normalizeMarkdown(content),
    };
  } catch {
    return null;
  }
}

export async function itemExists(
  kind: AdminKind,
  slug: string,
): Promise<boolean> {
  if (!isSafeSlug(slug)) return false;
  try {
    await fs.access(fileFor(kind, slug));
    return true;
  } catch {
    return false;
  }
}

export async function writeItem(
  kind: AdminKind,
  slug: string,
  input: AdminWriteInput,
): Promise<{ created: boolean }> {
  if (!isSafeSlug(slug)) {
    throw new AdminContentError(
      "Slug must be lowercase letters, numbers, and hyphens.",
    );
  }

  const title = (input.title ?? "").trim();
  if (!title) {
    throw new AdminContentError("Title is required.");
  }

  const fields: Array<[string, string]> = [["title", title]];

  if (kind === "post") {
    const date = (input.date ?? "").trim();
    if (date && !DATE_PATTERN.test(date)) {
      throw new AdminContentError("Date must be in YYYY-MM-DD format.");
    }
    fields.push(["date", date || todayIso()]);

    const tag = (input.tag ?? "").trim().toLowerCase();
    const tags = getConfig().posts.tags;
    if (!Object.prototype.hasOwnProperty.call(tags, tag)) {
      throw new AdminContentError("Choose a valid post tag.");
    }
    fields.push(["tag", tag]);
  }

  if (input.excerpt?.trim()) fields.push(["excerpt", input.excerpt]);
  if (input.image?.trim()) fields.push(["image", input.image]);

  const document = serializeDocument(
    fields,
    normalizeMarkdown(input.markdown ?? ""),
  );
  const target = fileFor(kind, slug);

  const created = !(await itemExists(kind, slug));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, document, "utf8");
  return { created };
}

export async function deleteItem(
  kind: AdminKind,
  slug: string,
): Promise<boolean> {
  if (!isSafeSlug(slug)) return false;
  try {
    await fs.unlink(fileFor(kind, slug));
    return true;
  } catch {
    return false;
  }
}
