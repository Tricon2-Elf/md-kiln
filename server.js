const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { runStatusPlugin } = require('./plugins');
const { renderMarkdown } = require('./lib/markdown');
const { formatDate } = require('./lib/format');

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, 'config.json');
const POSTS_DIR = process.env.POSTS_DIR || path.join(__dirname, 'posts');
const CONTENT_DIR = process.env.CONTENT_DIR || path.join(__dirname, 'content');

let config;

async function loadConfig() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  config = JSON.parse(raw);
  return config;
}

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

function parsePost(raw, slug) {
  const { data, content } = parseFrontmatter(raw);
  const body = content.trim();
  return {
    slug,
    title: data.title || 'Untitled',
    date: data.date || '',
    tag: data.tag || 'News',
    excerpt: data.excerpt || '',
    image: normalizeImagePath(data.image),
    body,
    html: renderMarkdown(body),
  };
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
      excerpt: post.excerpt,
      image: post.image,
    });
  }

  return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function loadPost(slug) {
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;

  const filePath = path.join(POSTS_DIR, `${slug}.md`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return parsePost(raw, slug);
  } catch {
    return null;
  }
}

async function loadContent(slug) {
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;

  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
  res.locals.config = config;
  res.locals.formatDate = formatDate;
  res.locals.hasSidebar = config.sidebar.cta.enabled || config.sidebar.status.enabled;
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/api/status', async (_req, res) => {
  const statusConfig = config.status;
  if (!statusConfig?.plugin) {
    return res.json({ online: false, metrics: {} });
  }

  try {
    const result = await runStatusPlugin(statusConfig.plugin, statusConfig.options || {});
    res.json(result);
  } catch (err) {
    console.error('Status plugin error:', err.message);
    res.json({ online: false, metrics: {} });
  }
});

app.get('/news/:slug', async (req, res) => {
  const post = await loadPost(req.params.slug);
  if (!post) {
    return res.status(404).render('not-found', {
      title: `Not Found — ${config.site.name}`,
      active: null,
    });
  }

  res.render('article', {
    article: post,
    showMeta: true,
    title: `${post.title} — ${config.site.name}`,
    active: null,
  });
});

app.get('*', async (req, res) => {
  const slug = req.path.slice(1).replace(/\/$/, '');

  if (!slug) {
    return res.render('home', {
      posts: await loadPosts(),
      active: 'home',
    });
  }

  const page = await loadContent(slug);
  if (page) {
    return res.render('article', {
      article: page,
      showMeta: false,
      title: `${page.title} — ${config.site.name}`,
      active: slug === 'about' ? 'about' : null,
    });
  }

  res.render('home', {
    posts: await loadPosts(),
    active: 'home',
  });
});

loadConfig()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`${config.site.name} running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to load config:', err.message);
    process.exit(1);
  });
