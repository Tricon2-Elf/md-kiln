async function getStatus(options = {}) {
  const {
    url,
    onlineField = 'online',
    playersField = 'players',
    timeout = 5000,
  } = options;

  if (!url) {
    throw new Error('http status plugin requires a "url" option');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return { online: false, metrics: { players: 0 } };
    }

    const data = await res.json();
    const online = Boolean(data[onlineField]);
    const players = online ? Number(data[playersField] ?? 0) : 0;

    return { online, metrics: { players } };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { getStatus };
