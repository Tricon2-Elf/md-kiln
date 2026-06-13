# Agent guide — mdklin

Guidance for AI assistants working in this repository.

## What this project is

mdklin is a pre-rendered markdown site generator. It is **not** a SPA or a traditional SSR app — pages are built to `dist/` with EJS + `marked`, then served as static HTML. The only runtime API is `/api/status` (optional sidebar widget).

The server is written in **TypeScript** (`src/` → `build/` via `tsc`). Static site output still goes to `dist/`.

## Architecture

```
config.json + posts/ + content/ + views/
        ↓
src/lib/build.ts  (EJS render → minify → dist/ + feed.xml + sitemap.xml)
        ↓
src/lib/watch.ts  (rebuild on .md / .json / .ejs changes)
        ↓
src/server.ts     (serve dist/ + public/ user assets, /api/status)
        ↓
build/            (compiled JS run by Node)
```

`npm run build` compiles TypeScript, then runs a one-shot static build via `build/scripts/build.js` without starting the server.

## Key files

| Path | Role |
|------|------|
| `src/server.ts` | Express entry point; starts build + watcher |
| `src/scripts/build.ts` | One-shot static build CLI |
| `src/paths.ts` | Project-root path constants (`CONFIG_PATH`, `OUTPUT_DIR`, etc.) |
| `src/lib/content.ts` | Config loading (with validation), frontmatter, markdown file reads |
| `src/lib/build.ts` | Pre-renders pages and feeds to `dist/` |
| `src/lib/watch.ts` | File watcher with debounced rebuilds and logging |
| `src/lib/utils.ts` | Markdown, minify, theme vars, dates, path helpers |
| `src/lib/nav.ts` | Nav link resolution and remote SVG caching |
| `src/lib/feeds.ts` | RSS (`feed.xml` via [`feed`](https://www.npmjs.com/package/feed)) and sitemap (`sitemap.xml`) generation |
| `src/lib/validate-config.ts` | Config validation ([AJV](https://ajv.js.org/) + `src/lib/config.schema.json`) |
| `src/lib/tags.ts` | Post tag parsing and CSS named-color validation |
| `src/types/` | Shared TypeScript types (`config`, `content`, `nav`, `plugins`, `build`, `theme`) |
| `tsconfig.json` | TypeScript compiler options (`strict: true`) |
| `config.example.json` | Example config for new deployments |
| `views/` | EJS templates; use partials for shared layout |
| `src/plugins/` | Status plugins exporting `getStatus(options)` |
| `assets/js/status.js` | Client-side status widget (plain JS, copied to `dist/`) |

## npm scripts

| Command | What it does |
|---------|----------------|
| `npm run compile` | `tsc` → `build/` |
| `npm run build` | compile + one-shot static site build |
| `npm run start` | `node build/server.js` |
| `npm run typecheck` | type-check without emit |

## Routing (generated output)

| URL | Source |
|-----|--------|
| `/` | Home — post list from `posts/` |
| `/news/:slug` | Post from `posts/:slug.md` |
| `/:slug` | Page from `content/:slug.md` if it exists |
| `/feed.xml` | RSS feed (build output) |
| `/sitemap.xml` | Sitemap (build output) |
| unknown paths | Falls back to home (`index.html`) |

Do not add per-route hardcoding (e.g. a dedicated `/about` route). Content pages are discovered from `content/`.

## Conventions

- **TypeScript** — edit `src/` only; never hand-edit `build/`. Run `npm run compile` (or `npm run build`) after changes.
- **Types** — add or update types in `src/types/` when introducing new config fields, content shapes, or plugin options. Update `src/lib/config.schema.json` and `validate-config.ts` for config changes.
- **Config-driven branding** — site name, nav links, sidebar visibility live in `config.json`, not templates.
- **Config validation** — `src/lib/validate-config.ts` runs on every `loadConfig()`; update schema + types when adding config fields.
- **Nav links** — `nav.links` supports `text` and `icon` types; remote SVG icons are cached in `dist/img/links/cached/` during build (`src/lib/nav.ts`). Local icons live under the user `public/` mount.
- **Server-side rendering only** — do not fetch markdown from client JS; render in `src/lib/build.ts`.
- **Minimal dependencies** — prefer Node built-ins; justify new packages.
- **Scoped changes** — match existing style in `src/lib/` and `views/partials/`.
- **No external fonts** — use system font stacks in `assets/css/style.css` (copied to `dist/` on build).
- **`dist/` is generated** — never hand-edit; HTML/CSS/JS are rebuilt each time; nav icon cache under `dist/img/links/cached/` is preserved across rebuilds.
- **`build/` is generated** — compiled TypeScript output; gitignored.

## Status plugins

Plugins in `src/plugins/` export:

```ts
import type { StatusOptions } from '../types/config';
import type { StatusResult } from '../types/plugins';

export async function getStatus(options: StatusOptions = {}): Promise<StatusResult> {
  return { online: true, metrics: { players: 0 } };
}
```

Register built-in plugins in `src/plugins/index.ts`. Wire via `config.json` → `status.plugin` and `status.options`.

## Docker

Docker Compose runs two services:

- **web** — compiles TypeScript, builds `dist/`, watches for changes, serves the site and `/api/status`
- **caddy** — reverse-proxies to web on port 3000 (local HTTP) or with automatic HTTPS when `DOMAIN` is set in `.env`

`config.json`, `content/`, `posts/`, and `public/` are bind-mounted for user content. `dist/` is a volume on web (HTML, CSS, JS, cached nav icons). Template and asset changes (`views/`, `assets/`) require an image rebuild unless those dirs are also mounted.

Set `DOMAIN` in `.env` (see `.env.example`) for Let's Encrypt certificate provisioning and auto-renewal.

Local `npm start` (without Docker) serves static files from Node directly.

## When editing

- TypeScript / server logic → `src/` (recompile before running; watcher does not watch `src/` — restart server after server-side changes)
- Template/layout changes → `views/` (triggers rebuild via watcher)
- New page → add `content/foo.md` (served at `/foo`)
- New post → add `posts/foo.md` (served at `/news/foo`)
- Branding/links → `config.json` (see `config.example.json`)
- Styles → `assets/css/style.css`
- Rebuild logging → `src/lib/watch.ts`

## Development history

This codebase was built with LLM assistance. Preserve its simplicity: avoid over-abstracting, adding unnecessary APIs, or reintroducing client-side content rendering.
