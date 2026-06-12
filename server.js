const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const { runStatusPlugin } = require('./plugins');
const { loadConfig, getConfig } = require('./lib/content');
const { OUTPUT_DIR } = require('./lib/build');
const { runBuild, startWatcher } = require('./lib/watch');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, 'public');

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'https:'],
        'frame-src': ["'self'", 'https:'],
        'upgrade-insecure-requests': null,
      },
    },
  }),
);

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
