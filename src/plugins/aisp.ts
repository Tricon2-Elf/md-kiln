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

export async function getStatus(
  options: StatusOptions = {},
): Promise<StatusResult> {
  const { url = DEFAULT_URL, timeout = 5000 } = asAispOptions(options);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return { online: false, metrics: { players: 0, slots: 0 } };
    }

    const data = (await res.json()) as AispHealthzResponse;
    const msgServer = data.servers?.msgServer;
    const online = isHealthy(data.status) && isHealthy(msgServer?.state);

    const players = online ? Number(msgServer?.activeHandlers ?? 0) : 0;
    const slots = online ? Number(msgServer?.maxHandlers ?? 0) : 0;

    return { online, metrics: { players, slots } };
  } catch {
    return { online: false, metrics: { players: 0, slots: 0 } };
  } finally {
    clearTimeout(timer);
  }
}
