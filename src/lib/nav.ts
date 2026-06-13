import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ICON_CACHE_DIR, LEGACY_ICON_CACHE_DIR } from '../paths';
import { isRemoteUrl, normalizeLocalPath } from './utils';
import type { IconNavLink, NavLink } from '../types/config';
import type { CachedIconResult, ResolvedNavLink } from '../types/nav';

const iconCache = new Map<string, string>();

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/$/, '');
}

function isActive(href: string, activePath: string | null): boolean {
  if (!activePath) return false;
  return normalizePath(href) === normalizePath(activePath);
}

function cacheFilename(url: string): string {
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 10);
  return `icon-${hash}.svg`;
}

function cachePaths(url: string): { filename: string; filePath: string; publicPath: string } {
  const filename = cacheFilename(url);
  return {
    filename,
    filePath: path.join(ICON_CACHE_DIR, filename),
    publicPath: `/img/links/cached/${filename}`,
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchSvg(url: string): Promise<string> {
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

async function adoptLegacyCache(url: string, filePath: string): Promise<boolean> {
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 10);
  let entries: string[];
  try {
    entries = await fs.readdir(ICON_CACHE_DIR);
  } catch {
    return false;
  }

  const legacy = entries.find(
    (entry) => entry.endsWith(`-${hash}.svg`) && entry !== path.basename(filePath),
  );
  if (!legacy) return false;

  await fs.rename(path.join(ICON_CACHE_DIR, legacy), filePath);
  return true;
}

async function getOrDownloadIcon(url: string, label: string): Promise<CachedIconResult> {
  await fs.mkdir(ICON_CACHE_DIR, { recursive: true });
  const { filePath, publicPath } = cachePaths(url);
  const forceRefresh = process.env.NAV_ICONS_REFRESH === 'true';

  if (!forceRefresh && (await fileExists(filePath))) {
    return { publicPath, source: 'cache' };
  }

  if (!forceRefresh && (await adoptLegacyCache(url, filePath))) {
    return { publicPath, source: 'cache' };
  }

  try {
    const svg = await fetchSvg(url);
    await fs.writeFile(filePath, svg);
    return { publicPath, source: 'download' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (await fileExists(filePath)) {
      console.warn(`Using cached nav icon for "${label}" (${message})`);
      return { publicPath, source: 'stale' };
    }
    throw err;
  }
}

async function pruneStaleIcons(activeUrls: string[]): Promise<void> {
  const activeFiles = new Set(activeUrls.map(cacheFilename));
  activeFiles.add('.gitkeep');

  let entries: string[];
  try {
    entries = await fs.readdir(ICON_CACHE_DIR);
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => !activeFiles.has(entry))
      .map((entry) => fs.rm(path.join(ICON_CACHE_DIR, entry), { force: true })),
  );
}

async function migratePublicIconCache(): Promise<void> {
  if (!(await fileExists(LEGACY_ICON_CACHE_DIR))) return;

  await fs.mkdir(ICON_CACHE_DIR, { recursive: true });
  let entries: string[];
  try {
    entries = await fs.readdir(LEGACY_ICON_CACHE_DIR);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.svg')) continue;
    const dest = path.join(ICON_CACHE_DIR, entry);
    if (await fileExists(dest)) continue;
    await fs.copyFile(path.join(LEGACY_ICON_CACHE_DIR, entry), dest);
  }
}

function isIconNavLink(link: NavLink): link is IconNavLink {
  return link.type === 'icon';
}

export async function prepareNavIcons(links: NavLink[] = []): Promise<void> {
  iconCache.clear();
  await migratePublicIconCache();

  const remoteLinks = links.filter(
    (link): link is IconNavLink =>
      isIconNavLink(link) && Boolean(link.icon) && isRemoteUrl(link.icon),
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
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to cache nav icon "${link.label}" from ${link.icon}: ${message}`);
    }
  }

  await pruneStaleIcons(remoteLinks.map((link) => link.icon));

  if (downloaded > 0) console.log(`Downloaded ${downloaded} remote nav icon(s)`);
  if (cached > 0) console.log(`Reused ${cached} cached nav icon(s)`);
}

function resolveIconSrc(icon: string | undefined): string | null {
  if (!icon) return null;
  if (isRemoteUrl(icon)) return iconCache.get(icon) ?? null;
  return normalizeLocalPath(icon);
}

export function getNavLinks(
  links: NavLink[] = [],
  activePath: string | null = null,
): ResolvedNavLink[] {
  return links
    .filter((link) => link.label?.trim() && link.href?.trim())
    .map((link): ResolvedNavLink | null => {
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
    .filter((link): link is ResolvedNavLink => link !== null);
}
