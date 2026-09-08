import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Download, Moon, Sun, CircleHelp, Trash2 } from 'lucide-react';
import './Toolbar.css';

interface OverflowMenuProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onClearCanvas: () => void;
  canClear: boolean;
  onExport?: () => void;
  onShowShortcuts?: () => void;
}

/**
 * The `⋯` menu holds the rare and the dangerous: export, theme, shortcuts,
 * and — behind a divider — the only red item in the toolbar.
 */
export default function OverflowMenu({
  theme,
  onToggleTheme,
  onClearCanvas,
  canClear,
  onExport,
  onShowShortcuts,
}: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Close, then hand focus back to the trigger before running the action so
  // any dialog the action opens can return focus somewhere that still exists.
  const run = (fn?: () => void) => () => {
    setOpen(false);
    triggerRef.current?.focus();
    fn?.();
  };

  return (
    <div className="tb-menu-anchor" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="tb-button tb-icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div className="tb-menu tb-overflow-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="tb-menu-item"
            onClick={run(onExport)}
            disabled={!onExport}
            title={onExport ? undefined : 'Coming soon'}
          >
            <Download size={16} />
            <span className="tb-menu-item-label">Export as PNG or PDF…</span>
            {!onExport && <span className="tb-menu-item-hint">Soon</span>}
          </button>
          <button type="button" role="menuitem" className="tb-menu-item" onClick={run(onToggleTheme)}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span className="tb-menu-item-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="tb-menu-item"
            onClick={run(onShowShortcuts)}
            disabled={!onShowShortcuts}
            title={onShowShortcuts ? undefined : 'Coming soon'}
          >
            <CircleHelp size={16} />
            <span className="tb-menu-item-label">Keyboard shortcuts</span>
            <span className="tb-menu-item-hint">{onShowShortcuts ? '?' : 'Soon'}</span>
          </button>
          <div className="tb-menu-divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="tb-menu-item danger"
            onClick={run(onClearCanvas)}
            disabled={!canClear}
          >
            <Trash2 size={16} />
            <span className="tb-menu-item-label">Clear canvas…</span>
          </button>
        </div>
      )}
    </div>
  );
}
