(function () {
  let statusTimer;

  async function fetchStatus() {
    const statusEl = document.getElementById("server-status");
    const playersEl = document.getElementById("player-count");
    const timeEl = document.getElementById("status-time");
    if (!statusEl) return;

    try {
      const res = await fetch("/api/status");
      const data = await res.json();

      statusEl.textContent = data.online ? "Online" : "Offline";
      statusEl.className = `status__badge ${data.online ? "status__badge--online" : "status__badge--offline"}`;

      if (playersEl) {
        const players = data.metrics?.players ?? 0;
        const slots = data.metrics?.slots;
        if (data.online) {
          playersEl.textContent =
            slots != null
              ? `${players.toLocaleString()} / ${Number(slots).toLocaleString()}`
              : players.toLocaleString();
        } else {
          playersEl.textContent = "0";
        }
      }
    } catch {
      statusEl.textContent = "Unknown";
      statusEl.className = "status__badge status__badge--offline";
      if (playersEl) playersEl.textContent = "—";
    }

    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();
  }

  function initStatusWidget() {
    if (statusTimer) clearInterval(statusTimer);
    void fetchStatus();
    statusTimer = setInterval(fetchStatus, 30000);
  }

  window.initStatusWidget = initStatusWidget;
  initStatusWidget();
})();
