# Agent guide — mdklin

Guidance for AI assistants working in this repository.

## What this project is

mdklin is a pre-rendered markdown site generator. It is **not** a SPA or a traditional SSR app — pages are built to `dist/` with EJS + `marked`, then served as static HTML. The only runtime API is `/api/status` (optional sidebar widget).

## Architecture

```
config.json + posts/ + content/ + views/
        ↓
   lib/build.js  (EJS render → minify → dist/)
        ↓
   lib/watch.js  (rebuild on .md / .json / .ejs changes)
        ↓
   server.js     (serve dist/ + public/, /api/status)
```

## Key files

| Path | Role |
|------|------|
| `server.js` | Express entry point; starts build + watcher |
| `lib/site-data.js` | Config loading, frontmatter parsing, markdown file reads |
| `lib/build.js` | Pre-renders all pages to `dist/` |
| `lib/watch.js` | File watcher with debounced rebuilds and logging |
| `lib/markdown.js` | `marked` wrapper |
| `lib/minify.js` | HTML minification (`html-minifier-terser`) |
| `views/` | EJS templates; use partials for shared layout |
| `plugins/` | Status plugins exporting `getStatus(options)` |

## Routing (generated output)

| URL | Source |
|-----|--------|
| `/` | Home — post list from `posts/` |
| `/news/:slug` | Post from `posts/:slug.md` |
| `/:slug` | Page from `content/:slug.md` if it exists |
| unknown paths | Falls back to home (`index.html`) |

Do not add per-route hardcoding (e.g. a dedicated `/about` route). Content pages are discovered from `content/`.

## Conventions

- **Config-driven branding** — site name, links, sidebar visibility live in `config.json`, not templates.
- **Server-side rendering only** — do not fetch markdown from client JS; render in `lib/build.js`.
- **Minimal dependencies** — prefer Node built-ins; justify new packages.
- **Scoped changes** — match existing style in `lib/` and `views/partials/`.
- **No external fonts** — use system font stacks in `public/css/style.css`.
- **`dist/` is generated** — never hand-edit; it is cleared and rebuilt each time.

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
- **nginx** — serves `dist/` and `public/` on port 3000, proxies `/api/` to web

`config.json`, `content/`, and `posts/` are bind-mounted. `dist/` is a shared volume between web and nginx. Template changes (`views/`) require an image rebuild unless views are also mounted.

Local `npm start` (without Docker) serves static files from Node directly.

## When editing

- Template/layout changes → `views/` (triggers rebuild via watcher)
- New page → add `content/foo.md` (served at `/foo`)
- New post → add `posts/foo.md` (served at `/news/foo`)
- Branding/links → `config.json`
- Styles → `public/css/style.css`
- Rebuild logging → `lib/watch.js`

## Development history

This codebase was built with LLM assistance. Preserve its simplicity: avoid over-abstracting, adding unnecessary APIs, or reintroducing client-side content rendering.
