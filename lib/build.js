const fs = require('fs').promises;
const path = require('path');
const ejs = require('ejs');
const { formatDate } = require('./format');
const { minifyHtml } = require('./minify');
const {
  loadConfig,
  getConfig,
  hasSidebar,
  loadPosts,
  loadPost,
  loadContent,
  listContentSlugs,
} = require('./site-data');

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '..', 'dist');
const VIEWS_DIR = path.join(__dirname, '..', 'views');

function templateLocals(extra = {}) {
  const config = getConfig();
  return {
    config,
    formatDate,
    hasSidebar: hasSidebar(),
    ...extra,
  };
}

function renderTemplate(name, locals) {
  const file = path.join(VIEWS_DIR, `${name}.ejs`);
  return ejs.renderFile(file, templateLocals(locals), {
    views: [VIEWS_DIR],
  });
}

async function writePage(urlPath, html) {
  const outFile = urlPath
    ? path.join(OUTPUT_DIR, urlPath, 'index.html')
    : path.join(OUTPUT_DIR, 'index.html');

  const rawBytes = Buffer.byteLength(html, 'utf8');
  const minified = await minifyHtml(html);
  const outBytes = Buffer.byteLength(minified, 'utf8');

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, minified);

  return { outFile, rawBytes, outBytes };
}

async function buildSite() {
  await loadConfig();
  const config = getConfig();

  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });

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

  await addPage('', await renderTemplate('home', { posts, active: 'home' }));

  for (const slug of contentSlugs) {
    const page = await loadContent(slug);
    if (!page) continue;

    await addPage(
      slug,
      await renderTemplate('article', {
        article: page,
        showMeta: false,
        title: `${page.title} — ${config.site.name}`,
        active: slug === 'about' ? 'about' : null,
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
        active: null,
      }),
    );
  }

  return {
    count: pages.length,
    rawBytes,
    outBytes,
    minified: process.env.MINIFY !== 'false',
  };
}

module.exports = { buildSite, OUTPUT_DIR };
