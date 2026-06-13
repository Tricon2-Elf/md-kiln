import fs from 'fs/promises';
import path from 'path';
import { CONFIG_PATH, CONTENT_DIR, POSTS_DIR } from '../paths';
import { renderMarkdown, normalizeImagePath } from './utils';
import { validateConfig } from './validate-config';
import { parseTagDef } from './tags';
import type { AppConfig } from '../types/config';
import type {
  ContentPage,
  FrontmatterResult,
  ParsedTag,
  Post,
  PostSummary,
} from '../types/content';

let config: AppConfig | undefined;

function parseFrontmatter(content: string): FrontmatterResult {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
  if (!match) return { data: {}, content };

  const data: Record<string, string> = {};
  const frontmatter = match[1];
  const body = match[2];
  if (!frontmatter) return { data: {}, content: body ?? content };

  for (const line of frontmatter.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { data, content: body ?? '' };
}

function resolvePostTag(tagKey: string | undefined): ParsedTag {
  const tags = config!.posts.tags;
  const defaultKey = config!.posts.defaultTag;
  const key = (tagKey || defaultKey || '').trim().toLowerCase();

  if (!key || !tags[key]) {
    const valid = Object.keys(tags).join(', ');
    const slug = tagKey ? `"${tagKey}"` : '(empty)';
    throw new Error(`Unknown post tag ${slug}. Valid tags: ${valid}`);
  }

  const parsed = parseTagDef(tags[key]);
  if (!parsed) {
    throw new Error(`Invalid tag definition for "${key}"`);
  }

  const { label, color } = parsed;
  return { key, label, color };
}

function parsePost(raw: string, slug: string): Post {
  const { data, content } = parseFrontmatter(raw);
  const body = content.trim();
  const { key, label, color } = resolvePostTag(data.tag);

  return {
    slug,
    title: data.title || 'Untitled',
    date: data.date || '',
    tag: label,
    tagKey: key,
    tagColor: color,
    excerpt: data.excerpt || '',
    image: normalizeImagePath(data.image),
    body,
    html: renderMarkdown(body),
  };
}

export async function loadConfig(): Promise<AppConfig> {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  validateConfig(parsed);
  config = parsed;
  return config;
}

export function getConfig(): AppConfig {
  if (!config) {
    throw new Error('Config not loaded. Call loadConfig() first.');
  }
  return config;
}

export function hasSidebar(): boolean {
  const sidebar = config?.sidebar;
  if (!sidebar) return false;
  return Boolean(sidebar.cta?.enabled || sidebar.status?.enabled);
}

export async function loadPosts(): Promise<PostSummary[]> {
  let files: string[];
  try {
    files = await fs.readdir(POSTS_DIR);
  } catch {
    return [];
  }

  const posts: PostSummary[] = [];
  for (const file of files.filter((f) => f.endsWith('.md'))) {
    const slug = file.replace(/\.md$/, '');
    const raw = await fs.readFile(path.join(POSTS_DIR, file), 'utf8');
    const post = parsePost(raw, slug);
    posts.push({
      slug: post.slug,
      title: post.title,
      date: post.date,
      tag: post.tag,
      tagKey: post.tagKey,
      tagColor: post.tagColor,
      excerpt: post.excerpt,
      image: post.image,
    });
  }

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function loadPost(slug: string): Promise<Post | null> {
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;

  try {
    const raw = await fs.readFile(path.join(POSTS_DIR, `${slug}.md`), 'utf8');
    return parsePost(raw, slug);
  } catch {
    return null;
  }
}

export async function loadContent(slug: string): Promise<ContentPage | null> {
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;

  try {
    const raw = await fs.readFile(path.join(CONTENT_DIR, `${slug}.md`), 'utf8');
    const { data, content } = parseFrontmatter(raw);
    const body = content.trim();
    return {
      slug,
      title: data.title || slug,
      image: normalizeImagePath(data.image),
      body,
      html: renderMarkdown(body),
    };
  } catch {
    return null;
  }
}

export async function listContentSlugs(): Promise<string[]> {
  try {
    const files = await fs.readdir(CONTENT_DIR);
    return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

export { CONFIG_PATH, POSTS_DIR, CONTENT_DIR };
