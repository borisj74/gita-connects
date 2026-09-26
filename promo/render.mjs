// Renders video.html to out/gita-connects-promo.mp4, one frame at a time.
//
// Each frame sets the timeline to an exact time and screenshots the page, so
// the motion is smooth however long a frame takes to draw. Needs the shots
// from capture.mjs.
//
//   node render.mjs            the full video
//   node render.mjs --still 12 one frame at 12 s, to out/still.png
import { spawn } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import ffmpeg from 'ffmpeg-static';
import { chromium } from 'playwright';

const here = (p) => new URL(p, import.meta.url).pathname;
const stillAt = process.argv.includes('--still') ? Number(process.argv[process.argv.indexOf('--still') + 1]) : null;

try {
  await access(here('shots/wide.png'));
} catch {
  console.error('No shots yet: run `node capture.mjs` first (with the app running).');
  process.exit(1);
}
await mkdir(here('out'), { recursive: true });

const browser = await chromium.launch();
// ignoreHTTPSErrors: the session's egress proxy re-signs HTTPS, and the
// Google Fonts request would otherwise fail and fall back to system fonts.
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
await page.goto(`file://${here('video.html')}`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode()));
});
const fontsOk = await page.evaluate(() => document.fonts.check('64px "Cormorant Garamond"') && document.fonts.check('24px Inter'));
if (!fontsOk) console.warn('Warning: web fonts did not load; the video will use fallback fonts.');

const { FPS, DURATION } = await page.evaluate(() => ({ FPS: window.VIDEO.FPS, DURATION: window.VIDEO.DURATION }));

if (stillAt !== null) {
  await page.evaluate((t) => window.VIDEO.render(t), stillAt);
  await page.screenshot({ path: here('out/still.png') });
  console.log(`out/still.png at ${stillAt}s`);
  await browser.close();
  process.exit(0);
}

const out = here('out/gita-connects-promo.mp4');
const encoder = spawn(ffmpeg, [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  // Silent track, so players and social sites that expect audio accept it.
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
  '-map', '0:v', '-map', '1:a', '-shortest',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '128k',
  out,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const encoded = new Promise((resolve, reject) =>
  encoder.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))),
);

const frames = Math.round(DURATION * FPS);
for (let f = 0; f < frames; f++) {
  await page.evaluate((t) => window.VIDEO.render(t), f / FPS);
  const png = await page.screenshot({ type: 'png' });
  if (!encoder.stdin.write(png)) await new Promise((r) => encoder.stdin.once('drain', r));
  if (f % 90 === 0) process.stdout.write(`  frame ${f}/${frames}\r`);
}
encoder.stdin.end();
await encoded;
await browser.close();
console.log(`\n${out}  (${DURATION.toFixed(1)} s, ${frames} frames at ${FPS} fps)`);
