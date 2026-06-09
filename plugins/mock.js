async function getStatus(options = {}) {
  const online = options.online ?? true;
  const players = options.players ?? 0;

  return {
    online,
    metrics: { players: online ? players : 0 },
  };
}

module.exports = { getStatus };
