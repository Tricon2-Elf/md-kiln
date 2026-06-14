# mdkiln

A small, config-driven site generator. Write content in Markdown, customise branding in `config.json`, and mdkiln pre-renders everything to static HTML on startup and when files change.

## Screenshots

<img width="2231" height="1293" alt="image" src="https://github.com/user-attachments/assets/3979d04f-85e3-40dc-9084-62d470b12817" />

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

Open [http://localhost:3000](http://localhost:3000). Caddy reverse-proxies to the Node app, which serves the built site from `dist/` (HTML, CSS, JS, cached nav icons) and user assets from `content/public/`.

`config.json` and `content/` are mounted from the host so you can edit them without rebuilding the image.

For local development without Docker, `npm start` serves everything directly from Node.

### HTTPS (Let's Encrypt)

Copy `.env.example` to `.env` and set your public hostname:

```bash
cp .env.example .env
# DOMAIN=example.com
docker compose up -d --build
```

When `DOMAIN` is set, Caddy obtains and renews TLS certificates automatically. Ensure ports **80** and **443** reach the host (required for ACME HTTP-01 validation). Leave `DOMAIN` empty for local HTTP on port 3000 only.

## Project layout

```
config.json     Site branding, links, sidebar, status plugin (see config.example.json)
content/        Static pages, news posts, and user assets
  *.md          Pages (e.g. about.md → /about)
  posts/        News posts (e.g. foo.md → /news/foo)
  public/       Logos, images, downloads, local nav icons
views/          EJS templates
assets/         Site CSS and client JS (copied to dist/ on build)
lib/            Build, watch, and data loading
plugins/        Status widget plugins (mock, tcp-check, http)
dist/           Generated site (HTML, CSS, JS, cached icons; gitignored)
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
- **icon** — SVG icon link; `icon` can be a local path under `content/public/` (e.g. `/img/github.svg`) or a remote SVG URL (downloaded once to `dist/img/links/cached/` and reused on later builds)

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

`color` is used as the fallback/base for gradients and images. Image paths can be relative to `content/public/` (e.g. `img/foo.jpg`). Any file under `content/public/` is served at the same URL path (e.g. `content/public/downloads/guide.zip` → `/downloads/guide.zip`).

## Writing content

**Posts** (`content/posts/*.md`) use frontmatter:

````markdown
---
title: My Post
date: 2026-05-10
tag: news
excerpt: A short summary for the home page.
---

`tag` must be a key from `posts.tags` in `config.json`:

```json
"posts": {
  "defaultTag": "news",
  "tags": {
    "news": { "label": "News", "color": "slategray" },
    "guide": { "label": "Guide", "color": "steelblue" },
    "update": { "label": "Update", "color": "seagreen" }
  }
}
```
````

`color` is any [CSS named color](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/named-color) (e.g. `blue`, `coral`, `rebeccapurple`). The tag pill uses a lighter background and darker border derived from that color automatically.

Post body in **markdown**.

````

**Pages** (`content/*.md`) use frontmatter with at least a title:

```markdown
---
title: About
---

Page content here.
````

## Environment variables

| Variable            | Default                  | Description                                                     |
| ------------------- | ------------------------ | --------------------------------------------------------------- |
| `PORT`              | `3000`                   | Server port                                                     |
| `CONFIG_PATH`       | `./config.json`          | Path to config file                                             |
| `POSTS_DIR`         | `./content/posts`        | News posts directory                                            |
| `CONTENT_DIR`       | `./content`              | Content root (pages, posts, public assets)                      |
| `OUTPUT_DIR`        | `./dist`                 | Build output (HTML, CSS, JS, cached icons)                      |
| `PUBLIC_DIR`        | `./content/public`       | User-uploaded static assets (logos, images)                     |
| `MINIFY`            | enabled                  | Set to `false` to disable HTML minification                     |
| `NAV_ICONS_REFRESH` | `false`                  | Set to `true` to re-download remote nav SVGs                    |
| `SITE_URL`          | `config.site.url`        | Override site URL for RSS/sitemap                               |
| `DOMAIN`            | (Docker) empty → `:3000` | Public hostname for HTTPS in Docker; leave empty for local HTTP |
| `CHOKIDAR_USEPOLLING` | `false`                | Set to `true` in Docker so bind-mounted edits trigger rebuilds  |

## Development note

This project was developed with assistance from large language models (LLMs). Review generated code and content before deploying to production.
