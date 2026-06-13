import { Feed } from 'feed';
import { getSiteUrl, escapeXml } from './utils';
import type { AppConfig } from './config-schema';
import type { PostSummary } from '../types/content';

function toIsoDate(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  return date.toISOString().slice(0, 10);
}

function absoluteUrl(siteUrl: string, assetPath: string | null | undefined): string | undefined {
  if (!assetPath) return undefined;
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  return `${siteUrl}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
}

interface RssFeedInput {
  config: AppConfig;
  posts: PostSummary[];
}

interface SitemapInput {
  config: AppConfig;
  posts: PostSummary[];
  contentSlugs: string[];
}

export function buildRssFeed({ config, posts }: RssFeedInput): string {
  const siteUrl = getSiteUrl(config);

  const feed = new Feed({
    title: config.site.name,
    description: config.site.tagline,
    id: siteUrl,
    link: siteUrl,
    image: absoluteUrl(siteUrl, config.site.logo),
    copyright: config.site.footer || undefined,
    generator: 'mdklin',
    feed: `${siteUrl}/feed.xml`,
  });

  for (const post of posts) {
    const postUrl = `${siteUrl}/news/${post.slug}`;

    feed.addItem({
      title: post.title,
      id: postUrl,
      link: postUrl,
      guid: postUrl,
      description: post.excerpt || '',
      date: post.date ? new Date(post.date) : new Date(),
      category: post.tag ? [{ name: post.tag }] : undefined,
      image: absoluteUrl(siteUrl, post.image),
    });
  }

  return feed.rss2();
}

export function buildSitemap({ config, posts, contentSlugs }: SitemapInput): string {
  const siteUrl = getSiteUrl(config);
  const buildDate = toIsoDate();

  const urls = [
    { loc: `${siteUrl}/`, lastmod: buildDate },
    ...contentSlugs.map((slug) => ({
      loc: `${siteUrl}/${slug}`,
      lastmod: buildDate,
    })),
    ...posts.map((post) => ({
      loc: `${siteUrl}/news/${post.slug}`,
      lastmod: toIsoDate(post.date) || buildDate,
    })),
  ];

  const body = urls
    .map(
      ({ loc, lastmod }) => `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}
