import type { AispStatusOptions, StatusOptions } from "../types/config";
import type { StatusResult } from "../types/plugins";

const DEFAULT_URL = "https://game.aisp.moe/healthz";

interface AispServerStatus {
  state?: string;
  activeHandlers?: number;
  availableSlots?: number;
  maxHandlers?: number;
}

interface AispHealthzResponse {
  status?: string;
  servers?: {
    msgServer?: AispServerStatus;
  };
}

function asAispOptions(options: StatusOptions): AispStatusOptions {
  return options as AispStatusOptions;
}

function isHealthy(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "healthy";
}

const CACHE_TTL_MS = 5000;

let cache: {
  url: string;
  result: StatusResult;
  expiresAt: number;
} | null = null;

export async function getStatus(
  options: StatusOptions = {},
): Promise<StatusResult> {
  const { url = DEFAULT_URL, timeout = 5000 } = asAispOptions(options);

  if (cache && cache.url === url && Date.now() < cache.expiresAt) {
    return cache.result;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let result: StatusResult;

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      result = { online: false, metrics: { players: 0, slots: 0 } };
    } else {
      const data = (await res.json()) as AispHealthzResponse;
      const msgServer = data.servers?.msgServer;
      const online = isHealthy(data.status) && isHealthy(msgServer?.state);

      const players = online ? Number(msgServer?.activeHandlers ?? 0) : 0;
      const slots = online ? Number(msgServer?.maxHandlers ?? 0) : 0;

      result = { online, metrics: { players, slots } };
    }
  } catch {
    result = { online: false, metrics: { players: 0, slots: 0 } };
  } finally {
    clearTimeout(timer);
  }

  cache = { url, result, expiresAt: Date.now() + CACHE_TTL_MS };
  return result;
}
