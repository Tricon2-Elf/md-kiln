import { loadConfig } from "../lib/content";
import { buildSite } from "../lib/build";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main(): Promise<void> {
  const started = Date.now();
  await loadConfig();
  const result = await buildSite();
  const ms = Date.now() - started;
  const saved = result.rawBytes - result.outBytes;
  const pct = result.rawBytes ? Math.round((saved / result.rawBytes) * 100) : 0;
  const minifyNote = result.minified
    ? `, ${formatBytes(saved)} saved (${pct}%)`
    : "";

  console.log(
    `Build complete — ${result.count} files in ${formatBytes(result.outBytes)}${minifyNote} (${ms}ms)`,
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
