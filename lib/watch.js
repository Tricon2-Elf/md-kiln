const fs = require('fs');
const path = require('path');
const { CONFIG_PATH, POSTS_DIR, CONTENT_DIR } = require('./content');
const { buildSite } = require('./build');

const VIEWS_DIR = path.join(__dirname, '..', 'views');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const DEBOUNCE_MS = 300;

const WATCH_TARGETS = [
  { label: 'posts', dir: POSTS_DIR },
  { label: 'content', dir: CONTENT_DIR },
  { label: 'templates', dir: VIEWS_DIR },
  { label: 'assets', dir: ASSETS_DIR },
];

let rebuildTimer;
let rebuilding = false;
let rebuildQueued = false;
let pendingTrigger = null;

function shouldRebuild(filename) {
  if (!filename) return true;
  return /\.(md|json|ejs|css|js)$/i.test(filename);
}

function formatTrigger(trigger) {
  if (!trigger) return 'unknown';
  const { label, file } = trigger;
  return file ? `${label}: ${file}` : label;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatBuildStats(result) {
  const saved = result.rawBytes - result.outBytes;
  const pct = result.rawBytes ? Math.round((saved / result.rawBytes) * 100) : 0;
  const minifyNote = result.minified ? `, ${formatBytes(saved)} saved (${pct}%)` : ', minify disabled';
  return `${result.count} pages in ${formatBytes(result.outBytes)}${minifyNote}`;
}

async function runBuild(trigger = { label: 'manual' }) {
  if (rebuilding) {
    rebuildQueued = true;
    pendingTrigger = trigger;
    console.log(`Rebuild queued (${formatTrigger(trigger)})`);
    return;
  }

  rebuilding = true;
  const started = Date.now();
  console.log(`Rebuilding site (${formatTrigger(trigger)})...`);

  try {
    const result = await buildSite();
    const ms = Date.now() - started;
    console.log(`Rebuild complete — ${formatBuildStats(result)} (${ms}ms)`);
  } catch (err) {
    console.error(`Rebuild failed (${formatTrigger(trigger)}):`, err.message);
  } finally {
    rebuilding = false;

    if (rebuildQueued) {
      rebuildQueued = false;
      const next = pendingTrigger || { label: 'queued changes' };
      pendingTrigger = null;
      runBuild(next);
    }
  }
}

function scheduleRebuild(trigger) {
  clearTimeout(rebuildTimer);
  console.log(`Change detected (${formatTrigger(trigger)}) — rebuild scheduled`);

  rebuildTimer = setTimeout(() => {
    runBuild(trigger);
  }, DEBOUNCE_MS);
}

function watchDir({ label, dir }) {
  try {
    fs.watch(dir, { recursive: true }, (_event, filename) => {
      if (!shouldRebuild(filename)) return;

      const file = filename ? path.join(dir, filename) : dir;
      scheduleRebuild({ label, file });
    });
    console.log(`  - ${label}: ${dir}`);
  } catch (err) {
    console.warn(`Could not watch ${label} (${dir}):`, err.message);
  }
}

function startWatcher() {
  console.log('Watching for changes:');
  WATCH_TARGETS.forEach(watchDir);

  try {
    fs.watch(CONFIG_PATH, () => {
      scheduleRebuild({ label: 'config', file: CONFIG_PATH });
    });
    console.log(`  - config: ${CONFIG_PATH}`);
  } catch (err) {
    console.warn(`Could not watch config (${CONFIG_PATH}):`, err.message);
  }
}

module.exports = { runBuild, startWatcher };
