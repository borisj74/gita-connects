/**
 * The guided tour's stops. Each points at elements already on screen by CSS
 * selector; the spotlight wraps every match that is visible, and a stop whose
 * targets are all missing shows its card in the middle of the screen instead.
 */
export interface TourContext {
  /** The verse the tour talks about: the starter set's hub, else the first card. */
  focusId: string | null;
  isMobile: boolean;
}

export interface TourStep {
  id: string;
  title: string;
  body: (ctx: TourContext) => string;
  targets: (ctx: TourContext) => string[];
}

const node = (ctx: TourContext) =>
  ctx.focusId ? `.react-flow__node[data-id="${ctx.focusId}"]` : '.react-flow__node';

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'chapters',
    title: 'Every chapter and verse',
    body: (ctx) =>
      ctx.isMobile
        ? 'All 18 chapters and 701 verses live under Chapters. Tap a verse to read it, or + to add it to the canvas.'
        : 'All 18 chapters and 701 verses are listed here. Drag a verse onto the canvas, or click it to read it. B opens and closes this list.',
    targets: () => ['.sidebar-wrapper:not(.collapsed):not(.sidebar-drawer)', '.chapters-fab'],
  },
  {
    id: 'card',
    title: 'Each card is a verse',
    body: (ctx) =>
      `We started you with a set of connected verses. ${ctx.isMobile ? 'Tap' : 'Click'} any card to read its Sanskrit, translation and a short summary.`,
    targets: (ctx) => [node(ctx)],
  },
  {
    id: 'read',
    title: 'Read the verse',
    body: (ctx) =>
      ctx.isMobile
        ? 'Tapping a card opens it here. Tap Sanskrit, Transliteration, Translation or Commentary to open or close that part. Further down: your own note, a short summary with key concepts, and the verses it connects to.'
        : 'Clicking a card opens it here. Click Sanskrit, Transliteration, Translation or Commentary to open or close that part. Further down: your own note, a short summary with key concepts, and the verses it connects to. ↑ ↓ moves between verses.',
    targets: () => ['.verse-detail'],
  },
  {
    id: 'lines',
    title: 'Lines show how verses relate',
    body: () =>
      'The label names the kind of connection: thematic, contrast, progression and seven more. Link types → What do these mean? explains all ten.',
    targets: () => ['.edge-label'],
  },
  {
    id: 'draw',
    title: 'Draw your own connection',
    body: (ctx) =>
      ctx.isMobile
        ? 'Tap the link button on a card, then tap the verse to connect it to. Or open a verse and use its Connect to… button. Then say what kind of connection it is, and why.'
        : 'Drag from either dot on a card onto another card, or click the link button and then the other card. Then say what kind of connection it is, and why.',
    targets: (ctx) =>
      ctx.isMobile
        ? [`${node(ctx)} .node-connect`]
        : [`${node(ctx)} .react-flow__handle-top`, `${node(ctx)} .react-flow__handle-bottom`],
  },
  {
    id: 'insights',
    title: 'See what your network says',
    body: () =>
      'This panel reads your network back to you: what it is about, which verse holds it together, and where to go next.',
    targets: () => ['.insights'],
  },
  {
    id: 'search',
    title: 'Find any verse or idea',
    body: (ctx) =>
      ctx.isMobile
        ? 'Tap search to find a verse by number, like 2.47, or by an idea, like duty.'
        : 'Search by verse number, like 2.47, or by an idea, like duty. ⌘K jumps here from anywhere.',
    targets: () => ['.sf-field', '.sf-toggle'],
  },
  {
    id: 'keep',
    title: 'Keep your work',
    body: (ctx) =>
      ctx.isMobile
        ? 'Save and load networks from the menu. Sign in to keep them on every device and to have AI check the connections you draw.'
        : 'Save networks under Networks. Sign in from ⋯ to keep them on every device and to have AI check the connections you draw.',
    targets: () => ['[data-tour="networks"]', '[data-tour="more"]', '.hamburger-button'],
  },
];
