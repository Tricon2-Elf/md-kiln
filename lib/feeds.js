const { getSiteUrl, escapeXml } = require('./utils');

function toRfc822(dateStr) {
  const date = dateStr ? new Date(dateStr) : new Date();
  return date.toUTCString();
}

function toIsoDate(dateStr) {
  const date = dateStr ? new Date(dateStr) : new Date();
  return date.toISOString().slice(0, 10);
}

function buildRssFeed({ config, posts }) {
  const siteUrl = getSiteUrl(config);
  const buildDate = new Date().toUTCString();

  const items = posts
    .map((post) => {
      const postUrl = `${siteUrl}/news/${post.slug}`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid>${escapeXml(postUrl)}</guid>
      <pubDate>${toRfc822(post.date)}</pubDate>
      <description>${escapeXml(post.excerpt || '')}</description>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(config.site.name)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(config.site.tagline)}</description>
    <lastBuildDate>${buildDate}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function buildSitemap({ config, posts, contentSlugs }) {
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

module.exports = { buildRssFeed, buildSitemap };
