import { useEffect, useMemo, useRef, useState } from 'react';
import type { Edge } from 'reactflow';
import { ChevronDown, Plus, Sparkles } from 'lucide-react';
import { connections, getVerse } from '../data/index.js';
import { analyzeNetwork, type NetworkInsights as Insights } from '../insights.js';
import { getTypeColor, getTypeLabel, type ConnectionTypeDef } from '../connectionTypes.js';
import { useDraggablePanel } from '../hooks/useDraggablePanel.js';
import './NetworkInsights.css';

const OPEN_KEY = 'gita-connects-insights-open';
const POS_KEY = 'gita-connects-insights-pos';
type SectionKey = 'shape' | 'concepts' | 'hub' | 'clusters' | 'explore' | 'loose';

interface NetworkInsightsProps {
  networkVerses: Set<string>;
  networkEdges: Edge[];
  connectionTypes: ConnectionTypeDef[];
  conceptFilter: string | null;
  onConceptSelect: (concept: string) => void;
  onVerseSelect: (verseId: string) => void;
  onAddVerse: (verseId: string) => void;
  defaultOpen: boolean;
}

// What each section shows, as a string: when it changes, that section
// glows once so the reader sees what their last move changed.
function signatures(r: Insights): Record<SectionKey, string> {
  return {
    shape: `${r.linkCount}|${r.character}`,
    concepts: r.sharedConcepts.map((c) => `${c.concept}:${c.count}`).join(),
    hub: r.hub ? `${r.hub.id}:${r.hub.links}` : '',
    clusters: r.coveredClusters.map((c) => c.id).join(),
    explore: r.exploreNext.map((e) => e.verseId).join(),
    loose: r.looseEnds.join(),
  };
}

/**
 * "What your network says": a live reading of the canvas built from the
 * verses' concepts and clusters and the links between them. It turns
 * connecting verses into finding something out.
 */
export default function NetworkInsights({
  networkVerses,
  networkEdges,
  connectionTypes,
  conceptFilter,
  onConceptSelect,
  onVerseSelect,
  onAddVerse,
  defaultOpen,
}: NetworkInsightsProps) {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(OPEN_KEY);
      return saved === null ? defaultOpen : saved === '1';
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(OPEN_KEY, v ? '0' : '1');
      } catch {
        // Preference just doesn't stick — not worth surfacing.
      }
      return !v;
    });
    setUnseen(false);
  };

  // The header doubles as a drag handle: drag to move the panel anywhere on
  // the canvas, click to open or close it, arrow keys to nudge it.
  const { panelRef, style, handleProps, consumeDragClick } = useDraggablePanel<HTMLElement>(POS_KEY);

  const insights = useMemo(
    () =>
      analyzeNetwork(
        networkVerses,
        networkEdges.map((e) => ({
          source: e.source,
          target: e.target,
          typeId: (e.data?.typeId as string | undefined) ?? String(e.label ?? ''),
        })),
        getVerse,
        (id) => getTypeLabel(connectionTypes, id),
        connections,
      ),
    [networkVerses, networkEdges, connectionTypes],
  );

  // Glow the sections the last change touched; mark the closed panel as
  // having news instead.
  const [fresh, setFresh] = useState<Set<SectionKey>>(new Set());
  const [unseen, setUnseen] = useState(false);
  const prevRef = useRef<Record<SectionKey, string> | null>(null);
  useEffect(() => {
    const next = signatures(insights);
    const prev = prevRef.current;
    prevRef.current = next;
    if (!prev) return;
    const changed = (Object.keys(next) as SectionKey[]).filter((k) => next[k] !== prev[k]);
    if (changed.length === 0) return;
    if (!open) {
      setUnseen(true);
      return;
    }
    setFresh(new Set(changed));
    const t = setTimeout(() => setFresh(new Set()), 1400);
    return () => clearTimeout(t);
  }, [insights, open]);

  const sectionClass = (k: SectionKey) => `insights-section ${fresh.has(k) ? 'is-fresh' : ''}`;
  const { verseCount, linkCount } = insights;

  return (
    <aside
      ref={panelRef}
      className={`insights ${open ? 'is-open' : ''}`}
      style={style}
      aria-label="What your network says"
    >
      <button
        type="button"
        className={`insights-toggle ${unseen ? 'has-news' : ''}`}
        onClick={() => {
          if (!consumeDragClick()) toggle();
        }}
        {...handleProps}
        aria-expanded={open}
        aria-describedby="insights-move-hint"
        title="Drag to move"
      >
        <Sparkles size={15} strokeWidth={2.2} aria-hidden="true" />
        <span className="insights-title">What your network says</span>
        <ChevronDown size={15} className="insights-chevron" aria-hidden="true" />
        <span id="insights-move-hint" className="insights-visually-hidden">
          Arrow keys move the panel.
        </span>
      </button>

      {open && (
        <div className="insights-body" aria-live="polite">
          <section className={sectionClass('shape')}>
            <p className="insights-count">
              {verseCount} verses · {linkCount} {linkCount === 1 ? 'link' : 'links'}
            </p>
            <p className="insights-character">
              {insights.character ?? 'No links yet. Drag from the dot under a verse onto another verse.'}
            </p>
            {insights.linkMix.length > 0 && (
              <div
                className="insights-mix"
                role="img"
                aria-label={insights.linkMix
                  .map((m) => `${m.count} ${getTypeLabel(connectionTypes, m.typeId)}`)
                  .join(', ')}
              >
                {insights.linkMix.map((m) => (
                  <span
                    key={m.typeId}
                    className="insights-mix-part"
                    style={{ flexGrow: m.count, background: getTypeColor(connectionTypes, m.typeId) }}
                    title={`${getTypeLabel(connectionTypes, m.typeId)}: ${m.count}`}
                  />
                ))}
              </div>
            )}
          </section>

          {insights.sharedConcepts.length > 0 && (
            <section className={sectionClass('concepts')}>
              <h3 className="insights-heading">Shared concepts</h3>
              <div className="insights-chips">
                {insights.sharedConcepts.map(({ concept, count }) => (
                  <button
                    key={concept}
                    type="button"
                    className={`insights-chip ${conceptFilter === concept ? 'is-active' : ''}`}
                    onClick={() => onConceptSelect(concept)}
                    aria-pressed={conceptFilter === concept}
                    title={`Highlight the verses about ${concept}`}
                  >
                    {concept}
                    <span className="insights-chip-count">
                      {count} of {verseCount}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {insights.hub && (
            <section className={sectionClass('hub')}>
              <h3 className="insights-heading">Holding it together</h3>
              <button
                type="button"
                className="insights-verse"
                onClick={() => onVerseSelect(insights.hub!.id)}
              >
                <span className="insights-verse-id">{insights.hub.id}</span>
                <span className="insights-verse-theme">{insights.hub.theme ?? 'Uncurated'}</span>
                <span className="insights-verse-meta">{insights.hub.links} links</span>
              </button>
            </section>
          )}

          <section className={sectionClass('clusters')}>
            <h3 className="insights-heading">
              Themes covered
              <span className="insights-heading-count">
                {insights.coveredClusters.length} of {insights.coveredClusters.length + insights.missingClusters.length}
              </span>
            </h3>
            <ul className="insights-clusters">
              {insights.coveredClusters.map((c) => (
                <li key={c.id}>
                  {c.label}
                  <span className="insights-cluster-count">{c.count}</span>
                </li>
              ))}
            </ul>
          </section>

          {insights.exploreNext.length > 0 && (
            <section className={sectionClass('explore')}>
              <h3 className="insights-heading">Explore next</h3>
              <p className="insights-hint">
                Themes you haven't touched, through verses already linked to yours.
              </p>
              <div className="insights-explore">
                {insights.exploreNext.map((e) => (
                  <button
                    key={e.verseId}
                    type="button"
                    className="insights-verse is-explore"
                    onClick={() => onAddVerse(e.verseId)}
                    aria-label={`Add ${e.verseId}, ${e.clusterLabel}, linked to ${e.viaId}`}
                  >
                    <span className="insights-verse-id">{e.verseId}</span>
                    <span className="insights-explore-text">
                      <span className="insights-verse-theme">{e.clusterLabel}</span>
                      <span className="insights-explore-via">
                        {getTypeLabel(connectionTypes, e.typeId)} with {e.viaId}
                      </span>
                    </span>
                    <Plus size={16} className="insights-explore-add" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {insights.looseEnds.length > 0 && linkCount > 0 && (
            <section className={sectionClass('loose')}>
              <h3 className="insights-heading">Not linked yet</h3>
              <div className="insights-chips">
                {insights.looseEnds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="insights-chip is-verse"
                    onClick={() => onVerseSelect(id)}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
