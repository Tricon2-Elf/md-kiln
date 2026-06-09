const fs = require('fs').promises;
const path = require('path');
const { renderMarkdown } = require('./utils');
const { validateConfig } = require('./validate-config');
const { parseTagDef } = require('./tags');

const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, '..', 'config.json');
const POSTS_DIR = process.env.POSTS_DIR || path.join(__dirname, '..', 'posts');
const CONTENT_DIR = process.env.CONTENT_DIR || path.join(__dirname, '..', 'content');

let config;

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
  if (!match) return { data: {}, content };

  const data = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { data, content: match[2] };
}

function normalizeImagePath(image) {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/')) return image;
  return `/${image}`;
}

function resolvePostTag(tagKey) {
  const tags = config.posts?.tags || {};
  const defaultKey = config.posts?.defaultTag;
  const key = (tagKey || defaultKey || '').trim().toLowerCase();

  if (!key || !tags[key]) {
    const valid = Object.keys(tags).join(', ');
    const slug = tagKey ? `"${tagKey}"` : '(empty)';
    throw new Error(`Unknown post tag ${slug}. Valid tags: ${valid}`);
  }

  const { label, color } = parseTagDef(tags[key]);
  return { key, label, color };
}

function parsePost(raw, slug) {
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

async function loadConfig() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  config = JSON.parse(raw);
  validateConfig(config);
  return config;
}

function getConfig() {
  return config;
}

function hasSidebar() {
  return config.sidebar.cta.enabled || config.sidebar.status.enabled;
}

async function loadPosts() {
  let files;
  try {
    files = await fs.readdir(POSTS_DIR);
  } catch {
    return [];
  }

  const posts = [];
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

  return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function loadPost(slug) {
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;

  try {
    const raw = await fs.readFile(path.join(POSTS_DIR, `${slug}.md`), 'utf8');
    return parsePost(raw, slug);
  } catch {
    return null;
  }
}

async function loadContent(slug) {
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

async function listContentSlugs() {
  try {
    const files = await fs.readdir(CONTENT_DIR);
    return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

module.exports = {
  CONFIG_PATH,
  POSTS_DIR,
  CONTENT_DIR,
  loadConfig,
  getConfig,
  hasSidebar,
  loadPosts,
  loadPost,
  loadContent,
  listContentSlugs,
};
