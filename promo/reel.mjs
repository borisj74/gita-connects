// Renders the reel to out/gita-connects-reel.mp4, straight from the
// running app: reel.js drives the app's own DOM, one frame at a time.
//
// Needs the app running: `npm run dev` in the repository root.
//
//   node reel.mjs                   the reel, with motion blur
//   node reel.mjs --samples 1       faster, without motion blur
//   node reel.mjs --still 4.2       one frame at 4.2 s, to out/reel-4.2.png
//   node reel.mjs --still 1,4.2,9   several frames
//   node reel.mjs --vertical        the 9:16 cut, to out/gita-connects-reel-vertical.mp4
//   node reel.mjs --square          the 1:1 cut, to out/gita-connects-reel-square.mp4
//
// As in capture.mjs, every /api/verse request is refused, so no Prabhupada
// text can reach the reel: the cards show the project's own summaries.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import ffmpeg from 'ffmpeg-static';
import { chromium } from 'playwright';

const APP = process.env.APP_URL ?? 'http://localhost:5173/';
const here = (p) => new URL(p, import.meta.url).pathname;
const arg = (name, fallback) => (process.argv.includes(name) ? Number(process.argv[process.argv.indexOf(name) + 1]) : fallback);
// --still takes one time or a comma-separated list, in order.
// Vertical: the app at 810 × 1440, scaled 4/3 to a 1080 × 1920 frame. Wide
// enough for the app's desktop layout, with its interface a third larger.
// Square likewise: 900 × 900 scaled 6/5 to 1080 × 1080.
const VERTICAL = process.argv.includes('--vertical');
const SQUARE = process.argv.includes('--square');
const VIEW = VERTICAL
  ? { width: 810, height: 1440, scale: 4 / 3 }
  : SQUARE
    ? { width: 900, height: 900, scale: 6 / 5 }
    : { width: 1920, height: 1080, scale: 1 };
const NAME = VERTICAL ? 'reel-vertical' : SQUARE ? 'reel-square' : 'reel';
const stills = process.argv.includes('--still') ? process.argv[process.argv.indexOf('--still') + 1].split(',').map(Number) : null;
const FPS = arg('--fps', 30);
// Motion blur: each frame averages up to SAMPLES renders across a third of
// the frame interval (a 120° shutter: enough to smooth the fast moves while
// keeping lines sharp). Slow frames need fewer distinct renders:
// each is written SAMPLES / n times, which averages the same.
const SAMPLES = arg('--samples', 24);
const SHUTTER = 1 / 3;
const STEPS = [1, 2, 3, 4, 6, 8, 12, 24].filter((n) => SAMPLES % n === 0 && n <= SAMPLES);
const MAX_GAP = 12; // pixels the picture may move between two renders

try {
  await fetch(APP);
} catch {
  console.error(`The app is not running at ${APP}. Start it with \`npm run dev\` in the repository root.`);
  process.exit(1);
}
await mkdir(here('out'), { recursive: true });

const browser = await chromium.launch({ args: ['--disable-lcd-text', '--font-render-hinting=none'] });
// A fresh browser context (nothing saved from a previous try) with the
// starter set and the reel loaded. Web fonts can fail to load through the
// session's proxy; reel.js refuses to start without them, so try again.
async function setUp() {
  const context = await browser.newContext({
    viewport: { width: VIEW.width, height: VIEW.height },
    deviceScaleFactor: VIEW.scale,
    // The session's egress proxy re-signs HTTPS; without this, web fonts fail.
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.route('**/api/verse**', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"not used in the promo"}' }),
  );
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Add starter set' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.getByRole('button', { name: 'Dismiss tip' }).click();
  await page.waitForTimeout(800);
  await page.addScriptTag({ path: here('reel.js') });
  const timeline = await page.evaluate(() => window.REEL.init());
  await page.waitForLoadState('networkidle');
  return { page, ...timeline };
}
let setup;
for (let attempt = 1; !setup; attempt++) {
  try {
    setup = await setUp();
  } catch (error) {
    if (attempt === 4 || !/fonts did not load/.test(error.message)) throw error;
    console.warn(`Web fonts did not load; retrying (${attempt}/3).`);
    for (const c of browser.contexts()) await c.close();
  }
}
const { page, duration, actions } = setup;
const freeze = (on) => page.evaluate((v) => document.documentElement.classList.toggle('reel-frozen', v), on);
await freeze(true);

// The reel's clicks are real. The reel's cursor shows where the click lands in
// the reel's framing; the click itself happens in the app's own layout, with
// the reel's camera released, so React Flow measures the new and resized
// nodes correctly and the connections meet their verses.
const HUB = '.react-flow__node[data-id="18.66"]';
const run = {
  async chapters(t) {
    await click('fab', t, '.chapters-fab');
    await page.waitForTimeout(500);
    // Open chapter 2, unless it already is.
    await page.evaluate(() => {
      const header = [...document.querySelectorAll('.chapter-header')].find((h) => h.querySelector('.chapter-number')?.textContent.trim() === 'Chapter 2');
      if (!header.classList.contains('expanded')) header.click();
    });
    await page.waitForTimeout(500);
    await settle(() => window.REEL.afterChapters());
  },
  // A real drop, through the app's own handler, at the reel's chosen spot.
  async drop(t) {
    await page.evaluate((time) => { window.REEL.render(time); window.REEL.release(); }, t);
    await page.evaluate(({ id, x, y }) => {
      const target = document.querySelector('.verse-network');
      const box = target.getBoundingClientRect();
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('verseId', id);
      // The app places the card at the drop point less (100, 50).
      const at = { clientX: box.left + x + 100, clientY: box.top + y + 50, bubbles: true, cancelable: true, dataTransfer };
      target.dispatchEvent(new DragEvent('dragover', at));
      target.dispatchEvent(new DragEvent('drop', at));
    }, await page.evaluate(() => ({ id: window.REEL.ADD, ...window.REEL.DROP })));
    await page.waitForTimeout(900);
    await settle(() => window.REEL.afterDrop());
  },
  async closeSide(t) {
    await click('close', t, '.sidebar-wrapper [aria-label="Collapse sidebar"]');
    await page.waitForTimeout(500);
    await settle(() => window.REEL.afterCloseSide());
  },
  async open(t) {
    await click('open', t, `${HUB} .node-translation`);
    await page.waitForTimeout(1200);
    // Collapse the translation, which would only say it is not loaded here.
    await page.evaluate(() => document.querySelector('button[aria-controls="vd-translation"]').click());
    await page.waitForTimeout(400);
    await settle(() => window.REEL.afterOpen());
  },
  async note(t) {
    await click('note', t, '.vd-note-add');
    await page.waitForTimeout(400);
    await settle(() => window.REEL.afterNote());
  },
  async save(t) {
    await page.evaluate(() => window.REEL.release());
    // The reel typed the note straight into the field; type it for real, so
    // the app has it to save.
    const note = page.locator('.vd-note-textarea');
    await note.fill('');
    await note.fill(await page.evaluate(() => window.REEL.NOTE));
    await click('save', t, '.vd-note-save');
    await page.waitForTimeout(600);
    await settle(() => window.REEL.afterSave());
  },
  async expand(t) {
    await page.evaluate(() => window.REEL.keepExpandButton());
    await click('expand', t, `${HUB} .node-expand`);
    await page.waitForTimeout(1800);
    await settle(() => window.REEL.afterExpand());
  },
};
async function click(name, t, selector) {
  await page.evaluate(([n, time]) => {
    window.REEL.render(time);
    window.REEL.clicked(n, window.REEL.target(n));
    window.REEL.release();
  }, [name, t]);
  await freeze(false);
  await page.locator(selector).click();
  await page.mouse.move(1, 1);
  await freeze(true);
}
const settle = (fn) => page.evaluate(fn);

const pending = [...actions];
async function renderAt(t) {
  while (pending.length && pending[0].at <= t) {
    const a = pending.shift();
    await run[a.name](a.at);
  }
  await page.evaluate((time) => window.REEL.render(time), t);
}

if (stills) {
  for (const t of stills) {
    await renderAt(t);
    await page.screenshot({ path: here(`out/${NAME}-${t}.png`) });
    console.log(`out/${NAME}-${t}.png`);
  }
  await browser.close();
  process.exit(0);
}

const out = here(`out/gita-connects-${NAME}.mp4`);
const rate = FPS * SAMPLES;
const encoder = spawn(ffmpeg, [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(rate), '-i', '-',
  // Silent track, so players and social sites that expect audio accept it.
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
  '-filter:v', SAMPLES > 1
    ? `tmix=frames=${SAMPLES},select='eq(mod(n\\,${SAMPLES})\\,${SAMPLES - 1})',setpts=N/(${FPS}*TB)`
    : 'null',
  '-r', String(FPS),
  '-map', '0:v', '-map', '1:a', '-shortest',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '128k',
  out,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const encoded = new Promise((resolve, reject) =>
  encoder.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))),
);

const frames = Math.round(duration * FPS);
let renders = 0;
for (let f = 0; f < frames; f++) {
  const moved = await page.evaluate(([t, dt]) => window.REEL.speed(t, dt), [f / FPS, SHUTTER / FPS]);
  const n = STEPS.find((k) => moved / k <= MAX_GAP) ?? SAMPLES;
  // At least four, for the motion that is not the camera's.
  const unique = STEPS.find((k) => k >= Math.max(n, Math.min(4, SAMPLES)));
  for (let s = 0; s < unique; s++) {
    await renderAt((f + (s / unique) * SHUTTER) / FPS);
    // PNG: JPEG's chroma subsampling smears thin coloured lines.
    const png = await page.screenshot({ type: 'png' });
    for (let r = 0; r < SAMPLES / unique; r++) {
      if (!encoder.stdin.write(png)) await new Promise((res) => encoder.stdin.once('drain', res));
    }
    renders++;
  }
  if (f % 30 === 0) process.stdout.write(`  frame ${f}/${frames}\r`);
}
encoder.stdin.end();
await encoded;
await browser.close();
console.log(`\n${out}  (${duration} s, ${frames} frames at ${FPS} fps, ${renders} renders)`);
