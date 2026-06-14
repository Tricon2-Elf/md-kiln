import path from "path";
import chokidar from "chokidar";
import {
  CONFIG_PATH,
  CONTENT_DIR,
  POSTS_DIR,
  ASSETS_DIR,
  VIEWS_DIR,
} from "../paths";
import { buildSite } from "./build";
import type { BuildResult, BuildTrigger } from "../types/build";

const DEBOUNCE_MS = 300;
const USE_POLLING = process.env.CHOKIDAR_USEPOLLING === "true";

interface WatchTarget {
  label: string;
  dir: string;
}

const WATCH_TARGETS: WatchTarget[] = [
  { label: "posts", dir: POSTS_DIR },
  { label: "content", dir: CONTENT_DIR },
  { label: "templates", dir: VIEWS_DIR },
  { label: "assets", dir: ASSETS_DIR },
];

let rebuildTimer: ReturnType<typeof setTimeout> | undefined;
let rebuilding = false;
let rebuildQueued = false;
let pendingTrigger: BuildTrigger | null = null;

function shouldRebuild(filename: string | null | undefined): boolean {
  if (!filename) return true;
  return /\.(md|json|ejs|css|js)$/i.test(filename);
}

function formatTrigger(trigger: BuildTrigger | null): string {
  if (!trigger) return "unknown";
  const { label, file } = trigger;
  return file ? `${label}: ${file}` : label;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatBuildStats(result: BuildResult): string {
  const saved = result.rawBytes - result.outBytes;
  const pct = result.rawBytes ? Math.round((saved / result.rawBytes) * 100) : 0;
  const minifyNote = result.minified
    ? `, ${formatBytes(saved)} saved (${pct}%)`
    : ", minify disabled";
  return `${result.count} pages in ${formatBytes(result.outBytes)}${minifyNote}`;
}

function resolveTrigger(filePath: string): BuildTrigger {
  if (filePath === CONFIG_PATH) {
    return { label: "config", file: filePath };
  }

  for (const target of WATCH_TARGETS) {
    if (
      filePath === target.dir ||
      filePath.startsWith(`${target.dir}${path.sep}`)
    ) {
      return { label: target.label, file: filePath };
    }
  }

  return { label: "unknown", file: filePath };
}

export async function runBuild(
  trigger: BuildTrigger = { label: "manual" },
): Promise<void> {
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
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Rebuild failed (${formatTrigger(trigger)}):`, message);
  } finally {
    rebuilding = false;

    if (rebuildQueued) {
      rebuildQueued = false;
      const next = pendingTrigger ?? { label: "queued changes" };
      pendingTrigger = null;
      void runBuild(next);
    }
  }
}

function scheduleRebuild(trigger: BuildTrigger): void {
  clearTimeout(rebuildTimer);
  console.log(
    `Change detected (${formatTrigger(trigger)}) — rebuild scheduled`,
  );

  rebuildTimer = setTimeout(() => {
    void runBuild(trigger);
  }, DEBOUNCE_MS);
}

export function startWatcher(): void {
  console.log("Watching for changes:");

  const watchPaths = [
    ...WATCH_TARGETS.map((target) => target.dir),
    CONFIG_PATH,
  ];
  for (const target of WATCH_TARGETS) {
    console.log(`  - ${target.label}: ${target.dir}`);
  }
  console.log(`  - config: ${CONFIG_PATH}`);
  if (USE_POLLING) {
    console.log("  - mode: polling (CHOKIDAR_USEPOLLING=true)");
  }

  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    usePolling: USE_POLLING,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
    ignored: (filePath, stats) => {
      if (stats?.isDirectory()) return false;
      return !shouldRebuild(path.basename(filePath));
    },
  });

  watcher.on("all", (_event, filePath) => {
    scheduleRebuild(resolveTrigger(filePath));
  });

  watcher.on("error", (err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("Watcher error:", message);
  });
}
