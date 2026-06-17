export interface FrontmatterResult {
  data: Record<string, string>;
  content: string;
}

const FRONTMATTER_PATTERN =
  /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/;

function parseValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseFrontmatter(content: string): FrontmatterResult {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    return { data: {}, content };
  }

  const frontmatter = match[1];
  const body = match[2] ?? "";
  const data: Record<string, string> = {};

  if (!frontmatter) {
    return { data, content: body };
  }

  for (const line of frontmatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    const value = parseValue(line.slice(idx + 1));
    if (key) {
      data[key] = value;
    }
  }

  return { data, content: body };
}
