/**
 * The landing page's moving parts: the links in the hero's app window, the
 * scroll-driven tour of the canvas, and the shaders behind the step
 * screenshots. The markup is static (landing.html); this wires it up and
 * returns a function that undoes everything.
 */

type Pt = { x: number; y: number };

const LABEL: Record<string, string> = {
  thematic: 'Thematic',
  progression: 'Progression',
  goal: 'Goal',
  'question-answer': 'Question–answer',
  contrast: 'Contrast',
  parallel: 'Parallel',
};
const TYPE_VAR: Record<string, string> = {
  thematic: '--thematic',
  progression: '--progression',
  goal: '--goal',
  'question-answer': '--qa',
  contrast: '--contrast',
  parallel: '--parallel',
  sequential: '--sequential',
  dependency: '--dependency',
  definition: '--definition',
  illustration: '--illustration',
};
const DIRECTED = new Set(['sequential', 'progression', 'dependency', 'question-answer', 'definition', 'illustration']);
const SVG_NS = 'http://www.w3.org/2000/svg';

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/**
 * React Flow's getSmoothStepPath for a bottom (source) to top (target)
 * handle, as ConnectionEdge.tsx draws it, so links here bend like the app's.
 */
function smoothStep(sx: number, sy: number, tx: number, ty: number, radius = 28, offset = 25) {
  const sg = { x: sx, y: sy + offset };
  const tg = { x: tx, y: ty - offset };
  const cx = (sx + tx) / 2;
  const cy = (sy + ty) / 2;
  const down = sg.y < tg.y;
  const mid = down ? [{ x: sg.x, y: cy }, { x: tg.x, y: cy }] : [{ x: cx, y: sg.y }, { x: cx, y: tg.y }];
  const pts: Pt[] = [{ x: sx, y: sy }, sg, ...mid, tg, { x: tx, y: ty }];
  const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
  const bend = (a: Pt, b: Pt, c: Pt) => {
    const s = Math.min(dist(a, b) / 2, dist(b, c) / 2, radius);
    const { x, y } = b;
    if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) return `L${x} ${y}`;
    if (a.y === y) {
      const xd = a.x < c.x ? -1 : 1;
      const yd = a.y < c.y ? 1 : -1;
      return `L ${x + s * xd},${y}Q ${x},${y} ${x},${y + s * yd}`;
    }
    const xd = a.x < c.x ? 1 : -1;
    const yd = a.y < c.y ? -1 : 1;
    return `L ${x},${y + s * yd}Q ${x},${y} ${x + s * xd},${y}`;
  };
  const d = pts.reduce(
    (r, p, i) => r + (i > 0 && i < pts.length - 1 ? bend(pts[i - 1], p, pts[i + 1]) : `${i ? 'L' : 'M'}${p.x} ${p.y}`),
    '',
  );
  return { d, lx: cx, ly: down ? cy : (sg.y + tg.y) / 2 };
}

/** Collects listeners and observers so the page can be torn down cleanly. */
class Cleanup {
  private fns: (() => void)[] = [];
  add(fn: () => void) {
    this.fns.push(fn);
  }
  on<K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) {
    window.addEventListener(type, fn, opts);
    this.add(() => window.removeEventListener(type, fn, opts));
  }
  run() {
    this.fns.splice(0).forEach((fn) => fn());
  }
}

function byId<T extends Element = HTMLElement>(root: ParentNode, id: string): T {
  const el = root.querySelector(`#${CSS.escape(id)}`);
  if (!el) throw new Error(`Landing page is missing #${id}`);
  return el as T;
}

function nodesById(container: ParentNode): Record<string, HTMLElement> {
  const out: Record<string, HTMLElement> = {};
  container.querySelectorAll<HTMLElement>('.node').forEach((n) => {
    if (n.dataset.id) out[n.dataset.id] = n;
  });
  return out;
}

/** Where a node's top or bottom handle sits, in its container's pixels. */
function handle(n: HTMLElement, which: 'top' | 'bottom'): [number, number] {
  const card = n.firstElementChild as HTMLElement;
  return [n.offsetLeft + card.offsetWidth / 2, n.offsetTop + (which === 'bottom' ? card.offsetHeight : 0)];
}

/* ---------- hero: the app in a browser window ----------
   The canvas sits at the app's 78% zoom; positions are in its own pixels.
   18.66 is the selected verse, so once the window is in view its links draw
   in, then flow as in the app: beads along directional links, a slow
   breathe on two-way ones. */
function hero(root: ParentNode, reduce: boolean, c: Cleanup, ready: Promise<unknown>) {
  const browser = byId(root, 'browser');
  const bscale = byId(root, 'bscale');
  const acanvas = byId(root, 'acanvas');
  const svg = byId<SVGSVGElement>(root, 'edges');
  const labels = byId(root, 'elabels');
  const N = nodesById(acanvas);
  // Curated links from the dataset, all converging on 18.66.
  const LINKS: [string, string, string][] = [
    ['4.7', '18.66', 'goal'],
    ['9.27', '18.66', 'progression'],
    ['12.13', '18.66', 'goal'],
  ];
  let drawn = reduce;

  const fit = () => {
    // On narrow screens the sidebar goes, so the canvas itself stays legible.
    const wrap = browser.parentElement as HTMLElement;
    const W = wrap.clientWidth - parseFloat(getComputedStyle(wrap).paddingLeft) * 2;
    const narrow = W < 760;
    const k = Math.min(1, W / (narrow ? 960 : 1280));
    browser.classList.toggle('narrow', narrow);
    bscale.style.transform = `scale(${k})`;
    browser.style.height = `${800 * k}px`;
  };
  const place = () => {
    const put = (id: string, cx: number, top: number) => {
      const n = N[id];
      n.style.left = `${cx - n.offsetWidth / 2}px`;
      n.style.top = `${top}px`;
    };
    const h = (id: string) => (N[id].firstElementChild as HTMLElement).offsetHeight;
    // A vertical run of 166px lets React Flow's corners reach their full 28px.
    const top = 84;
    const row = top + Math.max(h('4.7'), h('9.27'), h('12.13'));
    put('4.7', 165, top + 22);
    put('9.27', 490, top);
    put('12.13', 815, top + 22);
    put('18.66', 490, row + 22 + 166);
    fit();
  };
  const layout = () => {
    const on = drawn ? ' on' : '';
    const G = LINKS.map(([a, b, t]) => {
      const [sx, sy] = handle(N[a], 'bottom');
      const [tx, ty] = handle(N[b], 'top');
      return { t, dir: DIRECTED.has(t), color: css(TYPE_VAR[t]), ...smoothStep(sx, sy, tx, ty) };
    });
    svg.innerHTML =
      `<defs><marker id="arrow-progression" viewBox="-10 -10 20 20" refX="0" refY="0" markerWidth="16" markerHeight="16" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><polyline points="-5,-4 0,0 -5,4" fill="none" stroke="${css('--progression')}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>` +
      G.map(
        (g, i) =>
          `<g class="he${on}" style="--i:${i}">` +
          `<path class="hflow ${g.dir ? 'beads' : 'breathe'}" d="${g.d}" stroke="${g.color}" stroke-width="${g.dir ? 4.6 : 7.6}"/>` +
          `<path class="hhalo" d="${g.d}" pathLength="1" stroke="${g.color}" stroke-width="9.6"/>` +
          `<path class="hbase" d="${g.d}" pathLength="1" stroke="${g.color}" stroke-width="1.6"${g.dir ? ' marker-end="url(#arrow-progression)"' : ''}/></g>`,
      ).join('');
    labels.innerHTML = G.map(
      (g, i) =>
        `<span class="elabel hl${on}" style="--i:${i};left:${g.lx}px;top:${g.ly}px;border-color:${g.color};color:${g.color}"><i style="background:${g.color}"></i>${LABEL[g.t]}</span>`,
    ).join('');
  };
  const draw = () => {
    if (drawn) return;
    drawn = true;
    acanvas.querySelectorAll('.he,.hl').forEach((el) => el.classList.add('on'));
  };
  const relayout = () => {
    place();
    layout();
  };

  if (!drawn) {
    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          timer = window.setTimeout(draw, 350);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(browser);
    c.add(() => {
      io.disconnect();
      clearTimeout(timer);
    });
  }
  relayout();
  ready.then(relayout);
  c.on('resize', relayout);
  return relayout;
}

/* ---------- the tour: scroll scrubs the canvas ----------
   Every element's state is a function of scroll position, eased per frame,
   so the canvas moves with the reader in both directions instead of jumping
   between steps. */
function tour(root: ParentNode, reduce: boolean, c: Cleanup, ready: Promise<unknown>) {
  const section = byId(root, 'tour');
  const frame = byId(root, 'tframe');
  const twrap = byId(root, 'twrap');
  const tedges = byId<SVGSVGElement>(root, 'tedges');
  const tlabels = byId(root, 'tlabels');
  const pop = byId(root, 'tpop');
  const panel = byId(root, 'tpanel');
  const steps = [...root.querySelectorAll<HTMLElement>('#tsteps li')];
  const moreLabel = byId(root, 'tx-btn').querySelector('span') as HTMLElement;
  const N = nodesById(frame);

  // 2.47's real links (types and strengths from the curated data); 6.5 to
  // 6.35 is the reader's own. s: the step a link belongs to; at: where in
  // that step it starts drawing.
  const LINKS = [
    { a: '2.47', b: '3.19', t: 'thematic', s: 2, at: 0.18, focus: true },
    { a: '2.47', b: '5.10', t: 'thematic', s: 2, at: 0.26 },
    { a: '2.47', b: '3.35', t: 'progression', s: 2, at: 0.34 },
    { a: '2.47', b: '6.35', t: 'progression', s: 2, at: 0.42 },
    { a: '18.8', b: '2.47', t: 'contrast', s: 2, at: 0.5 },
    { a: '6.5', b: '6.35', t: 'thematic', s: 4, at: 0.3 },
  ];
  // React Flow's corners need a long enough vertical run, so rows are
  // spaced from the cards' measured heights.
  const RUN = 166;
  const win = (P: number, from: number, len: number) => easeIO(clamp01((P - from) / len));

  type Drawn = {
    link: (typeof LINKS)[number];
    g: SVGGElement;
    label: HTMLElement;
    dir: boolean;
    base: SVGPathElement;
    halo: SVGPathElement;
    spark: SVGCircleElement;
    flow: SVGPathElement | null;
    len: number;
  };
  let drawnLinks: Drawn[] = [];

  const place = () => {
    const h = (id: string) => (N[id].firstElementChild as HTMLElement).offsetHeight;
    const put = (id: string, cx: number, top: number) => {
      const n = N[id];
      n.style.left = `${cx - n.offsetWidth / 2}px`;
      n.style.top = `${top}px`;
    };
    const yCard = h('18.8') + RUN;
    const yRow = yCard + h('2.47') + RUN;
    const yRow2 = yRow + 60;
    put('18.8', 130, 0);
    put('2.47', 450, yCard);
    put('5.10', 300, yRow);
    put('3.35', 600, yRow);
    put('3.19', 95, yRow2);
    put('6.35', 805, yRow2);
    put('6.5', 790, yRow2 - RUN - h('6.5'));
    const FH = yRow2 + h('6.35') + 24;
    frame.style.height = `${FH}px`;
    const W = twrap.clientWidth;
    const H = twrap.clientHeight;
    const k = Math.min(1, W / 900, H / FH);
    frame.style.transform = `translate(${(W - 900 * k) / 2}px,${Math.max(0, (H - FH * k) / 2)}px) scale(${k})`;
  };

  const build = () => {
    tedges.innerHTML = `<defs><marker id="tarrow-progression" viewBox="-10 -10 20 20" refX="0" refY="0" markerWidth="16" markerHeight="16" markerUnits="strokeWidth" orient="auto-start-reverse"><polyline points="-5,-4 0,0 -5,4" fill="none" stroke="${css('--progression')}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>`;
    tlabels.innerHTML = '';
    drawnLinks = LINKS.map((link) => {
      const [sx, sy] = handle(N[link.a], 'bottom');
      const [tx, ty] = handle(N[link.b], 'top');
      const { d, lx, ly } = smoothStep(sx, sy, tx, ty);
      const color = css(TYPE_VAR[link.t]);
      const dir = DIRECTED.has(link.t);
      const flowing = (link.a === '2.47' || link.b === '2.47') && !reduce;
      const g = document.createElementNS(SVG_NS, 'g');
      g.innerHTML =
        (flowing
          ? `<path class="${dir ? 'beads' : 'breathe'}" d="${d}" stroke="${color}" stroke-width="${dir ? 5.4 : 8.4}"/>`
          : '') +
        `<path class="halo" d="${d}" pathLength="1" stroke="${color}" stroke-width="10.4" style="stroke-dasharray:1;opacity:0"/>` +
        `<path class="base" d="${d}" pathLength="1" stroke="${color}" stroke-width="2.4" style="stroke-dasharray:1"/>` +
        `<circle class="spark" r="4.5" fill="${color}" style="stroke:var(--surface);stroke-width:2;opacity:0"/>`;
      tedges.appendChild(g);
      const label = document.createElement('span');
      label.className = 'elabel';
      Object.assign(label.style, { left: `${lx}px`, top: `${ly}px`, borderColor: color, color, opacity: '0' });
      label.innerHTML = `<i style="background:${color}"></i>${LABEL[link.t]}`;
      tlabels.appendChild(label);
      if (link.focus) {
        pop.style.left = `${lx}px`;
        pop.style.top = `${ly}px`;
      }
      const base = g.querySelector('.base') as SVGPathElement;
      return {
        link,
        g,
        label,
        dir,
        base,
        halo: g.querySelector('.halo') as SVGPathElement,
        spark: g.querySelector('.spark') as SVGCircleElement,
        flow: g.querySelector<SVGPathElement>('.beads,.breathe'),
        len: base.getTotalLength(),
      };
    });
  };

  let shownStep = 0;
  const apply = (P: number) => {
    // 2.47 arrives as the section scrolls in; the others fade in at their step.
    const ck = win(P, -0.85, 0.8);
    N['2.47'].style.opacity = String(ck);
    N['2.47'].style.transform = `translateY(${(1 - ck) * 56}px) scale(${0.92 + 0.08 * ck})`;
    const order: Record<number, number> = {};
    frame.querySelectorAll<HTMLElement>('[data-in]').forEach((el) => {
      const s = Number(el.dataset.in);
      const i = (order[s] = (order[s] ?? -1) + 1);
      const k = win(P, s - 1 + i * 0.06, 0.3);
      el.style.opacity = String(k);
      el.style.transform = `translateY(${(1 - k) * -34}px) scale(${0.9 + 0.1 * k})`;
    });
    // Links draw with the scroll, the canvas's spark riding the tip.
    const focus = win(P, 2.1, 0.3) * (1 - win(P, 2.75, 0.25));
    drawnLinks.forEach((o) => {
      const f = win(P, o.link.s - 1 + o.link.at, 0.32);
      o.base.style.strokeDashoffset = String(1 - f);
      o.halo.style.strokeDashoffset = String(1 - f);
      o.halo.style.opacity = f > 0 && f < 1 ? '.22' : '0';
      if (f > 0 && f < 1) {
        const p = o.base.getPointAtLength(o.len * f);
        o.spark.setAttribute('cx', String(p.x));
        o.spark.setAttribute('cy', String(p.y));
        o.spark.style.opacity = '1';
      } else o.spark.style.opacity = '0';
      if (o.dir) {
        if (f > 0.98) o.base.setAttribute('marker-end', 'url(#tarrow-progression)');
        else o.base.removeAttribute('marker-end');
      }
      const lk = clamp01((f - 0.85) / 0.15);
      const dim = o.link.focus ? 1 : 1 - 0.85 * focus;
      o.label.style.opacity = String(lk * dim);
      o.label.style.transform = `translate(-50%,-50%) scale(${0.6 + 0.4 * lk})`;
      o.g.style.opacity = String(dim);
      if (o.flow) o.flow.style.visibility = f >= 1 ? 'visible' : 'hidden';
    });
    pop.style.opacity = String(focus);
    pop.style.transform = `translate(-50%,calc(-100% - ${12 + 10 * focus}px))`;
    const pk = win(P, 4.05, 0.35);
    panel.style.opacity = String(pk);
    panel.style.transform = `translateX(${(1 - pk) * 28}px)`;
    frame.classList.toggle('st1', P < 0.9);
    moreLabel.textContent = P >= 1.25 ? 'Show 9 more connected verses' : 'Show 14 connected verses';
    const step = Math.min(5, Math.floor(P) + 1);
    if (step !== shownStep) {
      shownStep = step;
      steps.forEach((li) => li.classList.toggle('on', Number(li.dataset.s) === step));
    }
  };

  // Scroll sets a target; each frame eases toward it.
  let target = reduce ? 5 : 0;
  let cur = target;
  let last = 0;
  let raf = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    cur += (target - cur) * (1 - Math.exp(-dt * 9));
    if (Math.abs(target - cur) < 0.0005) cur = target;
    apply(cur);
    if (cur !== target) raf = requestAnimationFrame(tick);
    else {
      raf = 0;
      last = 0;
    }
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const onScroll = () => {
    if (reduce) {
      target = 5;
      apply(5);
      return;
    }
    const r = section.getBoundingClientRect();
    const p = clamp01(-r.top / (r.height - innerHeight));
    // Before the section pins, P runs from -1 to 0 so the verse card can
    // arrive as it scrolls in; then five steps share the scroll, with a
    // little dwell at each end.
    target = r.top > 0 ? clamp01((innerHeight - r.top) / innerHeight) - 1 : 5 * clamp01((p - 0.02) / 0.94);
    kick();
  };
  steps.forEach((li) => {
    const go = () => {
      const top = section.getBoundingClientRect().top + scrollY;
      const span = section.offsetHeight - innerHeight;
      const s = Number(li.dataset.s);
      const P = s === 1 ? 0.2 : s - 1 + 0.75;
      scrollTo({ top: top + span * (0.02 + (0.94 * P) / 5), behavior: reduce ? 'auto' : 'smooth' });
    };
    li.addEventListener('click', go);
    c.add(() => li.removeEventListener('click', go));
  });
  const reset = () => {
    place();
    build();
    apply(cur);
  };

  reset();
  onScroll();
  cur = target;
  apply(cur);
  ready.then(reset);
  c.on('scroll', onScroll, { passive: true });
  c.on('resize', reset);
  c.add(() => cancelAnimationFrame(raf));
  return reset;
}

/* ---------- shaders ----------
   A slow, domain-warped noise in each panel's tone behind the step
   screenshots and the closing card. Each runs only while on screen and
   draws one still frame for readers who prefer reduced motion. Without
   WebGL the CSS gradient underneath shows instead. */
const TONES: Record<string, [number, number, number][]> = {
  terra: [[0.93, 0.66, 0.53], [0.78, 0.42, 0.29], [0.42, 0.2, 0.13]],
  blue: [[0.7, 0.77, 0.83], [0.35, 0.48, 0.59], [0.17, 0.24, 0.31]],
  sage: [[0.79, 0.82, 0.72], [0.49, 0.54, 0.43], [0.23, 0.28, 0.2]],
};
const VERTEX = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAGMENT = `precision mediump float;uniform vec2 r;uniform float t;uniform vec3 a,b,c;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,s=.5;for(int i=0;i<5;i++){v+=s*n(p);p=p*2.03+vec2(1.7,9.2);s*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 q=uv*vec2(r.x/r.y,1.)*1.6;
  vec2 w=vec2(fbm(q+vec2(0.,t*.05)),fbm(q+vec2(5.2,1.3)-t*.04));
  float f=fbm(q+2.2*w+vec2(t*.03,-t*.02));
  float g=smoothstep(.15,.95,f*.85+uv.x*.25+(1.-uv.y)*.2);
  vec3 col=mix(a,b,smoothstep(0.,.55,g));col=mix(col,c,smoothstep(.5,1.,g));
  col+=.06*smoothstep(.55,.9,fbm(q*3.+w*4.+t*.06));
  col+=(h(gl_FragCoord.xy+fract(t))-.5)*.035;
  gl_FragColor=vec4(col,1.);}`;

function shader(cv: HTMLCanvasElement, seed: number, reduce: boolean, c: Cleanup) {
  const gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) {
    cv.remove();
    return;
  }
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type) as WebGLShader;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram() as WebGLProgram;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    cv.remove();
    return;
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tone = cv.parentElement?.classList.contains('blue')
    ? TONES.blue
    : cv.parentElement?.classList.contains('sage')
      ? TONES.sage
      : TONES.terra;
  (['a', 'b', 'c'] as const).forEach((k, i) => gl.uniform3fv(gl.getUniformLocation(prog, k), tone[i]));
  const uR = gl.getUniformLocation(prog, 'r');
  const uT = gl.getUniformLocation(prog, 't');

  // The canvas can outlive one setup (React runs effects twice in
  // development), so the first draw always sends the size to this program.
  let sized = false;
  const size = () => {
    const d = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.round(cv.clientWidth * d);
    const h = Math.round(cv.clientHeight * d);
    if (!sized || cv.width !== w || cv.height !== h) {
      sized = true;
      cv.width = w;
      cv.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uR, w, h);
    }
  };
  const draw = (now: number) => {
    size();
    gl.uniform1f(uT, seed + now / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  draw(0);
  if (reduce) {
    c.on('resize', () => draw(0));
    return;
  }
  let on = false;
  let raf = 0;
  const loop = (now: number) => {
    draw(now);
    if (on) raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(([e]) => {
    on = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (on) raf = requestAnimationFrame(loop);
  });
  io.observe(cv);
  c.add(() => {
    io.disconnect();
    cancelAnimationFrame(raf);
  });
}

/** Wire up the landing page inside `root`. Returns a teardown function. */
export function startLanding(root: HTMLElement): () => void {
  const c = new Cleanup();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Card heights depend on the fonts, so everything is measured again once
  // they have loaded.
  const ready = document.fonts ? document.fonts.ready : Promise.resolve();

  const relayoutHero = hero(root, reduce, c, ready);
  const resetTour = tour(root, reduce, c, ready);
  root.querySelectorAll<HTMLCanvasElement>('.hp-media canvas, .close-card canvas').forEach((cv, i) =>
    shader(cv, i * 17.3, reduce, c),
  );

  // Link colours come from CSS variables, which change with the theme.
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const recolour = () => {
    relayoutHero();
    resetTour();
  };
  scheme.addEventListener('change', recolour);
  c.add(() => scheme.removeEventListener('change', recolour));

  return () => c.run();
}
