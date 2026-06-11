const express = require('express');
const path = require('path');
const { runStatusPlugin } = require('./plugins');
const { loadConfig, getConfig } = require('./lib/content');
const { OUTPUT_DIR } = require('./lib/build');
const { runBuild, startWatcher } = require('./lib/watch');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, 'public');

app.get('/api/status', async (_req, res) => {
  const config = getConfig();
  const statusConfig = config.status;
  if (!statusConfig?.plugin) {
    return res.json({ online: false, metrics: {} });
  }

  try {
    const result = await runStatusPlugin(statusConfig.plugin, statusConfig.options || {});
    res.json(result);
  } catch (err) {
    console.error('Status plugin error:', err.message);
    res.json({ online: false, metrics: {} });
  }
});

app.use(express.static(OUTPUT_DIR, { index: 'index.html' }));
app.use(express.static(PUBLIC_DIR));

app.get('*', (_req, res) => {
  res.sendFile(path.join(OUTPUT_DIR, 'index.html'));
});

async function start() {
  await loadConfig();
  await runBuild({ label: 'startup' });
  startWatcher();

  app.listen(PORT, () => {
    console.log(`${getConfig().site.name} running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
