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
import { existsSync } from 'node:fs';

const PROBE = 'https://vedabase.io/en/library/bg/2/47/';

// With a local copy of the book (npm run import:bbt), verses never touch
// Vedabase, so there is nothing to check.
if (existsSync(new URL('../private/bbt/bg.json', import.meta.url))) {
  console.log('✓ Using your local copy of Bhagavad-gita As It Is: verse text loads instantly, even offline.\n');
} else try {
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
  console.warn('  Everything else — graph, themes, concepts, search — works offline.');
  console.warn('  To show verse text without Vedabase, import the book first: npm run import:bbt -- <path to the EPUB>\n');
}

console.log('Open each verse you plan to show once before you start; the first load takes a moment.');
console.log('Anyone on the same network can open the "Network" address below.\n');

const dev = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: process.platform === 'win32' });
dev.on('exit', (code) => process.exit(code ?? 0));
