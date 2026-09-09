import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Moon, Sun, CircleHelp, Trash2, UserRound } from 'lucide-react';
import './Toolbar.css';

interface OverflowMenuProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onClearCanvas: () => void;
  canClear: boolean;
  /** Open the sign-in / account dialog. Absent when the build has no cloud keys. */
  onOpenAccount?: () => void;
  /** Email of the signed-in reader, if any. */
  accountEmail?: string | null;
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
  onOpenAccount,
  accountEmail,
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
          {onOpenAccount && (
            <>
              <div className="tb-menu-divider" role="separator" />
              <button type="button" role="menuitem" className="tb-menu-item" onClick={run(onOpenAccount)}>
                <UserRound size={16} />
                <span className="tb-menu-item-label">{accountEmail ? 'Your account' : 'Sign in'}</span>
                {accountEmail && <span className="tb-menu-item-hint tb-menu-item-email">{accountEmail}</span>}
              </button>
            </>
          )}
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
