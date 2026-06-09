const fs = require('fs').promises;
const path = require('path');
const ejs = require('ejs');
const { formatDate, minifyHtml, getThemeVars } = require('./utils');
const { prepareNavIcons, getNavLinks } = require('./nav');
const { buildRssFeed, buildSitemap } = require('./feeds');
const {
  loadConfig,
  getConfig,
  hasSidebar,
  loadPosts,
  loadPost,
  loadContent,
  listContentSlugs,
} = require('./content');

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '..', 'dist');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const VIEWS_DIR = path.join(__dirname, '..', 'views');

function templateLocals(extra = {}) {
  const config = getConfig();
  const activePath = extra.activePath ?? null;

  return {
    config,
    formatDate,
    hasSidebar: hasSidebar(),
    theme: getThemeVars(config.theme),
    ...extra,
    navLinks: getNavLinks(config.nav?.links, activePath),
  };
}

function renderTemplate(name, locals) {
  const file = path.join(VIEWS_DIR, `${name}.ejs`);
  return ejs.renderFile(file, templateLocals(locals), {
    views: [VIEWS_DIR],
  });
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }),
  );
}

async function copyStaticAssets() {
  try {
    await fs.access(ASSETS_DIR);
  } catch {
    return;
  }

  await copyDir(ASSETS_DIR, OUTPUT_DIR);
}

async function cleanOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let entries;
  try {
    entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }

  await Promise.all(
    entries.map(async (entry) => {
      // Keep cached nav icons across rebuilds (dist/img/links/cached).
      if (entry.name === 'img') return;

      const full = path.join(OUTPUT_DIR, entry.name);
      await fs.rm(full, { recursive: true, force: true });
    }),
  );
}

async function writeFile(urlPath, contents, { minify = true } = {}) {
  const outFile = urlPath
    ? path.join(OUTPUT_DIR, urlPath)
    : path.join(OUTPUT_DIR, 'index.html');

  const rawBytes = Buffer.byteLength(contents, 'utf8');
  const output = minify && outFile.endsWith('.html') ? await minifyHtml(contents) : contents;
  const outBytes = Buffer.byteLength(output, 'utf8');

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, output);

  return { outFile, rawBytes, outBytes };
}

async function writePage(urlPath, html) {
  const filePath = urlPath ? path.join(urlPath, 'index.html') : 'index.html';
  return writeFile(filePath, html);
}

async function buildSite() {
  await loadConfig();
  const config = getConfig();

  await cleanOutputDir();
  await copyStaticAssets();
  await prepareNavIcons(config.nav?.links);

  const posts = await loadPosts();
  const contentSlugs = await listContentSlugs();
  const pages = [];
  let rawBytes = 0;
  let outBytes = 0;

  const addPage = async (urlPath, html) => {
    const result = await writePage(urlPath, html);
    pages.push(result.outFile);
    rawBytes += result.rawBytes;
    outBytes += result.outBytes;
  };

  const addFile = async (filePath, contents, options) => {
    const result = await writeFile(filePath, contents, options);
    pages.push(result.outFile);
    rawBytes += result.rawBytes;
    outBytes += result.outBytes;
  };

  await addPage('', await renderTemplate('home', { posts, activePath: '/' }));

  for (const slug of contentSlugs) {
    const page = await loadContent(slug);
    if (!page) continue;

    await addPage(
      slug,
      await renderTemplate('article', {
        article: page,
        showMeta: false,
        title: `${page.title} — ${config.site.name}`,
        activePath: `/${slug}`,
      }),
    );
  }

  for (const { slug } of posts) {
    const post = await loadPost(slug);
    if (!post) continue;

    await addPage(
      `news/${slug}`,
      await renderTemplate('article', {
        article: post,
        showMeta: true,
        title: `${post.title} — ${config.site.name}`,
        activePath: null,
      }),
    );
  }

  await addFile('feed.xml', buildRssFeed({ config, posts }), { minify: false });
  await addFile('sitemap.xml', buildSitemap({ config, posts, contentSlugs }), { minify: false });

  return {
    count: pages.length,
    rawBytes,
    outBytes,
    minified: process.env.MINIFY !== 'false',
  };
}

module.exports = { buildSite, OUTPUT_DIR };
