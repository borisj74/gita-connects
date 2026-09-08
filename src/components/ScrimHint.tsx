import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import './ScrimHint.css';

/**
 * "Click anywhere to cancel" pill that follows the pointer while it is over
 * a dialog's scrim (App 26). Render it as the first child of the overlay;
 * it listens on its parent so dialogs need no extra wiring.
 */
export default function ScrimHint({ label = 'Click anywhere to cancel' }: { label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const overlay = ref.current?.parentElement;
    if (!overlay) return;
    const move = (e: MouseEvent) =>
      setPos(e.target === overlay ? { x: e.clientX, y: e.clientY } : null);
    const leave = () => setPos(null);
    overlay.addEventListener('mousemove', move);
    overlay.addEventListener('mouseleave', leave);
    return () => {
      overlay.removeEventListener('mousemove', move);
      overlay.removeEventListener('mouseleave', leave);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="scrim-hint"
      hidden={!pos}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      aria-hidden="true"
    >
      <X size={13} strokeWidth={2} />
      {label}
    </div>
  );
}
