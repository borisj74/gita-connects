import { useEffect } from 'react';
import { useReactFlow, useViewport, useStore } from 'reactflow';
import { Minus, Plus, Maximize, Shrink } from 'lucide-react';
import './Toolbar.css';

/**
 * Zoom cluster: fit-to-selection · − · live % · + · fit-all.
 * Must render inside a ReactFlowProvider. Also binds ⌘0 = fit all.
 */
export default function ZoomControls() {
  const { zoomIn, zoomOut, fitView, getNodes } = useReactFlow();
  const { zoom } = useViewport();
  const hasSelection = useStore((s) => s.getNodes().some((n) => n.selected));
  const minZoom = useStore((s) => s.minZoom);
  const maxZoom = useStore((s) => s.maxZoom);

  const fitAll = () => fitView({ duration: 400, padding: 0.2, maxZoom: 1 });
  const fitSelection = () => {
    const selected = getNodes().filter((n) => n.selected);
    if (selected.length === 0) return;
    fitView({ duration: 400, padding: 0.4, nodes: selected, maxZoom: 1 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== '0') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      fitAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // fitView identity is stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="tb-zoom" role="group" aria-label="Zoom">
      <button
        type="button"
        className="tb-zoom-btn"
        onClick={fitSelection}
        disabled={!hasSelection}
        title="Fit to selection"
        aria-label="Fit to selection"
      >
        <Shrink size={16} />
      </button>
      <span className="tb-zoom-sep" />
      <button
        type="button"
        className="tb-zoom-btn"
        onClick={() => zoomOut({ duration: 200 })}
        disabled={zoom <= minZoom}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <Minus size={16} />
      </button>
      <span className="tb-zoom-level" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        className="tb-zoom-btn"
        onClick={() => zoomIn({ duration: 200 })}
        disabled={zoom >= maxZoom}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <Plus size={16} />
      </button>
      <span className="tb-zoom-sep" />
      <button
        type="button"
        className="tb-zoom-btn"
        onClick={fitAll}
        title="Fit all (⌘0)"
        aria-label="Fit all verses"
      >
        <Maximize size={16} />
      </button>
    </div>
  );
}
