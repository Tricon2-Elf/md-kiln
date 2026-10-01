import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const COOKIE_NAME = "mdkiln_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

export interface AdminSession {
  username: string;
  expiresAt: number;
  csrf: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminSession;
    }
  }
}

interface AdminCredentials {
  username: string;
  password: string;
}

interface LoginAttempt {
  count: number;
  resetAt: number;
}

let cachedSecret: Buffer | undefined;
const loginAttempts = new Map<string, LoginAttempt>();

/**
 * Credentials come from the environment so they can be supplied by Docker
 * Compose / a process manager without ever touching config.json.
 */
export function getAdminCredentials(): AdminCredentials | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

export function isAdminConfigured(): boolean {
  return getAdminCredentials() !== null;
}

function getSecret(): Buffer {
  if (cachedSecret) return cachedSecret;

  const configured = process.env.ADMIN_SESSION_SECRET?.trim();
  if (configured) {
    cachedSecret = crypto.createHash("sha256").update(configured).digest();
    return cachedSecret;
  }

  // Deriving from the credentials keeps sessions valid across restarts when no
  // dedicated secret is configured.
  const creds = getAdminCredentials();
  cachedSecret = crypto
    .createHash("sha256")
    .update(`mdkiln-admin:${creds?.username ?? ""}:${creds?.password ?? ""}`)
    .digest();
  return cachedSecret;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Keep a comparison in the mismatched-length path to limit timing signals.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyCredentials(username: string, password: string): boolean {
  const creds = getAdminCredentials();
  if (!creds) return false;
  const usernameOk = safeEqual(username, creds.username);
  const passwordOk = safeEqual(password, creds.password);
  return usernameOk && passwordOk;
}

function signPayload(payload: AdminSession): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token: string): AdminSession | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");

  if (!safeEqual(signature, expected)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<AdminSession>;

    if (
      typeof parsed.username !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.csrf !== "string" ||
      parsed.expiresAt < Date.now()
    ) {
      return null;
    }

    return {
      username: parsed.username,
      expiresAt: parsed.expiresAt,
      csrf: parsed.csrf,
    };
  } catch {
    return null;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      cookies[key] = part.slice(separator + 1).trim();
    }
  }

  return cookies;
}

export function createSession(username: string): AdminSession {
  return {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS,
    csrf: crypto.randomBytes(24).toString("base64url"),
  };
}

export function setSessionCookie(
  res: Response,
  session: AdminSession,
  secure: boolean,
): void {
  res.cookie(COOKIE_NAME, signPayload(session), {
    httpOnly: true,
    sameSite: "strict",
    path: "/admin",
    maxAge: SESSION_TTL_MS,
    secure,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "strict",
    path: "/admin",
  });
}

export function readSession(req: Request): AdminSession | null {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Gate for every mutating admin endpoint. GET requests only need a valid
 * session; state-changing requests must also carry the session CSRF token,
 * which a cross-site form cannot provide.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isAdminConfigured()) {
    res.status(503).json({ error: "Admin is not configured." });
    return;
  }

  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    const token = req.get("x-csrf-token");
    if (!token || !safeEqual(token, session.csrf)) {
      res.status(403).json({ error: "Invalid CSRF token." });
      return;
    }
  }

  req.admin = session;
  next();
}

export function isLoginRateLimited(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(ip: string): void {
  loginAttempts.delete(ip);
}
