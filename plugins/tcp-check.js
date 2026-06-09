const net = require('net');

function checkTcp(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (online) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(online);
    };

    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function getStatus(options = {}) {
  const { host = '127.0.0.1', port = 8080, timeout = 3000, playersWhenOnline = 0 } = options;
  const online = await checkTcp(host, port, timeout);

  return {
    online,
    metrics: {
      players: online ? playersWhenOnline : 0,
    },
  };
}

module.exports = { getStatus };
