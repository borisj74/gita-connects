# Promo video

A 45-second promotional video for Gita Connects, rendered from the real app.

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

**No BBT text.** Prabhupada's translation is displayed in the app under the
Bhaktivedanta Book Trust's permission, which does not extend to promotional
material. Capture refuses every `/api/verse` request, and the shots use the
hand-curated verses, whose cards carry the project's own summaries. The
sidebar, which shows the BBT chapter titles, is collapsed in every shot.
