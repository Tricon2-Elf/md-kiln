import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import { runStatusPlugin } from './plugins';
import { loadConfig, getConfig } from './lib/content';
import { OUTPUT_DIR } from './lib/build';
import { runBuild, startWatcher } from './lib/watch';
import { PUBLIC_DIR } from './paths';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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
    res.json({ online: false, metrics: {} });
    return;
  }

  try {
    const result = await runStatusPlugin(statusConfig.plugin, statusConfig.options ?? {});
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Status plugin error:', message);
    res.json({ online: false, metrics: {} });
  }
});

app.use(express.static(OUTPUT_DIR, { index: 'index.html' }));
app.use(express.static(PUBLIC_DIR));

app.get('*', (_req, res) => {
  res.sendFile(path.join(OUTPUT_DIR, 'index.html'));
});

async function start(): Promise<void> {
  await loadConfig();
  await runBuild({ label: 'startup' });
  startWatcher();

  app.listen(PORT, () => {
    console.log(`${getConfig().site.name} running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Failed to start:', message);
  process.exit(1);
});
