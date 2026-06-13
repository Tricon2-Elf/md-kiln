import fs from "fs/promises";
import path from "path";
import ejs from "ejs";
import { ASSETS_DIR, OUTPUT_DIR, VIEWS_DIR } from "../paths";
import { formatDate, minifyHtml, getThemeVars } from "./utils";
import { prepareNavIcons, getNavLinks } from "./nav";
import { buildRssFeed, buildSitemap } from "./feeds";
import {
  loadConfig,
  getConfig,
  hasSidebar,
  loadPosts,
  loadPost,
  loadContent,
  listContentSlugs,
} from "./content";
import type {
  BuildResult,
  TemplateLocals,
  WriteFileOptions,
  WriteFileResult,
} from "../types/build";

export { OUTPUT_DIR };

function templateLocals(extra: Partial<TemplateLocals> = {}): TemplateLocals {
  const config = getConfig();
  const activePath = extra.activePath ?? null;

  return {
    config,
    formatDate,
    hasSidebar: hasSidebar(),
    theme: getThemeVars(config.theme),
    ...extra,
    navLinks: getNavLinks(config.nav.links, activePath),
  };
}

function renderTemplate(
  name: string,
  locals: Partial<TemplateLocals>,
): Promise<string> {
  const file = path.join(VIEWS_DIR, `${name}.ejs`);
  return ejs.renderFile(file, templateLocals(locals), {
    views: [VIEWS_DIR],
  });
}

async function copyStaticAssets(): Promise<void> {
  try {
    await fs.access(ASSETS_DIR);
  } catch {
    return;
  }

  await fs.cp(ASSETS_DIR, OUTPUT_DIR, { recursive: true });
}

async function cleanOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let entries;
  try {
    entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") return;
    throw err;
  }

  await Promise.all(
    entries.map(async (entry) => {
      // Keep cached nav icons across rebuilds (dist/img/links/cached).
      if (entry.name === "img") return;

      const full = path.join(OUTPUT_DIR, entry.name);
      await fs.rm(full, { recursive: true, force: true });
    }),
  );
}

async function writeFile(
  urlPath: string,
  contents: string,
  { minify = true }: WriteFileOptions = {},
): Promise<WriteFileResult> {
  const outFile = urlPath
    ? path.join(OUTPUT_DIR, urlPath)
    : path.join(OUTPUT_DIR, "index.html");

  const rawBytes = Buffer.byteLength(contents, "utf8");
  const output =
    minify && outFile.endsWith(".html") ? await minifyHtml(contents) : contents;
  const outBytes = Buffer.byteLength(output, "utf8");

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, output);

  return { outFile, rawBytes, outBytes };
}

async function writePage(
  urlPath: string,
  html: string,
): Promise<WriteFileResult> {
  const filePath = urlPath ? path.join(urlPath, "index.html") : "index.html";
  return writeFile(filePath, html);
}

export async function buildSite(): Promise<BuildResult> {
  await loadConfig();
  const config = getConfig();

  await cleanOutputDir();
  await copyStaticAssets();
  await prepareNavIcons(config.nav.links);

  const posts = await loadPosts();
  const contentSlugs = await listContentSlugs();
  const pages: string[] = [];
  let rawBytes = 0;
  let outBytes = 0;

  const addPage = async (urlPath: string, html: string): Promise<void> => {
    const result = await writePage(urlPath, html);
    pages.push(result.outFile);
    rawBytes += result.rawBytes;
    outBytes += result.outBytes;
  };

  const addFile = async (
    filePath: string,
    contents: string,
    options?: WriteFileOptions,
  ): Promise<void> => {
    const result = await writeFile(filePath, contents, options);
    pages.push(result.outFile);
    rawBytes += result.rawBytes;
    outBytes += result.outBytes;
  };

  await addPage("", await renderTemplate("home", { posts, activePath: "/" }));

  for (const slug of contentSlugs) {
    const page = await loadContent(slug);
    if (!page) continue;

    await addPage(
      slug,
      await renderTemplate("article", {
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
      await renderTemplate("article", {
        article: post,
        showMeta: true,
        title: `${post.title} — ${config.site.name}`,
        activePath: null,
      }),
    );
  }

  await addFile("feed.xml", buildRssFeed({ config, posts }), { minify: false });
  await addFile(
    "sitemap.xml",
    await buildSitemap({ config, posts, contentSlugs }),
    {
      minify: false,
    },
  );

  return {
    count: pages.length,
    rawBytes,
    outBytes,
    minified: process.env.MINIFY !== "false",
  };
}
