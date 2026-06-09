# mdklin

A small, config-driven site generator. Write content in Markdown, customise branding in `config.json`, and mdklin pre-renders everything to static HTML on startup and when files change.

## Quick start

```bash
cp config.example.json config.json
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Build static files only (writes to `dist/` and exits):

```bash
npm run build
```

## Docker

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Nginx serves pre-rendered pages from `dist/` and assets from `public/`; `/api/*` requests are proxied to the Node app.

`config.json`, `content/`, and `posts/` are mounted from the host so you can edit them without rebuilding the image. The Node container rebuilds `dist/` into a shared volume that Nginx reads.

For local development without Docker, `npm start` serves everything directly from Node.

## Project layout

```
config.json     Site branding, links, sidebar, status plugin (see config.example.json)
content/        Static pages (e.g. about.md → /about)
posts/          News posts (e.g. foo.md → /news/foo)
views/          EJS templates
public/         CSS, images, client JS
lib/            Build, watch, and data loading
plugins/        Status widget plugins (mock, tcp-check, http)
dist/           Generated HTML (gitignored, rebuilt automatically)
```

## Configuration

Copy `config.example.json` to `config.json` and edit it to set the site name, URL, logo, footer, nav links, and optional sidebar widgets. Config is validated on load — invalid values will fail the build with a clear error.

`site.url` is used for RSS and sitemap absolute URLs (override with `SITE_URL` env var).

### Navigation links

Configure `nav.links` with text or icon entries:

```json
"nav": {
  "links": [
    { "type": "text", "label": "Home", "href": "/" },
    { "type": "text", "label": "About", "href": "/about" },
    { "type": "icon", "label": "Github", "href": "https://github.com/you", "icon": "/img/github.svg" },
    { "type": "icon", "label": "Discord", "href": "https://discord.gg/invite", "icon": "https://www.svgrepo.com/download/506463/discord.svg" }
  ]
}
```

- **text** — standard nav label + href (internal paths or external URLs)
- **icon** — SVG icon link; `icon` can be a local path under `public/` (e.g. `/img/github.svg`) or a remote SVG URL (downloaded once to `public/img/links/cached/` and reused on later builds)

Set `NAV_ICONS_REFRESH=true` to force re-downloading remote icons. If a download fails (e.g. HTTP 429), the last cached copy is used when available.

External URLs open in a new tab. The active state is matched from the current page path.

Status plugins are configured under `status.plugin` — built-in options are `mock`, `tcp-check`, and `http`.

### Background theme

Set `theme.background.type` to `gradient`, `solid`, or `image`:

```json
"theme": {
  "background": {
    "type": "gradient",
    "gradientStart": "#35B2F5",
    "gradientEnd": "#FFFFFF"
  }
}
```

```json
"theme": {
  "background": {
    "type": "solid",
    "color": "#35B2F5"
  }
}
```

```json
"theme": {
  "background": {
    "type": "image",
    "image": "/img/my-background.jpg",
    "color": "#35B2F5",
    "size": "cover",
    "position": "center center",
    "repeat": "no-repeat"
  }
}
```

`color` is used as the fallback/base for gradients and images. Image paths can be relative to `public/` (e.g. `img/foo.jpg`).

## Writing content

**Posts** (`posts/*.md`) use frontmatter:

```markdown
---
title: My Post
date: 2026-05-10
tag: News
excerpt: A short summary for the home page.
---

Post body in **markdown**.
```

**Pages** (`content/*.md`) use frontmatter with at least a title:

```markdown
---
title: About
---

Page content here.
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `CONFIG_PATH` | `./config.json` | Path to config file |
| `POSTS_DIR` | `./posts` | News posts directory |
| `CONTENT_DIR` | `./content` | Static pages directory |
| `OUTPUT_DIR` | `./dist` | Pre-rendered HTML output |
| `MINIFY` | enabled | Set to `false` to disable HTML minification |
| `API_ONLY` | `false` | Set to `true` in Docker so Node only serves `/api/*` |
| `NAV_ICONS_REFRESH` | `false` | Set to `true` to re-download remote nav SVGs |
| `SITE_URL` | `config.site.url` | Override site URL for RSS/sitemap |

## Development note

This project was developed with assistance from large language models (LLMs). Review generated code and content before deploying to production.
