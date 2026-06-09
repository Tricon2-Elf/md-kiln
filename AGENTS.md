# Agent guide — mdklin

Guidance for AI assistants working in this repository.

## What this project is

mdklin is a pre-rendered markdown site generator. It is **not** a SPA or a traditional SSR app — pages are built to `dist/` with EJS + `marked`, then served as static HTML. The only runtime API is `/api/status` (optional sidebar widget).

## Architecture

```
config.json + posts/ + content/ + views/
        ↓
   lib/build.js  (EJS render → minify → dist/ + feed.xml + sitemap.xml)
        ↓
   lib/watch.js  (rebuild on .md / .json / .ejs changes)
        ↓
   server.js     (serve dist/ + public/ user assets, /api/status)
```

`npm run build` runs a one-shot build via `scripts/build.js` without starting the server.

## Key files

| Path | Role |
|------|------|
| `server.js` | Express entry point; starts build + watcher |
| `scripts/build.js` | One-shot static build CLI |
| `lib/content.js` | Config loading (with validation), frontmatter, markdown file reads |
| `lib/build.js` | Pre-renders pages and feeds to `dist/` |
| `lib/watch.js` | File watcher with debounced rebuilds and logging |
| `lib/utils.js` | Markdown, minify, theme vars, dates, path helpers |
| `lib/nav.js` | Nav link resolution and remote SVG caching |
| `lib/feeds.js` | RSS (`feed.xml` via [`feed`](https://www.npmjs.com/package/feed)) and sitemap (`sitemap.xml`) generation |
| `lib/validate-config.js` | Config validation ([AJV](https://ajv.js.org/) + `lib/config.schema.json`) |
| `config.example.json` | Example config for new deployments |
| `views/` | EJS templates; use partials for shared layout |
| `plugins/` | Status plugins exporting `getStatus(options)` |

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

- **Config-driven branding** — site name, nav links, sidebar visibility live in `config.json`, not templates.
- **Config validation** — `lib/validate-config.js` runs on every `loadConfig()`; update it when adding config fields.
- **Nav links** — `nav.links` supports `text` and `icon` types; remote SVG icons are cached in `dist/img/links/cached/` during build (`lib/nav.js`). Local icons live under the user `public/` mount.
- **Server-side rendering only** — do not fetch markdown from client JS; render in `lib/build.js`.
- **Minimal dependencies** — prefer Node built-ins; justify new packages.
- **Scoped changes** — match existing style in `lib/` and `views/partials/`.
- **No external fonts** — use system font stacks in `assets/css/style.css` (copied to `dist/` on build).
- **`dist/` is generated** — never hand-edit; HTML/CSS/JS are rebuilt each time; nav icon cache under `dist/img/links/cached/` is preserved across rebuilds.

## Status plugins

Plugins in `plugins/` export:

```js
async function getStatus(options) {
  return { online: true, metrics: { players: 0 } };
}
module.exports = { getStatus };
```

Register built-in plugins in `plugins/index.js`. Wire via `config.json` → `status.plugin` and `status.options`.

## Docker

Docker Compose runs two services:

- **web** — builds `dist/`, watches for changes, serves `/api/*` only (`API_ONLY=true`)
- **caddy** — serves `dist/` then `public/` on port 3000 (local) or with automatic HTTPS when `DOMAIN` is set in `.env`, proxies `/api/` to web

`config.json`, `content/`, `posts/`, and `public/` are bind-mounted for user content. `dist/` is a shared volume between web and caddy (HTML, CSS, JS, cached nav icons). Template and asset changes (`views/`, `assets/`) require an image rebuild unless those dirs are also mounted.

Set `DOMAIN` and `CADDY_EMAIL` in `.env` (see `.env.example`) for Let's Encrypt certificate provisioning and auto-renewal.

Local `npm start` (without Docker) serves static files from Node directly.

## When editing

- Template/layout changes → `views/` (triggers rebuild via watcher)
- New page → add `content/foo.md` (served at `/foo`)
- New post → add `posts/foo.md` (served at `/news/foo`)
- Branding/links → `config.json` (see `config.example.json`)
- Styles → `assets/css/style.css`
- Rebuild logging → `lib/watch.js`

## Development history

This codebase was built with LLM assistance. Preserve its simplicity: avoid over-abstracting, adding unnecessary APIs, or reintroducing client-side content rendering.
