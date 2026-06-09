# mdklin

A small, config-driven site generator. Write content in Markdown, customise branding in `config.json`, and mdklin pre-renders everything to static HTML on startup and when files change.

## Quick start

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Docker

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Nginx serves pre-rendered pages from `dist/` and assets from `public/`; `/api/*` requests are proxied to the Node app.

`config.json`, `content/`, and `posts/` are mounted from the host so you can edit them without rebuilding the image. The Node container rebuilds `dist/` into a shared volume that Nginx reads.

For local development without Docker, `npm start` serves everything directly from Node.

## Project layout

```
config.json     Site branding, links, sidebar, status plugin
content/        Static pages (e.g. about.md → /about)
posts/          News posts (e.g. foo.md → /news/foo)
views/          EJS templates
public/         CSS, images, client JS
lib/            Build, watch, and data loading
plugins/        Status widget plugins (mock, tcp-check, http)
dist/           Generated HTML (gitignored, rebuilt automatically)
```

## Configuration

Edit `config.json` to set the site name, logo, footer, social links, and optional sidebar widgets. Empty `github` or `discord` URLs hide those nav icons.

Status plugins are configured under `status.plugin` — built-in options are `mock`, `tcp-check`, and `http`.

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

## Development note

This project was developed with assistance from large language models (LLMs). Review generated code and content before deploying to production.
