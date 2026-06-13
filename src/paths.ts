import path from "path";

/** Project root (parent of compiled `build/` output). */
export const ROOT = path.join(__dirname, "..");

export const CONFIG_PATH =
  process.env.CONFIG_PATH ?? path.join(ROOT, "config.json");
export const POSTS_DIR = process.env.POSTS_DIR ?? path.join(ROOT, "posts");
export const CONTENT_DIR =
  process.env.CONTENT_DIR ?? path.join(ROOT, "content");
export const OUTPUT_DIR = process.env.OUTPUT_DIR ?? path.join(ROOT, "dist");
export const PUBLIC_DIR = process.env.PUBLIC_DIR ?? path.join(ROOT, "public");
export const ASSETS_DIR = path.join(ROOT, "assets");
export const VIEWS_DIR = path.join(ROOT, "views");
export const LEGACY_ICON_CACHE_DIR = path.join(
  ROOT,
  "public",
  "img",
  "links",
  "cached",
);
export const ICON_CACHE_DIR = path.join(OUTPUT_DIR, "img", "links", "cached");
