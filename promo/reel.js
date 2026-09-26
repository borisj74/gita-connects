// The timeline of the 15-second reel. reel.mjs injects this script into the
// running app and calls REEL.render(t) for every frame: the footage is the
// app's own DOM, so the camera is React Flow's viewport and every zoom stays
// sharp. The reel animates the real nodes, edges and verse panel, and draws
// its type, cursor and light on an overlay above them.
(() => {
  const W = 1920;
  const H = 1080;
  const DURATION = 15;

  const HUB = '18.66'; // the verse the reel opens
  const RIDE = '7.14-18.66-thematic'; // the connection the camera rides into it
  const TYPES = ['thematic', 'progression', 'goal', 'sequential', 'parallel'];

  // Beats, in seconds.
  const T = {
    iris: 1.5, // the dark intro opens onto the app
    dive: 2.0, // the camera dives onto a connection
    rideStart: 2.45,
    rideEnd: 3.5,
    open: 4.7, // click: the verse panel opens
    scroll: 6.05, // the panel scrolls to the connected verses
    expand: 7.4, // click: "Show 14 connected verses"
    types: 9.35, // the link types, one at a time
    typeLen: 0.44,
    outro: 11.95,
  };

  const ACTIONS = [
    { at: T.open, name: 'open' },
    { at: T.expand, name: 'expand' },
  ];

  // Palette: the app's, plus the dark of the intro and outro.
  const INK = '#292524';
  const CREAM = '#f4ece1';
  const TERRA = '#b15d43';
  const EMBER = '#e07a55';

  // ---------------------------------------------------------------- easing
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const logLerp = (a, b, p) => Math.exp(lerp(Math.log(a), Math.log(b), p));
  const outExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
  const inExpo = (p) => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10));
  const inOutExpo = (p) =>
    p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2;
  const outCubic = (p) => 1 - Math.pow(1 - p, 3);
  const inCubic = (p) => p * p * p;
  const inOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const outBack = (p) => 1 + 2.4 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2);
  // In over `r` seconds from a, out over `r` seconds before b.
  const ramp = (t, a, b, r) => Math.min(clamp((t - a) / r), clamp((b - t) / r));
  // A decaying wobble, for impacts.
  const impact = (t, t0) => (t < t0 ? 0 : Math.exp(-(t - t0) * 8) * Math.sin((t - t0) * 30));

  // Deterministic randomness for particles.
  function rng(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- the app
  const S = {}; // everything measured from the app

  function readGraph() {
    const nodes = new Map();
    for (const el of document.querySelectorAll('.react-flow__node')) {
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform);
      const n = { id: el.dataset.id, x: +m[1], y: +m[2], w: el.offsetWidth, h: el.offsetHeight };
      n.cx = n.x + n.w / 2;
      n.cy = n.y + n.h / 2;
      nodes.set(n.id, n);
    }
    // Edge labels render in edge order, through a portal.
    const labels = [...document.querySelectorAll('.edge-label-wrapper')];
    const edges = [...document.querySelectorAll('.react-flow__edge')].map((el, i) => {
      const id = el.dataset.testid.replace('rf__edge-', '');
      const [src, tgt, type] = id.split('-');
      const path = el.querySelector('path.react-flow__edge-path');
      const label = labels[i];
      if (label) label.dataset.reel = id;
      el.dataset.reel = id;
      return { id, src, tgt, type, path, L: path.getTotalLength(), label, name: label?.textContent ?? type, color: getComputedStyle(path).stroke };
    });
    return { nodes, edges };
  }

  const cssEsc = (s) => s.replace(/"/g, '\\"');
  const nodeSel = (id) => `.react-flow__node[data-id="${cssEsc(id)}"]`;
  const edgeSel = (id) => `.react-flow__edge[data-reel="${cssEsc(id)}"]`;
  const labelSel = (id) => `.edge-label-wrapper[data-reel="${cssEsc(id)}"]`;

  // ---------------------------------------------------------------- camera
  // A camera is the flow point at the centre of the frame, and a zoom.
  const shot = (px, py, z, sx = W / 2, sy = H / 2) => ({ cx: px + (W / 2 - sx) / z, cy: py + (H / 2 - sy) / z, z });
  const mix = (a, b, p) => (p <= 0 ? a : p >= 1 ? b : { cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p), z: logLerp(a.z, b.z, p) });
  function fit(nodes, margin, sx, sy) {
    const xs = nodes.flatMap((n) => [n.x, n.x + n.w]);
    const ys = nodes.flatMap((n) => [n.y, n.y + n.h]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const z = Math.min((W * margin) / (x1 - x0), (H * margin) / (y1 - y0));
    return shot((x0 + x1) / 2, (y0 + y1) / 2, z, sx, sy);
  }
  const toScreen = (cam, fx, fy) => ({ x: (fx - cam.cx) * cam.z + W / 2, y: (fy - cam.cy) * cam.z + H / 2 });

  // The pulse that runs along the ridden connection.
  const rideU = (t) => inOutCubic(seg(t, T.rideStart, T.rideEnd));
  function ridePoint(t) {
    const e = S.ride;
    return e.path.getPointAtLength(rideU(t) * e.L);
  }

  function cameraAt(t) {
    const hub = S.graph.nodes.get(HUB);
    // Wide on the starter set, drifting in.
    let cam = mix(S.wide, { ...S.wide, z: S.wide.z * 1.08 }, seg(t, T.iris, T.dive + 0.6));
    // Dive onto the connection, then ride the pulse.
    const p = ridePoint(t);
    // (Framed right of centre, clear of the captions.)
    cam = mix(cam, shot(p.x, p.y, lerp(1.75, 1.6, seg(t, T.rideStart, T.rideEnd)), 1110, 470), inOutExpo(seg(t, T.dive, T.dive + 0.85)));
    // Land on the verse.
    cam = mix(cam, shot(hub.cx, hub.cy, 1.3, 1110, 500), inOutCubic(seg(t, T.rideEnd - 0.25, T.open - 0.35)));
    // Make room for the panel (screenAt zooms in on both), then drift.
    // (High in the frame, so the captions below stay clear of the card.)
    cam = mix(cam, shot(hub.cx, hub.cy, 1.12, 930, 285), inOutCubic(seg(t, T.open + 0.1, T.open + 0.9)));
    cam = mix(cam, shot(hub.cx, hub.cy, 1.17, 930, 285), seg(t, T.open + 0.9, T.expand));
    // Pull back to the whole network.
    if (S.fit) {
      cam = mix(cam, S.fit, inOutExpo(seg(t, T.expand + 0.2, T.expand + 1.45)));
      cam = mix(cam, { ...S.fit, cx: S.fit.cx - 60, z: S.fit.z * 1.07 }, inOutCubic(seg(t, T.expand + 1.45, T.outro)));
      // Centre on the verse the reel opened, for the iris to close on.
      cam = mix(cam, shot(hub.cx, hub.cy, S.fit.z * 0.85), inOutCubic(seg(t, T.outro - 0.15, T.outro + 0.7)));
    }
    return cam;
  }

  // The app as a whole: unfolds from a tilt in the intro.
  function screenAt(t) {
    const unfold = outExpo(seg(t, T.iris, T.iris + 0.95));
    // Close in on the verse and its panel together, anchored top right so
    // the panel's header stays in frame.
    const close = inOutCubic(seg(t, T.open + 0.1, T.open + 0.9)) * (1 - inOutExpo(seg(t, T.expand + 0.2, T.expand + 1.3)));
    return {
      zs: lerp(1, 1.28, close),
      ax: W,
      ay: 0,
      rx: lerp(34, 0, unfold),
      rz: 0,
      s: lerp(0.8, 1, unfold) * (1 + 0.008 * impact(t, T.open) + 0.008 * impact(t, T.expand)),
      ty: 0,
      op: 1,
    };
  }

  // ---------------------------------------------------------------- overlay
  const svgNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const e = tag.startsWith('svg:') ? document.createElementNS(svgNS, tag.slice(4)) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') e.textContent = v;
      else if (k === 'style') e.style.cssText = v;
      else e.setAttribute(k, v);
    }
    parent?.appendChild(e);
    return e;
  };

  const STATIC_CSS = `
    *, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }
    html.reel-frozen .app, html.reel-frozen .app * { pointer-events: none !important; }
    *:focus-visible { outline: none !important; }
    html, body { background: #120e0b !important; }
    .app { transform-origin: 50% 50%; overflow: hidden; }
    .autosave-pill, .canvas-history, .canvas-zoom, .note-toast { display: none !important; }
    #reel { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; overflow: hidden;
      -webkit-font-smoothing: antialiased; font-kerning: normal; }
    #reel .layer { position: absolute; inset: 0; }
    #reel-dark { background: radial-gradient(ellipse at 50% 45%, #2a1f18 0%, #17110d 55%, #0d0a08 100%); }
    #reel .num { position: absolute; left: 0; right: 0; top: 330px; text-align: center; font-family: 'Cormorant Garamond', serif;
      font-weight: 600; font-size: 300px; line-height: 1; color: ${CREAM}; font-variant-numeric: lining-nums tabular-nums; }
    #reel .numlabel { position: absolute; left: 0; right: 0; top: 660px; text-align: center; font-family: Inter, sans-serif;
      font-weight: 500; font-size: 26px; letter-spacing: 14px; text-transform: uppercase; color: #d98a6a; }
    #reel .countless { position: absolute; left: 0; right: 0; top: 880px; text-align: center; font-family: 'Cormorant Garamond', serif;
      font-style: italic; font-weight: 500; font-size: 58px; color: #e9dccb; }
    #reel-capbg { background: radial-gradient(ellipse 1250px 560px at 0% 100%, rgba(251,248,244,0.97) 0%, rgba(251,248,244,0.9) 38%, rgba(251,248,244,0) 100%); }
    #reel .cap { position: absolute; left: 112px; bottom: 112px; }
    #reel .kicker { font-family: Inter, sans-serif; font-weight: 600; font-size: 22px; letter-spacing: 6px; text-transform: uppercase;
      color: ${TERRA}; margin-bottom: 18px; display: flex; align-items: center; gap: 16px; }
    #reel .kicker i { display: block; width: 44px; height: 2px; background: ${TERRA}; transform-origin: 0 50%; }
    #reel .line { font-family: 'Cormorant Garamond', serif; font-weight: 600; font-size: 112px; line-height: 1.02; color: ${INK};
      letter-spacing: -1px; white-space: nowrap; }
    #reel .m { display: inline-block; overflow: hidden; vertical-align: bottom; padding: 0 0.06em 0.1em 0; margin-bottom: -0.1em; }
    #reel .w { display: inline-block; }
    #reel .typeword { position: absolute; left: 112px; bottom: 100px; font-family: 'Cormorant Garamond', serif; font-style: italic;
      font-weight: 600; font-size: 128px; line-height: 1.1; white-space: nowrap; }
    #reel .typeword .dot { display: inline-block; width: 26px; height: 26px; border-radius: 50%; margin-right: 30px; vertical-align: middle; }
    #reel .typecount { position: absolute; left: 112px; bottom: 262px; font-family: Inter, sans-serif; font-weight: 600; font-size: 22px;
      letter-spacing: 6px; text-transform: uppercase; color: ${TERRA}; display: flex; align-items: center; gap: 16px; }
    #reel .typecount i { display: block; width: 44px; height: 2px; background: ${TERRA}; transform-origin: 0 50%; }
    #reel .end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    #reel .deva { font-family: 'Noto Serif Devanagari', serif; font-weight: 500; font-size: 40px; color: #d98a6a; letter-spacing: 2px; margin-bottom: 14px; }
    #reel .wordmark { font-family: 'Cormorant Garamond', serif; font-weight: 600; font-size: 184px; line-height: 1; color: ${CREAM}; letter-spacing: -1px; white-space: nowrap; }
    #reel .wordmark span { display: inline-block; }
    #reel .rule { width: 130px; height: 2px; background: #d98a6a; margin: 40px 0 34px; }
    #reel .tagline { font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 500; font-size: 52px; color: #d7c8b5; }
    #reel .small { font-family: Inter, sans-serif; font-weight: 500; font-size: 22px; letter-spacing: 6px; text-transform: uppercase; color: #a3ab93; margin-top: 44px; }
    #reel-cursor { position: absolute; left: 0; top: 0; width: 40px; height: 52px; transform-origin: 3px 3px;
      filter: drop-shadow(0 6px 10px rgba(41,37,36,0.28)); }
  `;

  const O = {}; // overlay elements

  function caption(kicker, lines) {
    const root = el('div', { class: 'cap' }, O.captions);
    const k = el('div', { class: 'kicker' }, root);
    const bar = el('i', {}, k);
    const km = el('span', { class: 'm' }, k);
    const kw = el('span', { class: 'w', text: kicker }, km);
    const words = [];
    for (const line of lines) {
      const l = el('div', { class: 'line' }, root);
      line.split(' ').forEach((word, i) => {
        if (i) l.appendChild(document.createTextNode(' '));
        const m = el('span', { class: 'm' }, l);
        words.push(el('span', { class: 'w', text: word }, m));
      });
    }
    return { root, bar, kw, words };
  }

  // Word-by-word, rising out of masks; leaving upward.
  function playCaption(c, t, tin, tout) {
    const on = t > tin - 0.01 && t < tout + 0.6;
    c.root.style.display = on ? 'block' : 'none';
    if (!on) return 0;
    const out = inExpo(seg(t, tout, tout + 0.32));
    c.bar.style.transform = `scaleX(${outExpo(seg(t, tin, tin + 0.5)) * (1 - out)})`;
    c.kw.style.transform = `translateY(${(1 - outExpo(seg(t, tin + 0.05, tin + 0.55))) * 110 - out * 110}%)`;
    c.words.forEach((w, i) => {
      const pin = outExpo(seg(t, tin + 0.08 + i * 0.07, tin + 0.68 + i * 0.07));
      const pout = inExpo(seg(t, tout + i * 0.03, tout + 0.3 + i * 0.03));
      w.style.transform = `translateY(${(1 - pin) * 115 - pout * 115}%)`;
    });
    return Math.min(clamp((t - tin) / 0.3), 1 - seg(t, tout + 0.1, tout + 0.5));
  }

  function buildOverlay() {
    el('style', { text: STATIC_CSS }, document.head);
    // Italic Cormorant, which the app does not load.
    el('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&display=block' }, document.head);
    O.dyn = el('style', {}, document.head);

    const root = el('div', { id: 'reel' }, document.body);

    // Intro: dark, with numbers and a constellation.
    O.dark = el('div', { id: 'reel-dark', class: 'layer' }, root);
    O.sky = el('svg:svg', { class: 'layer', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, root);
    O.n18 = el('div', { class: 'num', text: '18' }, root);
    O.n18l = el('div', { class: 'numlabel', text: 'Chapters' }, root);
    O.n700 = el('div', { class: 'num', text: '700' }, root);
    O.n700l = el('div', { class: 'numlabel', text: 'Verses' }, root);
    O.countless = el('div', { class: 'countless', text: 'Countless connections' }, root);

    // Particles and the constellation, drawn once and moved per frame.
    const r = rng(7);
    O.dust = [...Array(70)].map(() => ({
      x: r() * W, y: r() * H, s: 0.6 + r() * 2.2, a: 0.12 + r() * 0.45, v: 6 + r() * 22, ph: r() * 6.28,
      e: el('svg:circle', { fill: '#f1dcc6' }, O.sky),
    }));
    O.stars = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 17; i++) {
      const rad = 150 + 330 * Math.sqrt((i + 1) / 17);
      const a = i * golden + 0.4;
      O.stars.push({ x: Math.cos(a) * rad * 1.45, y: Math.sin(a) * rad * 0.82, d: rad });
    }
    O.links = [];
    O.stars.forEach((s, i) => {
      if (i < 9) O.links.push([null, i]);
      let best = -1, bd = Infinity;
      O.stars.forEach((o, j) => {
        if (j === i) return;
        const d = Math.hypot(o.x - s.x, o.y - s.y);
        if (d < bd && !O.links.some(([a, b]) => (a === j && b === i))) { bd = d; best = j; }
      });
      O.links.push([i, best]);
    });
    O.constellation = el('svg:g', {}, O.sky);
    O.linkEls = O.links.map(() => el('svg:line', { stroke: '#d98a6a', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, O.constellation));
    O.starEls = O.stars.map(() => el('svg:circle', { fill: '#f4ece1' }, O.constellation));
    O.core = el('svg:circle', { fill: EMBER }, O.constellation);
    O.coreHalo = el('svg:circle', { fill: 'none', stroke: EMBER, 'stroke-width': 2 }, O.constellation);
    O.irisRing = el('svg:circle', { fill: 'none', stroke: '#e9a585', 'stroke-width': 3, cx: W / 2, cy: H / 2 }, O.sky);

    // Captions over the app.
    O.capbg = el('div', { id: 'reel-capbg', class: 'layer' }, root);
    O.captions = el('div', { class: 'layer' }, root);
    O.caps = [
      { c: caption('Gita Connects', ['Every verse,', 'connected.']), tin: T.dive + 0.3, tout: T.rideEnd + 0.3 },
      { c: caption('01 — Open', ['Open any verse.']), tin: T.open + 0.35, tout: T.scroll + 0.3 },
      { c: caption('02 — Connected verses', ['Every link,', 'explained.']), tin: T.scroll + 0.45, tout: T.expand - 0.15 },
      { c: caption('03 — Expand', ['Follow the', 'threads.']), tin: T.expand + 0.5, tout: T.types - 0.15 },
    ];
    O.typecount = el('div', { class: 'typecount' }, O.captions);
    O.typebar = el('i', {}, O.typecount);
    O.typecountText = el('span', { class: 'w', text: '04 — Ten kinds of connection' }, el('span', { class: 'm' }, O.typecount));
    O.typewords = TYPES.map((type) => {
      const wrap = el('div', { class: 'typeword' }, O.captions);
      const m = el('span', { class: 'm' }, wrap);
      const w = el('span', { class: 'w' }, m);
      const dot = el('span', { class: 'dot' }, w);
      w.appendChild(document.createTextNode(''));
      return { type, wrap, w, dot };
    });

    // The end card.
    O.end = el('div', { class: 'end' }, root);
    O.deva = el('div', { class: 'deva', text: 'भगवद्गीता' }, O.end);
    const wm = el('div', { class: 'wordmark' }, O.end);
    O.letters = [...'Gita Connects'].map((ch) => el('span', { text: ch === ' ' ? ' ' : ch }, wm));
    O.rule = el('div', { class: 'rule' }, O.end);
    O.tagline = el('div', { class: 'tagline', text: 'See how the teachings of the Gītā connect' }, O.end);
    O.small = el('div', { class: 'small', text: 'A free study companion for devotees · In development' }, O.end);

    // The cursor and its click ripples.
    O.fx = el('svg:svg', { class: 'layer', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, root);
    O.ripples = [0, 1].map(() => el('svg:circle', { fill: 'none', stroke: EMBER, 'stroke-width': 3 }, O.fx));
    O.cursor = el('svg:svg', { id: 'reel-cursor', viewBox: '0 0 40 52' }, root);
    el('svg:path', {
      d: 'M3 3 L3 40 L12.5 31 L19 46 L26 43 L19.5 28.5 L32 28.5 Z',
      fill: '#fff', stroke: INK, 'stroke-width': 2.4, 'stroke-linejoin': 'round',
    }, O.cursor);

    // Light that travels along the ridden connection, drawn inside the
    // viewport so it moves with the camera.
    const vp = document.querySelector('.react-flow__viewport');
    O.flow = el('svg:svg', { style: 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:5' }, vp);
    O.trailGlow = el('svg:path', { fill: 'none', stroke: EMBER, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.35 }, O.flow);
    O.trail = el('svg:path', { fill: 'none', stroke: EMBER, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, O.flow);
    O.headHalo = el('svg:circle', { fill: EMBER, opacity: 0.25 }, O.flow);
    O.head = el('svg:circle', { fill: '#fff', stroke: EMBER }, O.flow);
  }

  // ---------------------------------------------------------------- setup
  async function init() {
    buildOverlay();
    // Retry: a web font fetch can fail once through the session's proxy.
    for (let i = 0; i < 4; i++) {
      try {
        await document.fonts.load('italic 600 100px "Cormorant Garamond"');
        await document.fonts.load('500 40px "Noto Serif Devanagari"', 'भगवद्गीता');
        await document.fonts.ready;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    S.graph = readGraph();
    S.starter = new Set(S.graph.nodes.keys());
    S.starterEdges = new Set(S.graph.edges.map((e) => e.id));
    S.wide = fit([...S.graph.nodes.values()], 0.86, W / 2, H / 2 + 10);
    S.ride = S.graph.edges.find((e) => e.id === RIDE);
    if (!S.ride) throw new Error(`No ${RIDE} connection in the starter set`);
    O.trail.setAttribute('d', S.ride.path.getAttribute('d'));
    O.trailGlow.setAttribute('d', S.ride.path.getAttribute('d'));
    // Where along the ride the pulse passes the connection's label.
    const lm = /translate\(([-\d.]+)px, ([-\d.]+)px\)$/.exec(S.ride.label.style.transform);
    let best = Infinity;
    for (let i = 0; i <= 200; i++) {
      const q = S.ride.path.getPointAtLength((i / 200) * S.ride.L);
      const d = Math.hypot(q.x - lm[1], q.y - lm[2]);
      if (d < best) { best = d; S.rideLabelU = i / 200; }
    }
    return { duration: DURATION, actions: ACTIONS };
  }

  // After the verse panel opens.
  function afterOpen() {
    S.panel = document.querySelector('.verse-detail');
    S.panelW = S.panel.offsetWidth;
    const parts = [...S.panel.children].flatMap((c) => (c.classList.contains('vd-body') ? [...c.children] : [c]));
    parts.forEach((p, i) => (p.dataset.reelPart = i));
    S.panelParts = parts.length;
    const connected = [...S.panel.querySelectorAll('.vd-connected')];
    connected.forEach((c, i) => (c.dataset.reelConn = i));
    S.connected = connected.length;
    const section = connected[0]?.closest('.vd-section');
    S.scrollTo = section ? Math.min(section.offsetTop - 70, S.panel.scrollHeight - S.panel.clientHeight) : 0;
  }

  // After the network expands: time each new verse by its distance from the hub.
  function afterExpand() {
    S.graph = readGraph();
    const hub = S.graph.nodes.get(HUB);
    const fresh = [...S.graph.nodes.values()].filter((n) => !S.starter.has(n.id));
    const far = Math.max(...fresh.map((n) => Math.hypot(n.cx - hub.cx, n.cy - hub.cy)));
    S.popAt = new Map(fresh.map((n) => [n.id, T.expand + 0.45 + 0.75 * (Math.hypot(n.cx - hub.cx, n.cy - hub.cy) / far)]));
    S.drawAt = new Map();
    for (const e of S.graph.edges) {
      if (S.starterEdges.has(e.id)) continue;
      const ends = [e.src, e.tgt].map((id) => S.popAt.get(id) ?? T.expand + 0.3);
      // Draw from the end that appears first, toward the other.
      const fromSrc = ends[0] <= ends[1];
      S.drawAt.set(e.id, { a: Math.min(...ends) - 0.05, b: Math.max(...ends) + 0.15, fromSrc });
    }
    S.fit = fit([...S.graph.nodes.values()], 0.84, 1150, 540);
  }

  // Where the cursor clicks, in screen pixels, for the running camera.
  function rectOf(selector) {
    const e = document.querySelector(selector);
    return e ? e.getBoundingClientRect() : null;
  }
  function target(name) {
    // Once clicked, a target stays where it was: the expand button goes away.
    if (S.clicked?.[name]) return S.clicked[name];
    if (name === 'open') {
      const r = rectOf(`${nodeSel(HUB)} .node-translation`) ?? rectOf(nodeSel(HUB));
      return { x: r.left + r.width * 0.58, y: r.top + r.height * 0.45 };
    }
    if (name === 'list') {
      const r = rectOf('[data-reel-conn="0"]');
      return r ? { x: r.left + r.width * 0.62, y: r.top + r.height * 0.5 } : { x: 1700, y: 700 };
    }
    if (name === 'expand') {
      const r = rectOf(`${nodeSel(HUB)} .node-expand`);
      return r ? { x: r.left + r.width * 0.42, y: r.top + r.height * 0.55 } : { x: 700, y: 800 };
    }
  }

  // ---------------------------------------------------------------- frame
  function render(t) {
    const css = [];
    const cam = cameraAt(t);
    css.push(`.react-flow__viewport { transform: translate(${W / 2 - cam.cx * cam.z}px, ${H / 2 - cam.cy * cam.z}px) scale(${cam.z}) !important; }`);
    // Connections at least ~2.4 px wide on screen, so they stay crisp when
    // the camera is wide.
    S.edgeW = Math.max(3, 2.4 / cam.z);
    css.push(`.react-flow__edge path.react-flow__edge-path { stroke-width: ${S.edgeW}px !important; }`);

    const sc = screenAt(t);
    const flat = Math.abs(sc.rx) < 0.01 && Math.abs(sc.rz) < 0.01 && Math.abs(sc.s - 1) < 1e-4 && sc.ty === 0;
    const zoom = `translate(${sc.ax - W / 2}px, ${sc.ay - H / 2}px) scale(${sc.zs}) translate(${W / 2 - sc.ax}px, ${H / 2 - sc.ay}px)`;
    css.push(flat
      ? `.app { transform: ${sc.zs === 1 ? 'none' : zoom}; }`
      : `.app { transform: perspective(2400px) translateY(${sc.ty}px) rotateX(${sc.rx}deg) rotateZ(${sc.rz}deg) scale(${sc.s}) ${sc.zs === 1 ? '' : zoom};
          border-radius: ${28 * (1 - sc.s) * 2}px; opacity: ${sc.op}; box-shadow: 0 60px 140px rgba(0,0,0,0.55); }`);

    renderRide(t, cam, css);
    // The opened verse lights up again as the iris closes on it.
    const last = inOutCubic(seg(t, T.outro, T.outro + 0.4));
    if (last > 0) {
      css.push(`${nodeSel(HUB)} > .verse-node { box-shadow: 0 0 0 ${8 * last}px rgba(224,122,85,${0.85 * last}), 0 0 ${120 * last}px rgba(224,122,85,${0.7 * last}) !important; }`);
    }
    renderPanel(t, css);
    renderExpand(t, css);
    renderTypes(t, css);

    O.dyn.textContent = css.join('\n');
    renderIntro(t);
    renderCaptions(t);
    renderCursor(t);
    renderEnd(t);
  }

  function renderIntro(t) {
    const on = t < T.dive + 0.4;
    O.dark.style.display = O.sky.style.display = on || t > T.outro ? 'block' : 'none';
    for (const e of [O.n18, O.n18l, O.n700, O.n700l, O.countless]) e.style.display = on ? 'block' : 'none';

    // The iris opens from the centre of the constellation onto the app, and
    // closes on it again at the end.
    const opening = inOutExpo(seg(t, T.iris, T.iris + 0.7));
    const closing = inOutExpo(seg(t, T.outro, T.outro + 0.8));
    const iris = (t > T.outro ? 1 - closing : opening) * 1250;
    const mask = iris > 0 ? `radial-gradient(circle at 50% 50%, transparent ${iris}px, #000 ${iris + 60}px)` : 'none';
    O.dark.style.webkitMaskImage = O.dark.style.maskImage = mask;
    O.irisRing.setAttribute('r', iris + 20);
    const ring = t > T.outro ? seg(t, T.outro + 0.05, T.outro + 0.35) * (1 - seg(t, T.outro + 0.55, T.outro + 0.8)) : on ? 1 - seg(t, T.iris + 0.15, T.iris + 0.7) : 0;
    O.irisRing.setAttribute('opacity', iris > 0 ? 0.8 * ring : 0);

    // "18 / Chapters", then "700 / Verses" counting up.
    const numStyle = (e, l, a, b) => {
      const pin = outExpo(seg(t, a, a + 0.32));
      const pout = inCubic(seg(t, b - 0.12, b));
      const s = lerp(1.35, 1, pin) * lerp(1, 0.86, pout) * (1 + 0.05 * seg(t, a, b));
      e.style.opacity = pin * (1 - pout);
      e.style.transform = `scale(${s})`;
      e.style.filter = `blur(${(1 - pin) * 18 + pout * 12}px)`;
      l.style.opacity = outCubic(seg(t, a + 0.08, a + 0.3)) * (1 - pout);
      l.style.letterSpacing = `${lerp(30, 14, outExpo(seg(t, a, a + 0.5)))}px`;
    };
    numStyle(O.n18, O.n18l, 0.05, 0.58);
    numStyle(O.n700, O.n700l, 0.58, 1.1);
    O.n700.textContent = String(Math.round(700 * outExpo(seg(t, 0.6, 0.98))));

    // Particles drift throughout the dark parts.
    const par = 1 + 0.9 * inCubic(seg(t, T.iris, T.iris + 0.7));
    const dustOp = t < T.outro ? 1 - seg(t, T.iris + 0.1, T.iris + 0.6) : seg(t, T.outro + 0.5, T.outro + 1.2);
    for (const d of O.dust) {
      const x = W / 2 + (((d.x + t * d.v) % W) - W / 2) * par;
      const y = H / 2 + (d.y - H / 2 - t * d.v * 0.3) * par;
      d.e.setAttribute('cx', x);
      d.e.setAttribute('cy', y);
      d.e.setAttribute('r', d.s * (t > T.outro ? 1 : par));
      d.e.setAttribute('opacity', dustOp * d.a * (0.6 + 0.4 * Math.sin(t * 2.4 + d.ph)));
    }

    // The constellation: the "700" collapses to a point that throws out
    // threads, then the camera flies through it as the iris opens.
    const intro = t < T.outro;
    const cs = intro ? lerp(1, 3.2, inExpo(seg(t, T.iris - 0.05, T.iris + 0.6))) : lerp(1.6, 1.8, seg(t, T.outro + 1, DURATION));
    const cOp = intro ? 1 - seg(t, T.iris + 0.2, T.iris + 0.55) : 0.28 * outCubic(seg(t, T.outro + 0.9, T.outro + 1.8));
    const rot = intro ? t * 4 : 10 + t * 2;
    O.constellation.setAttribute('transform', `translate(${W / 2} ${H / 2}) rotate(${rot}) scale(${cs})`);
    O.constellation.setAttribute('opacity', cOp);
    const born = intro ? 1.02 : T.outro + 0.9;
    // In the outro the constellation is only a backdrop: no centre, behind the wordmark.
    O.core.setAttribute('r', intro ? 11 * outBack(seg(t, born, born + 0.25)) : 0);
    O.coreHalo.setAttribute('r', 11 + 70 * outExpo(seg(t, born + 0.05, born + 0.7)));
    O.coreHalo.setAttribute('opacity', t < born || !intro ? 0 : 0.9 * (1 - seg(t, born + 0.05, born + 0.7)));
    O.stars.forEach((s, i) => {
      const p = outBack(seg(t, born + 0.05 + s.d / 2200, born + 0.3 + s.d / 2200));
      O.starEls[i].setAttribute('cx', s.x);
      O.starEls[i].setAttribute('cy', s.y);
      O.starEls[i].setAttribute('r', 5.5 * p);
    });
    O.links.forEach(([a, b], i) => {
      const A = a === null ? { x: 0, y: 0, d: 0 } : O.stars[a];
      const B = O.stars[b];
      const p = outExpo(seg(t, born + 0.02 + A.d / 2600, born + 0.4 + B.d / 2600));
      O.linkEls[i].setAttribute('x1', A.x);
      O.linkEls[i].setAttribute('y1', A.y);
      O.linkEls[i].setAttribute('x2', lerp(A.x, B.x, p));
      O.linkEls[i].setAttribute('y2', lerp(A.y, B.y, p));
      O.linkEls[i].setAttribute('opacity', a === null ? (intro ? 0.9 : 0) : 0.5);
    });
    const cl = outExpo(seg(t, 1.12, 1.5)) * (1 - seg(t, T.iris, T.iris + 0.2));
    O.countless.style.opacity = cl;
    O.countless.style.transform = `translateY(${(1 - cl) * 30}px)`;
    O.countless.style.letterSpacing = `${lerp(8, 0, outExpo(seg(t, 1.12, 1.7)))}px`;
  }

  function renderRide(t, cam, css) {
    const u = rideU(t);
    const e = S.ride;
    const lit = t >= T.rideStart && t < T.open + 0.6;
    O.flow.style.display = lit ? 'block' : 'none';
    if (!lit) return;
    const fade = 1 - seg(t, T.open - 0.2, T.open + 0.5);
    const px = 1 / cam.z; // one screen pixel, in flow units
    O.trail.setAttribute('stroke-width', 5 * px);
    O.trailGlow.setAttribute('stroke-width', 18 * px);
    for (const p of [O.trail, O.trailGlow]) {
      p.setAttribute('stroke-dasharray', `${u * e.L} ${e.L + 10}`);
      p.setAttribute('opacity', (p === O.trail ? 1 : 0.3) * fade);
    }
    const q = e.path.getPointAtLength(u * e.L);
    const head = 1 - seg(t, T.rideEnd - 0.02, T.rideEnd + 0.18);
    O.head.setAttribute('cx', q.x);
    O.head.setAttribute('cy', q.y);
    O.head.setAttribute('r', 9 * px * head);
    O.head.setAttribute('stroke-width', 4 * px);
    O.headHalo.setAttribute('cx', q.x);
    O.headHalo.setAttribute('cy', q.y);
    O.headHalo.setAttribute('r', (30 + 8 * Math.sin(t * 20)) * px * head);

    // The label swells as the pulse passes it.
    const k = Math.exp(-Math.pow((u - S.rideLabelU) / 0.08, 2));
    css.push(`${labelSel(RIDE)} .edge-label { scale: ${1 + 0.45 * k} !important; box-shadow: 0 0 ${24 * k}px rgba(224,122,85,${0.7 * k}); }`);
    // The verse lights up when the pulse arrives.
    const glow = t < T.rideEnd ? 0 : Math.exp(-(t - T.rideEnd) * 2.2);
    if (glow > 0.01) {
      css.push(`${nodeSel(HUB)} > .verse-node { box-shadow: 0 0 0 ${3 + 5 * glow}px rgba(224,122,85,${0.8 * glow}), 0 0 ${90 * glow}px rgba(224,122,85,${0.55 * glow}) !important; }`);
    }
  }

  function renderPanel(t, css) {
    if (!S.panel) return;
    const pin = outExpo(seg(t, T.open + 0.05, T.open + 0.65));
    const pout = inExpo(seg(t, T.expand + 0.15, T.expand + 0.6));
    const x = (1 - pin + pout) * (S.panelW + 60);
    css.push(`.verse-detail { translate: ${x}px 0 !important; }`);
    for (let i = 0; i < S.panelParts; i++) {
      const p = outExpo(seg(t, T.open + 0.12 + i * 0.045, T.open + 0.72 + i * 0.045));
      css.push(`[data-reel-part="${i}"] { opacity: ${p}; translate: ${(1 - p) * 60}px 0; }`);
    }
    S.panel.scrollTop = S.scrollTo * inOutCubic(seg(t, T.scroll, T.scroll + 0.75));
    for (let i = 0; i < S.connected; i++) {
      const a = ramp(t, T.scroll + 0.55 + i * 0.14, T.expand + 0.1, 0.18);
      css.push(`[data-reel-conn="${i}"] { box-shadow: 0 0 0 ${2 * a}px rgba(224,122,85,${a}), 0 14px 34px rgba(177,93,67,${0.18 * a}) !important; }`);
    }
    // The verse card answers each click.
    const press = (t0) => Math.exp(-Math.pow((t - t0) / 0.07, 2));
    css.push(`${nodeSel(HUB)} > .verse-node { scale: ${1 - 0.025 * press(T.open)}; }`);
  }

  function renderExpand(t, css) {
    if (!S.popAt) return;
    for (const [id, at] of S.popAt) {
      const p = seg(t, at, at + 0.55);
      css.push(`${nodeSel(id)} > .verse-node { opacity: ${clamp(p * 3)}; scale: ${lerp(0.55, 1, outBack(p))}; }`);
    }
    for (const e of S.graph.edges) {
      const d = S.drawAt.get(e.id);
      if (!d) continue;
      const p = outCubic(seg(t, d.a, d.b));
      const off = (d.fromSrc ? 1 : -1) * e.L * (1 - p);
      css.push(`${edgeSel(e.id)} path.react-flow__edge-path { stroke-dasharray: ${e.L + 1} ${e.L + 1}; stroke-dashoffset: ${off}; ${p < 0.97 ? 'marker-end: none;' : ''} }`);
      const lp = seg(t, d.b - 0.1, d.b + 0.3);
      css.push(`${labelSel(e.id)} { opacity: ${lp} !important; } ${labelSel(e.id)} .edge-label { scale: ${lerp(0.4, 1, outBack(lp))} !important; }`);
    }
  }

  // One link type at a time: its connections glow, the rest recede.
  function typeWeight(t, i) {
    const a = T.types + 0.1 + i * T.typeLen;
    return ramp(t, a, a + T.typeLen + 0.02, 0.07);
  }
  function renderTypes(t, css) {
    if (!S.popAt) return;
    const end = T.types + 0.1 + TYPES.length * T.typeLen;
    const dim = ramp(t, T.types, end + 0.05, 0.12);
    if (dim <= 0) return;
    const nodeW = new Map();
    for (const e of S.graph.edges) {
      const i = TYPES.indexOf(e.type);
      const w = i < 0 ? 0 : typeWeight(t, i);
      nodeW.set(e.src, Math.max(nodeW.get(e.src) ?? 0, w));
      nodeW.set(e.tgt, Math.max(nodeW.get(e.tgt) ?? 0, w));
      const op = lerp(1, 0.06 + 0.94 * w, dim);
      // Thicker, not glowing: a CSS filter on a straight SVG line clips it to a stub.
      const sw = lerp(S.edgeW, S.edgeW * 2.6, w * dim);
      css.push(`${edgeSel(e.id)} { opacity: ${op}; } ${edgeSel(e.id)} path.react-flow__edge-path { stroke-width: ${sw}px !important; }`);
      css.push(`${labelSel(e.id)} { opacity: ${op} !important; } ${labelSel(e.id)} .edge-label { scale: ${1 + 0.5 * w * dim} !important; }`);
    }
    for (const n of S.graph.nodes.keys()) {
      const w = nodeW.get(n) ?? 0;
      css.push(`${nodeSel(n)} { opacity: ${lerp(1, 0.3 + 0.7 * w, dim)}; }`);
    }
  }

  function renderCaptions(t) {
    let bg = 0;
    for (const { c, tin, tout } of O.caps) bg = Math.max(bg, playCaption(c, t, tin, tout));

    // "04 — Ten kinds of connection" and the type names.
    const tIn = T.types;
    const tOut = T.types + 0.1 + TYPES.length * T.typeLen;
    const on = t > tIn - 0.01 && t < tOut + 0.5;
    O.typecount.style.display = on ? 'flex' : 'none';
    const out = inExpo(seg(t, tOut, tOut + 0.3));
    O.typebar.style.transform = `scaleX(${outExpo(seg(t, tIn, tIn + 0.5)) * (1 - out)})`;
    O.typecountText.style.transform = `translateY(${(1 - outExpo(seg(t, tIn + 0.05, tIn + 0.5))) * 110 - out * 110}%)`;
    O.typewords.forEach((tw, i) => {
      const a = T.types + 0.1 + i * T.typeLen;
      const b = a + T.typeLen;
      const vis = t > a - 0.01 && t < b + 0.2;
      tw.wrap.style.display = vis ? 'block' : 'none';
      if (!vis) return;
      if (!tw.set) {
        const e = S.graph.edges.find((x) => x.type === tw.type);
        const color = tw.type === 'parallel' ? '#a9706a' : (e?.color ?? TERRA);
        tw.w.lastChild.textContent = e?.name ?? tw.type;
        tw.w.style.color = color;
        tw.dot.style.background = e?.color ?? color;
        tw.set = true;
      }
      const pin = outExpo(seg(t, a, a + 0.22));
      const pout = inExpo(seg(t, b - 0.06, b + 0.1));
      tw.w.style.transform = `translateY(${(1 - pin) * 110 - pout * 110}%)`;
    });
    bg = Math.max(bg, on ? Math.min(clamp((t - tIn) / 0.3), 1 - seg(t, tOut + 0.1, tOut + 0.5)) : 0);
    O.capbg.style.opacity = bg;
  }

  function renderCursor(t) {
    const t0 = T.open - 0.55;
    const t1 = T.expand + 0.55;
    const on = t > t0 && t < t1;
    O.cursor.style.display = on ? 'block' : 'none';
    O.ripples.forEach((r) => r.setAttribute('opacity', 0));
    if (!on) return;
    const A = target('open');
    const B = target('list');
    const C = target('expand');
    const start = { x: A.x + 620, y: A.y + 460 };
    let p = start;
    const arc = (a, b, k, bend) => ({ x: lerp(a.x, b.x, k) + Math.sin(Math.PI * k) * bend, y: lerp(a.y, b.y, k) - Math.sin(Math.PI * k) * bend * 0.4 });
    p = arc(start, A, outCubic(seg(t, t0, T.open - 0.05)), 60);
    if (t > T.scroll - 0.35) p = arc(A, B, inOutCubic(seg(t, T.scroll - 0.35, T.scroll + 0.35)), -50);
    if (t > T.expand - 0.65) p = arc(B, C, inOutCubic(seg(t, T.expand - 0.65, T.expand - 0.06)), 70);
    if (t > T.expand + 0.1) p = { x: C.x + 160 * inCubic(seg(t, T.expand + 0.1, t1)), y: C.y + 240 * inCubic(seg(t, T.expand + 0.1, t1)) };
    const press = (tc) => Math.exp(-Math.pow((t - tc) / 0.06, 2));
    const s = 1 - 0.2 * (press(T.open) + press(T.expand));
    const fade = seg(t, t0, t0 + 0.1) * (1 - seg(t, T.expand + 0.25, t1));
    O.cursor.style.transform = `translate(${p.x - 3}px, ${p.y - 3}px) scale(${s})`;
    O.cursor.style.opacity = fade;
    [T.open, T.expand].forEach((tc, i) => {
      const k = seg(t, tc, tc + 0.5);
      if (k <= 0 || k >= 1) return;
      const at = i === 0 ? A : C;
      const r = O.ripples[i];
      r.setAttribute('cx', at.x);
      r.setAttribute('cy', at.y);
      r.setAttribute('r', 8 + 64 * outExpo(k));
      r.setAttribute('opacity', 0.85 * (1 - k));
    });
  }

  function renderEnd(t) {
    const a = T.outro + 0.95;
    const on = t > a;
    O.end.style.display = on ? 'flex' : 'none';
    if (!on) return;
    const rise = (e, t0, dy = 40, blur = 14) => {
      const p = outExpo(seg(t, t0, t0 + 0.7));
      e.style.opacity = clamp(p * 1.4);
      e.style.transform = `translateY(${(1 - p) * dy}px)`;
      e.style.filter = `blur(${(1 - p) * blur}px)`;
    };
    O.letters.forEach((l, i) => rise(l, a + 0.1 + i * 0.035, 70, 18));
    rise(O.deva, a + 0.05, 20, 8);
    O.rule.style.transform = `scaleX(${outExpo(seg(t, a + 0.55, a + 1.1))})`;
    rise(O.tagline, a + 0.7, 26, 8);
    rise(O.small, a + 1.0, 18, 6);
  }

  // Roughly how far, in screen pixels, the picture moves between t and t + dt:
  // how much motion blur the frame needs.
  function speed(t, dt) {
    const [a, b] = [cameraAt(t), cameraAt(t + dt)];
    const [p, q] = [screenAt(t), screenAt(t + dt)];
    const zoom = Math.abs(b.z / a.z - 1) * W / 2 + Math.abs(q.s / p.s - 1) * W / 2 + Math.abs(q.zs / p.zs - 1) * W;
    const pan = Math.hypot(b.cx - a.cx, b.cy - a.cy) * a.z;
    const turn = (Math.abs(q.rx - p.rx) + Math.abs(q.rz - p.rz)) * 15;
    return zoom + pan + turn;
  }

  // Hand the page back to the app: while React Flow measures new or resized
  // nodes it reads their size on screen against its own zoom, so the reel's
  // camera and scaling must be out of the way. render() puts them back.
  function release() {
    O.dyn.textContent = '';
  }

  function clicked(name, p) {
    S.clicked = { ...S.clicked, [name]: p };
  }

  window.REEL = { init, render, release, target, clicked, speed, afterOpen, afterExpand, DURATION, ACTIONS };
})();
