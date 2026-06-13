import type { HttpStatusOptions, StatusOptions } from "../types/config";
import type { StatusResult } from "../types/plugins";

function asHttpOptions(options: StatusOptions): HttpStatusOptions {
  if (!("url" in options) || typeof options.url !== "string" || !options.url) {
    throw new Error('http status plugin requires a "url" option');
  }
  return options as HttpStatusOptions;
}

export async function getStatus(
  options: StatusOptions = {},
): Promise<StatusResult> {
  const {
    url,
    onlineField = "online",
    playersField = "players",
    timeout = 5000,
  } = asHttpOptions(options);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return { online: false, metrics: { players: 0 } };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const online = Boolean(data[onlineField]);
    const players = online ? Number(data[playersField] ?? 0) : 0;

    return { online, metrics: { players } };
  } finally {
    clearTimeout(timer);
  }
}
