/**
 * Export the canvas as a PNG image or a PDF document.
 *
 * The image is rendered from the live React Flow viewport with html-to-image,
 * framed to the nodes' bounds rather than the current scroll/zoom. The PDF
 * puts that image on page one and then lists the verses and links in text,
 * so it stays useful printed. Only our own words go in: theme, summary,
 * concepts, the reader's notes. Vedabase translations are never embedded
 * (Bhaktivedanta Book Trust permits display, not redistribution).
 */
import { toPng } from 'html-to-image';
import { getRectOfNodes, getTransformForBounds, type Node, type Edge } from 'reactflow';
import { verses, chapters } from './data/index.js';
import { getTypeLabel, type ConnectionTypeDef } from './connectionTypes.js';
import { getNotes } from './notes.js';

export interface CanvasImage {
  dataUrl: string;
  width: number;
  height: number;
}

const CANVAS_BG: Record<'light' | 'dark', string> = { light: '#fbf8f4', dark: '#18150f' };

/** Parts of a card that are controls, not content. */
const isChrome = (el: Element) =>
  el instanceof HTMLElement &&
  (el.classList.contains('react-flow__handle') ||
    el.classList.contains('node-remove') ||
    el.classList.contains('node-key-hints') ||
    el.classList.contains('react-flow__panel') ||
    el.classList.contains('connect-hint'));

export async function captureCanvas(
  viewport: HTMLElement,
  nodes: Node[],
  theme: 'light' | 'dark' = 'light',
): Promise<CanvasImage> {
  const bounds = getRectOfNodes(nodes);
  const pad = 48;
  const width = Math.ceil(bounds.width + pad * 2);
  const height = Math.ceil(bounds.height + pad * 2);
  const [x, y, zoom] = getTransformForBounds(bounds, width, height, 1, 1, 0);
  const options = {
    backgroundColor: CANVAS_BG[theme],
    width,
    height,
    pixelRatio: 2,
    filter: (el: Element) => !isChrome(el),
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${x + pad}px, ${y + pad}px) scale(${zoom})`,
    },
  };
  let dataUrl: string;
  try {
    dataUrl = await toPng(viewport, options);
  } catch {
    // Cross-origin font stylesheets can block font inlining; fall back to system fonts.
    dataUrl = await toPng(viewport, { ...options, skipFonts: true });
  }
  return { dataUrl, width: width * 2, height: height * 2 };
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export interface PdfOptions {
  title: string;
  image: CanvasImage;
  nodes: Node[];
  edges: Edge[];
  connectionTypes: ConnectionTypeDef[];
  includeNotes: boolean;
}

const strip = (s: string) => s.replace(/\*/g, '');
const byScripture = (a: string, b: string) => {
  const [ac, av] = a.split('.').map(Number);
  const [bc, bv] = b.split('.').map(Number);
  return ac - bc || av - bv;
};

/** Build the PDF as a Blob. jsPDF is loaded on demand; it is not small. */
export async function buildPdf(opts: PdfOptions): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const ink = [58, 53, 48] as const;
  const muted = [116, 98, 79] as const;

  // Page 1: title + picture
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...ink);
  doc.text(opts.title, margin, margin + 8);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...muted);
  const ids = opts.nodes.map((n) => n.id);
  doc.text(
    `${ids.length} verse${ids.length === 1 ? '' : 's'} · ${opts.edges.length} link${opts.edges.length === 1 ? '' : 's'} · Gita Connects · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    margin,
    margin + 26,
  );
  const top = margin + 44;
  const maxW = pageW - margin * 2;
  const maxH = pageH - top - margin;
  const scale = Math.min(maxW / opts.image.width, maxH / opts.image.height);
  const w = opts.image.width * scale;
  const h = opts.image.height * scale;
  doc.addImage(opts.image.dataUrl, 'PNG', margin + (maxW - w) / 2, top, w, h);

  // Page 2+: verses, then links
  doc.addPage();
  let y = margin;
  const lineH = 13;
  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const heading = (text: string) => {
    ensure(30);
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...ink);
    doc.text(text, margin, y);
    y += 20;
  };
  const para = (text: string, size = 10, color: readonly [number, number, number] = ink, indent = 0) => {
    doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxW - indent) as string[];
    lines.forEach((line) => {
      ensure(lineH);
      doc.text(line, margin + indent, y);
      y += lineH;
    });
  };

  const notes = opts.includeNotes ? getNotes() : {};
  heading('Verses');
  [...ids].sort(byScripture).forEach((id) => {
    const v = verses.find((x) => x.id === id);
    if (!v) return;
    const ch = chapters.find((c) => c.number === v.chapter);
    ensure(lineH * 3);
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...ink);
    doc.text(`${id}  ${v.theme ?? ''}`, margin, y);
    y += lineH;
    para(`Chapter ${v.chapter}${ch ? ` · ${ch.title}` : ''}${v.concepts.length ? ` · ${v.concepts.join(', ')}` : ''}`, 9, muted);
    if (v.summary) para(strip(v.summary), 10, ink);
    const note = notes[id];
    if (note) para(`My note: ${note.text}`, 10, [101, 113, 88]);
    y += 6;
  });

  if (opts.edges.length > 0) {
    y += 6;
    heading('Links');
    opts.edges.forEach((e) => {
      const typeId = (e.data?.typeId as string | undefined) ?? (e.label as string | undefined) ?? '';
      const label = getTypeLabel(opts.connectionTypes, typeId) || typeId;
      const desc = (e.data?.description as string | undefined) ?? '';
      para(`${e.source} → ${e.target}   ${label}${desc ? ` — ${desc}` : ''}`, 10);
    });
  }

  ensure(lineH * 2);
  y = pageH - margin + 10;
  doc.setFontSize(8).setTextColor(...muted);
  doc.text('Verse text is not included; read each verse at vedabase.io.', margin, y);

  return doc.output('blob');
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
