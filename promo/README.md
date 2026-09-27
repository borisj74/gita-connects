# Promo video

A 45-second promotional video and a 21-second reel for Gita Connects, rendered from the real app.

```sh
npm run dev            # in the repository root: the app must be running
cd promo
npm install
npm run video          # capture the shots, then render out/gita-connects-promo.mp4
```

- `capture.mjs` screenshots the app at 2× into `shots/`.
- `video.html` is the timeline: title cards, captions, and the camera moves
  over each shot (`SCENES`). Open it in a browser to see any frame.
- `render.mjs` steps through the timeline frame by frame and encodes a 1080p
  H.264 MP4 with a silent audio track. `node render.mjs --still 12` renders the
  frame at 12 s to `out/still.png`, for quick checks.

## The reel

```sh
npm run dev            # in the repository root
cd promo
npm run reel           # renders out/gita-connects-reel.mp4
npm run reel:vertical  # the 9:16 cut, out/gita-connects-reel-vertical.mp4
```

A faster cut, for social posts: a verse is dragged in from the chapters
panel, the camera rides a connection into verse 18.66, opens its panel, writes
a note, scrolls through the connected and suggested verses, expands the
network, and flashes the link types. It is rendered from the live app rather
than from screenshots: `reel.js` is injected into the page and drives React
Flow's viewport, the nodes, edges and panels directly, so every zoom stays
sharp, and its clicks, drop and note are real. For motion blur, each frame
averages 4 to 24 renders, more where the camera moves fast. A render takes
about twelve minutes.

- `node reel.mjs --samples 1` renders without motion blur, four times faster.
- `node reel.mjs --still 4.2` (or `--still 1,4.2,9`) writes single frames to
  `out/reel-<t>.png`.
- The beats are the `T` table at the top of `reel.js`; the framing of each
  shot, for either shape, is the `L` table beside it.
- The vertical cut renders the app at 810 × 1440 and scales it by 4/3 to
  1080 × 1920: wide enough for the app's desktop layout, with its interface a
  third larger. Its captions sit at the top, clear of Instagram's buttons and
  caption at the bottom of a reel, and the camera closes in on the verse panel
  alone, since it is too narrow to read beside the card.

**No BBT text.** Prabhupada's translation is displayed in the app under the
Bhaktivedanta Book Trust's permission, which does not extend to promotional
material. Capture and the reel refuse every `/api/verse` request, and the shots use the
hand-curated verses, whose cards carry the project's own summaries. The
sidebar, which shows the BBT chapter titles, is collapsed in every shot of the
promo; the reel opens it with the chapter titles hidden.
