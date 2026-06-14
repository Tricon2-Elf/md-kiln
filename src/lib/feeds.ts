import { SitemapStream, streamToPromise } from "sitemap";
import { Feed } from "feed";
import { getSiteUrl } from "./utils";
import type { AppConfig } from "./config-schema";
import type { PostSummary } from "../types/content";

function toIsoDate(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  return date.toISOString().slice(0, 10);
}

function absoluteUrl(
  siteUrl: string,
  assetPath: string | null | undefined,
): string | undefined {
  if (!assetPath) return undefined;

  try {
    return new URL(assetPath, siteUrl).href;
  } catch {
    return undefined;
  }
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
    generator: "mdkiln",
    feed: `${siteUrl}/feed.xml`,
  });

  for (const post of posts) {
    const postUrl = `${siteUrl}/news/${post.slug}`;

    feed.addItem({
      title: post.title,
      id: postUrl,
      link: postUrl,
      guid: postUrl,
      description: post.excerpt || "",
      date: post.date ? new Date(post.date) : new Date(),
      category: post.tag ? [{ name: post.tag }] : undefined,
      image: absoluteUrl(siteUrl, post.image),
    });
  }

  return feed.rss2();
}

export async function buildSitemap({
  config,
  posts,
  contentSlugs,
}: SitemapInput): Promise<string> {
  const siteUrl = getSiteUrl(config);
  const buildDate = toIsoDate();
  const stream = new SitemapStream({ hostname: siteUrl });

  stream.write({ url: "/", lastmod: buildDate });

  for (const slug of contentSlugs) {
    stream.write({ url: `/${slug}`, lastmod: buildDate });
  }

  for (const post of posts) {
    stream.write({
      url: `/news/${post.slug}`,
      lastmod: toIsoDate(post.date) || buildDate,
    });
  }

  stream.end();
  const xml = await streamToPromise(stream);
  return xml.toString();
}
