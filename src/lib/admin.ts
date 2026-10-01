import fs from "fs/promises";
import path from "path";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import ejs from "ejs";
import { PUBLIC_DIR, VIEWS_DIR } from "../paths";
import { getConfig } from "./content";
import { renderMarkdown } from "./utils";
import {
  AdminContentError,
  deleteItem,
  getDefaultTag,
  itemExists,
  listItems,
  listTags,
  readItem,
  writeItem,
  type AdminKind,
} from "./admin-content";
import {
  clearLoginFailures,
  createSession,
  isAdminConfigured,
  isLoginRateLimited,
  readSession,
  recordLoginFailure,
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
  verifyCredentials,
} from "./admin-auth";

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sanitizeBaseName(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "image";
}

// Content writes are picked up by the file watcher (src/lib/watch.ts), which
// debounces and rebuilds the site. Triggering a build here as well would only
// queue a duplicate, so the watcher owns rebuilds.

export const adminApiRouter = express.Router();

adminApiRouter.use(express.json({ limit: "12mb" }));
adminApiRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

adminApiRouter.get("/session", (req: Request, res: Response) => {
  if (!isAdminConfigured()) {
    res.json({ configured: false, authenticated: false });
    return;
  }

  const session = readSession(req);
  if (!session) {
    res.json({ configured: true, authenticated: false });
    return;
  }

  res.json({
    configured: true,
    authenticated: true,
    username: session.username,
    csrfToken: session.csrf,
  });
});

adminApiRouter.post("/login", (req: Request, res: Response) => {
  if (!isAdminConfigured()) {
    res.status(503).json({ error: "Admin is not configured." });
    return;
  }

  const ip = req.ip ?? "unknown";
  if (isLoginRateLimited(ip)) {
    res
      .status(429)
      .json({ error: "Too many attempts. Please try again later." });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!verifyCredentials(username.trim(), password)) {
    recordLoginFailure(ip);
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  clearLoginFailures(ip);
  const session = createSession(username.trim());
  setSessionCookie(res, session, req.secure);
  res.json({ username: session.username, csrfToken: session.csrf });
});

adminApiRouter.post("/logout", (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

adminApiRouter.get("/config", requireAdmin, (_req: Request, res: Response) => {
  const config = getConfig();
  res.json({
    siteName: config.site.name,
    tags: listTags(),
    defaultTag: getDefaultTag(),
  });
});

adminApiRouter.post("/preview", requireAdmin, (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const markdown = typeof body.markdown === "string" ? body.markdown : "";
  res.json({ html: renderMarkdown(markdown) });
});

adminApiRouter.post(
  "/upload",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
      const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
      if (!match) {
        res.status(400).json({ error: "Invalid image data." });
        return;
      }

      const mime = (match[1] ?? "").toLowerCase();
      const extension = ALLOWED_IMAGE_TYPES[mime];
      if (!extension) {
        res.status(400).json({ error: "Unsupported image type." });
        return;
      }

      const buffer = Buffer.from(match[2] ?? "", "base64");
      if (buffer.length === 0) {
        res.status(400).json({ error: "Empty image data." });
        return;
      }
      if (buffer.length > MAX_UPLOAD_BYTES) {
        res.status(413).json({ error: "Image is too large (max 8 MB)." });
        return;
      }

      const base = sanitizeBaseName(
        typeof body.filename === "string" ? body.filename : "image",
      );
      const name = `${base}-${Date.now().toString(36)}.${extension}`;
      const dir = path.join(PUBLIC_DIR, "uploads");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, name), buffer);
      res.json({ url: `/uploads/${name}` });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  },
);

function registerKind(kind: AdminKind, base: string): void {
  adminApiRouter.get(`/${base}`, requireAdmin, async (_req, res) => {
    try {
      res.json({ items: await listItems(kind) });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  });

  adminApiRouter.get(`/${base}/:slug`, requireAdmin, async (req, res) => {
    const slug = req.params.slug ?? "";
    const item = await readItem(kind, slug);
    if (!item) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    res.json({ item, html: renderMarkdown(item.markdown) });
  });

  adminApiRouter.put(`/${base}/:slug`, requireAdmin, async (req, res) => {
    try {
      const slug = req.params.slug ?? "";
      if (req.query.create === "true" && (await itemExists(kind, slug))) {
        res
          .status(409)
          .json({
            error: "An item with this slug already exists.",
            exists: true,
          });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await writeItem(kind, slug, {
        title: typeof body.title === "string" ? body.title : "",
        date: typeof body.date === "string" ? body.date : undefined,
        tag: typeof body.tag === "string" ? body.tag : undefined,
        excerpt: typeof body.excerpt === "string" ? body.excerpt : undefined,
        image: typeof body.image === "string" ? body.image : undefined,
        markdown: typeof body.markdown === "string" ? body.markdown : "",
      });

      res.json({ ok: true, created: result.created, slug });
    } catch (err) {
      if (err instanceof AdminContentError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: errorMessage(err) });
    }
  });

  adminApiRouter.delete(`/${base}/:slug`, requireAdmin, async (req, res) => {
    try {
      const slug = req.params.slug ?? "";
      const deleted = await deleteItem(kind, slug);
      if (!deleted) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  });
}

registerKind("post", "posts");
registerKind("page", "pages");

// Unknown admin API paths should answer with JSON, not the SPA shell.
adminApiRouter.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found." });
});

// Turn body-parser errors (bad JSON, too large) into clean JSON responses.
adminApiRouter.use(
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status =
      typeof err === "object" && err && "status" in err
        ? Number((err as { status?: number }).status) || 500
        : 500;
    res.status(status).json({ error: errorMessage(err) });
  },
);

export async function renderAdminShell(
  _req: Request,
  res: Response,
): Promise<void> {
  let siteName = "mdkiln";
  try {
    siteName = getConfig().site.name;
  } catch {
    // config may not be loaded yet; fall back to a generic title
  }

  try {
    const html = await ejs.renderFile(
      path.join(VIEWS_DIR, "admin.ejs"),
      { title: `Admin — ${siteName}`, siteName },
      { views: [VIEWS_DIR] },
    );
    res.set("Cache-Control", "no-store");
    res.type("html").send(html);
  } catch (err) {
    res
      .status(500)
      .type("text")
      .send(`Admin unavailable: ${errorMessage(err)}`);
  }
}
