// Captures the app states the promo video animates, into promo/shots/.
//
// Needs the app running: `npm run dev` in the repository root.
//
// Prabhupada's text is displayed in the app under the Bhaktivedanta Book
// Trust's permission, which does not extend to a promotional video. So every
// /api/verse request is refused during capture, and the shots are built from
// the hand-curated verses, whose cards carry the project's own summaries. The
// Sanskrit shown in the verse panel is the public-domain text in src/data/verses.
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const APP = process.env.APP_URL ?? 'http://localhost:5173/';
const OUT = new URL('./shots/', import.meta.url);

try {
  await fetch(APP);
} catch {
  console.error(`The app is not running at ${APP}. Start it with \`npm run dev\` in the repository root.`);
  process.exit(1);
}
await mkdir(OUT, { recursive: true });

// Grayscale text antialiasing: subpixel (LCD) text leaves coloured fringes
// that show once the video scales the screenshots.
const browser = await chromium.launch({ args: ['--disable-lcd-text', '--font-render-hinting=none'] });

/** A fresh app (nothing saved from an earlier shot) with the starter set on the canvas. */
async function starter() {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    // The session's egress proxy re-signs HTTPS; without this, web fonts fail
    // and the app falls back to system fonts.
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
  return { context, page };
}

async function shot(name, setUp) {
  const { context, page } = await starter();
  await setUp(page);
  // Nothing the viewer should read as status chrome.
  await page.addStyleTag({ content: '*:focus-visible { outline: none !important; }' });
  await page.screenshot({ path: new URL(`${name}.png`, OUT).pathname });
  await context.close();
  console.log(`shots/${name}.png`);
}

const card = (page, id) => page.locator('.react-flow__node').filter({ hasText: id }).first();

await shot('wide', async () => {});

await shot('study', async (page) => {
  await card(page, '18.66').click({ position: { x: 60, y: 60 } });
  await page.waitForTimeout(1500);
  // Collapse the translation, which would only say it is not loaded here.
  await page.getByRole('button', { name: /^Translation/i }).click();
  await page.waitForTimeout(600);
});

await shot('network', async (page) => {
  await card(page, '18.66').getByText(/Show \d+ connected verses/).click();
  await page.waitForTimeout(2500);
});

await shot('search', async (page) => {
  await page.getByPlaceholder(/Search verses/).click();
  await page.keyboard.type('surrender');
  await page.waitForTimeout(800);
});

await shot('links', async (page) => {
  await page.getByRole('button', { name: /Link types/ }).click();
  await page.waitForTimeout(600);
});

await browser.close();
