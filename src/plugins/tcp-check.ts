import net from "net";
import type { StatusOptions, TcpCheckStatusOptions } from "../types/config";
import type { StatusResult } from "../types/plugins";

function checkTcp(
  host: string,
  port: number,
  timeout = 3000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (online: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(online);
    };

    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

export async function getStatus(
  options: StatusOptions = {},
): Promise<StatusResult> {
  const {
    host = "127.0.0.1",
    port = 8080,
    timeout = 3000,
    playersWhenOnline = 0,
  } = options as TcpCheckStatusOptions;
  const online = await checkTcp(host, port, timeout);

  return {
    online,
    metrics: {
      players: online ? playersWhenOnline : 0,
    },
  };
}
