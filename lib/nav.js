const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { isRemoteUrl, normalizeLocalPath } = require('./utils');

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '..', 'dist');
const LEGACY_CACHE_DIR = path.join(__dirname, '..', 'public', 'img', 'links', 'cached');
const CACHE_DIR = path.join(OUTPUT_DIR, 'img', 'links', 'cached');
const iconCache = new Map();

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/$/, '');
}

function isActive(href, activePath) {
  if (!activePath) return false;
  return normalizePath(href) === normalizePath(activePath);
}

function cacheFilename(url) {
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 10);
  return `icon-${hash}.svg`;
}

function cachePaths(url) {
  const filename = cacheFilename(url);
  return {
    filename,
    filePath: path.join(CACHE_DIR, filename),
    publicPath: `/img/links/cached/${filename}`,
  };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchSvg(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    if (!/<svg[\s>]/i.test(text)) throw new Error('response is not SVG');

    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function adoptLegacyCache(url, filePath) {
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 10);
  let entries;
  try {
    entries = await fs.readdir(CACHE_DIR);
  } catch {
    return false;
  }

  const legacy = entries.find((entry) => entry.endsWith(`-${hash}.svg`) && entry !== path.basename(filePath));
  if (!legacy) return false;

  await fs.rename(path.join(CACHE_DIR, legacy), filePath);
  return true;
}

async function getOrDownloadIcon(url, label) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const { filePath, publicPath } = cachePaths(url);
  const forceRefresh = process.env.NAV_ICONS_REFRESH === 'true';

  if (!forceRefresh && await fileExists(filePath)) {
    return { publicPath, source: 'cache' };
  }

  if (!forceRefresh && await adoptLegacyCache(url, filePath)) {
    return { publicPath, source: 'cache' };
  }

  try {
    const svg = await fetchSvg(url);
    await fs.writeFile(filePath, svg);
    return { publicPath, source: 'download' };
  } catch (err) {
    if (await fileExists(filePath)) {
      console.warn(`Using cached nav icon for "${label}" (${err.message})`);
      return { publicPath, source: 'stale' };
    }
    throw err;
  }
}

async function pruneStaleIcons(activeUrls) {
  const activeFiles = new Set(activeUrls.map(cacheFilename));
  activeFiles.add('.gitkeep');

  let entries;
  try {
    entries = await fs.readdir(CACHE_DIR);
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => !activeFiles.has(entry))
      .map((entry) => fs.rm(path.join(CACHE_DIR, entry), { force: true })),
  );
}

async function migratePublicIconCache() {
  if (!(await fileExists(LEGACY_CACHE_DIR))) return;

  await fs.mkdir(CACHE_DIR, { recursive: true });
  let entries;
  try {
    entries = await fs.readdir(LEGACY_CACHE_DIR);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.svg')) continue;
    const dest = path.join(CACHE_DIR, entry);
    if (await fileExists(dest)) continue;
    await fs.copyFile(path.join(LEGACY_CACHE_DIR, entry), dest);
  }
}

async function prepareNavIcons(links = []) {
  iconCache.clear();
  await migratePublicIconCache();

  const remoteLinks = links.filter(
    (link) => link.type === 'icon' && link.icon && isRemoteUrl(link.icon),
  );

  let downloaded = 0;
  let cached = 0;

  for (const link of remoteLinks) {
    try {
      const { publicPath, source } = await getOrDownloadIcon(link.icon, link.label || 'icon');
      iconCache.set(link.icon, publicPath);
      if (source === 'download') downloaded += 1;
      if (source === 'cache') cached += 1;
    } catch (err) {
      console.warn(`Failed to cache nav icon "${link.label}" from ${link.icon}: ${err.message}`);
    }
  }

  await pruneStaleIcons(remoteLinks.map((link) => link.icon));

  if (downloaded > 0) console.log(`Downloaded ${downloaded} remote nav icon(s)`);
  if (cached > 0) console.log(`Reused ${cached} cached nav icon(s)`);
}

function resolveIconSrc(icon) {
  if (!icon) return null;
  if (isRemoteUrl(icon)) return iconCache.get(icon) || null;
  return normalizeLocalPath(icon);
}

function getNavLinks(links = [], activePath = null) {
  return links
    .filter((link) => link.label?.trim() && link.href?.trim())
    .map((link) => {
      const base = {
        label: link.label.trim(),
        href: link.href.trim(),
        external: isRemoteUrl(link.href),
        active: isActive(link.href, activePath),
      };

      if (link.type === 'icon') {
        const iconSrc = resolveIconSrc(link.icon?.trim());
        if (!iconSrc) return null;
        return { type: 'icon', iconSrc, ...base };
      }

      return { type: 'text', ...base };
    })
    .filter(Boolean);
}

module.exports = { prepareNavIcons, getNavLinks };
