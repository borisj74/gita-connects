// Starts the app for a live presentation from this machine.
//
// In production vedabase.io refuses Vercel's servers, so the verse panel
// cannot load Prabhupada's text there. Run locally, the dev server's own
// /api/verse fetches it from this machine's connection instead. This first
// checks that Vedabase is reachable from the current network — a venue's
// Wi-Fi may block it — then starts the dev server, which also prints the
// address other devices on the same network can open.
//
// Usage: npm run presentation
import { spawn } from 'node:child_process';

const PROBE = 'https://vedabase.io/en/library/bg/2/47/';

try {
  const res = await fetch(PROBE, {
    headers: { 'User-Agent': 'gita-connects (+https://gita-connects.vercel.app)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) {
    console.log('✓ Vedabase is reachable from this network: verse text will load.\n');
  } else {
    console.warn(`⚠ Vedabase answered HTTP ${res.status}: verse panels will show only the link to Vedabase.\n`);
  }
} catch (err) {
  console.warn(`⚠ Cannot reach Vedabase (${err.cause?.code ?? err.message}): verse panels will show only the link.`);
  console.warn('  Everything else — graph, themes, concepts, search — works offline.\n');
}

console.log('Open each verse you plan to show once before you start; the first load takes a moment.');
console.log('Anyone on the same network can open the "Network" address below.\n');

const dev = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: process.platform === 'win32' });
dev.on('exit', (code) => process.exit(code ?? 0));
