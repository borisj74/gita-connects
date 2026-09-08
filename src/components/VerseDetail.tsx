import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  BookMarked, Tag, Link2, X, Plus, Check, Sparkles, ExternalLink,
  ChevronDown, ChevronRight, ChevronUp,
} from 'lucide-react';
import { verses, connections, chapters, vedabaseUrl } from '../data/index.js';
import { useVerseText } from '../hooks/useVerseText.js';
import { clusterLabel } from '../clusters.js';
import { suggestSimilar, suggestionConnection } from '../suggestions.js';
import { useBottomSheet } from '../hooks/useBottomSheet.js';
import { PREDEFINED_CONNECTION_TYPES, getTypeLabel } from '../connectionTypes.js';
import './VerseDetail.css';

interface VerseDetailProps {
  verseId: string | null;
  onClose: () => void;
  networkVerses: Set<string>;
  onAddToNetwork: (verseId: string) => void;
  onAddSuggestion: (fromId: string, toId: string, conn: { type: string; description: string; strength: number }) => void;
  connectedNeighbors: Set<string>;
  /** Move to another verse (prev/next in the chapter). */
  onNavigate?: (verseId: string) => void;
  isMobile?: boolean;
}

type SectionKey = 'sanskrit' | 'transliteration' | 'translation' | 'commentary';
const SECTIONS_KEY = 'gita-connects-detail-sections';
const DEFAULT_OPEN: Record<SectionKey, boolean> = {
  sanskrit: true,
  transliteration: false,
  translation: true,
  commentary: false,
};

function loadOpenSections(): Record<SectionKey, boolean> {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
    if (!raw) return DEFAULT_OPEN;
    const parsed = JSON.parse(raw) as Partial<Record<SectionKey, boolean>>;
    return { ...DEFAULT_OPEN, ...parsed };
  } catch {
    return DEFAULT_OPEN;
  }
}

/** Reading time for the commentary, at a slow-scripture 180 wpm. */
function readMinutes(paragraphs: string[]): number {
  const words = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

/** 1–10 strength → 0–5 bars plus a plain-language verdict. */
function strengthMeter(strength: number): { bars: number; verdict: string } {
  const bars = Math.max(1, Math.min(5, Math.ceil(strength / 2)));
  const verdict = strength >= 8 ? 'Strong link' : strength >= 5 ? 'Moderate link' : 'Light link';
  return { bars, verdict };
}

const truncate = (s: string, n = 28) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

interface DisclosureProps {
  id: SectionKey;
  label: string;
  open: boolean;
  onToggle: (id: SectionKey) => void;
  /** Shown beside the label while collapsed. */
  preview?: ReactNode;
  children: ReactNode;
}

function Disclosure({ id, label, open, onToggle, preview, children }: DisclosureProps) {
  return (
    <section className={`vd-section vd-disclosure ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="vd-disclosure-header"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-controls={`vd-${id}`}
      >
        {open ? <ChevronDown size={13} strokeWidth={2.6} /> : <ChevronRight size={13} strokeWidth={2.6} />}
        <span className="vd-label">{label}</span>
        {!open && preview && <span className="vd-preview">{preview}</span>}
      </button>
      {open && <div id={`vd-${id}`} className="vd-disclosure-body">{children}</div>}
    </section>
  );
}

export default function VerseDetail({
  verseId,
  onClose,
  networkVerses,
  onAddToNetwork,
  onAddSuggestion,
  connectedNeighbors,
  onNavigate,
  isMobile = false,
}: VerseDetailProps) {
  const { sheetClassName, sheetStyle, grabberProps } = useBottomSheet({
    enabled: isMobile && !!verseId,
    onClose,
  });

  // Above the early returns below, so hook order is identical on every render.
  const verseText = useVerseText(verseId);
  const live = verseText.status === 'ready' ? verseText.text : null;

  // Open/closed state persists across verses: if you opened Transliteration
  // on 2.47 it stays open on 2.48, so the pager doesn't make you re-open it.
  const [openSections, setOpenSections] = useState(loadOpenSections);
  const toggleSection = useCallback((id: SectionKey) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
      } catch {
        // Preference only; losing it is harmless.
      }
      return next;
    });
  }, []);

  const verse = verseId ? verses.find((v) => v.id === verseId) : undefined;
  const chapter = verse ? chapters.find((c) => c.number === verse.chapter) : undefined;
  const prevId = verse && verse.verse > 1 ? `${verse.chapter}.${verse.verse - 1}` : null;
  const nextId = verse && chapter && verse.verse < chapter.verses ? `${verse.chapter}.${verse.verse + 1}` : null;

  // ↑ / ↓ page through the chapter while the panel is open. Left alone when
  // typing or when focus is on the canvas, where React Flow uses arrows to
  // nudge the selected node.
  useEffect(() => {
    if (!verseId || !onNavigate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target?.closest('.react-flow')) return;
      const dest = e.key === 'ArrowUp' ? prevId : nextId;
      if (!dest) return;
      e.preventDefault();
      onNavigate(dest);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [verseId, prevId, nextId, onNavigate]);

  if (!verseId) {
    return (
      <div className="verse-detail empty">
        <div className="empty-state">
          <BookMarked size={48} className="empty-icon" />
          <h3 className="empty-title">No Verse Selected</h3>
          <p className="empty-text">
            Select a verse from the sidebar or click on a node in the network to view its details.
          </p>
        </div>
      </div>
    );
  }

  if (!verse || !chapter) return null;

  const inNetwork = networkVerses.has(verse.id);

  // One entry per connected verse on the canvas, keeping the strongest link —
  // mirrors the canvas, which collapses multiple links per pair to one edge.
  const strongestByVerse = new Map<string, (typeof connections)[number]>();
  connections.forEach((conn) => {
    if (conn.from !== verseId && conn.to !== verseId) return;
    const connectedId = conn.from === verseId ? conn.to : conn.from;
    if (!networkVerses.has(connectedId)) return;
    const current = strongestByVerse.get(connectedId);
    if (!current || conn.strength > current.strength) strongestByVerse.set(connectedId, conn);
  });
  const connectedVerses = [...strongestByVerse.entries()]
    .map(([id, connection]) => ({ verse: verses.find((v) => v.id === id), connection }))
    .filter((item): item is { verse: (typeof verses)[number]; connection: (typeof connections)[number] } => !!item.verse);

  const suggestions = suggestSimilar(verse.id, 5);

  const sanskrit = live?.sanskrit || verse.sanskrit;
  const transliteration = live?.transliteration || verse.transliteration;
  const wordMeanings = live?.synonyms || verse.wordMeanings;
  const purport = live?.purport ?? [];

  const addButton = (
    <button
      type="button"
      className={`vd-add ${inNetwork ? 'in-network' : ''}`}
      onClick={() => onAddToNetwork(verse.id)}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={inNetwork}
    >
      {inNetwork ? <Check size={14} /> : <Plus size={14} />}
      {inNetwork ? 'In network' : 'Add to network'}
    </button>
  );

  const pager = (
    <nav className="vd-pager" aria-label="Verse navigation">
      <button
        type="button"
        className="vd-pager-btn"
        onClick={() => prevId && onNavigate?.(prevId)}
        disabled={!prevId || !onNavigate}
        title="Previous verse (↑)"
        aria-label={prevId ? `Previous verse, ${prevId}` : 'First verse of the chapter'}
      >
        <ChevronUp size={14} strokeWidth={2.4} />
        {prevId ?? '—'}
      </button>
      <span className="vd-pager-pos">
        Verse {verse.verse} of {chapter.verses} · Chapter {verse.chapter}
      </span>
      <button
        type="button"
        className="vd-pager-btn"
        onClick={() => nextId && onNavigate?.(nextId)}
        disabled={!nextId || !onNavigate}
        title="Next verse (↓)"
        aria-label={nextId ? `Next verse, ${nextId}` : 'Last verse of the chapter'}
      >
        {nextId ?? '—'}
        <ChevronDown size={14} strokeWidth={2.4} />
      </button>
    </nav>
  );

  const body = (
    <div className="vd-body">
      {/* Theme */}
      <section className="vd-section">
        <div className="vd-label muted">
          Theme
          {verse.curated && !verse.reviewed && (
            <span className="unreviewed-badge" title="Proposed by script; not yet checked by a person">
              unreviewed
            </span>
          )}
        </div>
        <h3 className="vd-theme">{verse.theme ?? 'Uncurated verse'}</h3>
        {verse.cluster && <div className="vd-cluster">{clusterLabel(verse.cluster)}</div>}
        {verse.summary && <p className="vd-summary">{verse.summary.replace(/\*/g, '')}</p>}
      </section>

      <Disclosure id="sanskrit" label="Sanskrit" open={openSections.sanskrit} onToggle={toggleSection}
        preview={<span lang="sa">{truncate(sanskrit, 22)}</span>}>
        <div className="vd-card vd-sanskrit" lang="sa">{sanskrit}</div>
      </Disclosure>

      <Disclosure id="transliteration" label="Transliteration" open={openSections.transliteration} onToggle={toggleSection}
        preview={<em>{truncate(transliteration)}</em>}>
        <div className="vd-card vd-transliteration">{transliteration}</div>
        {wordMeanings && (
          <>
            <div className="vd-sublabel">Word by word</div>
            <div className="vd-word-meanings">{wordMeanings}</div>
          </>
        )}
      </Disclosure>

      <Disclosure id="translation" label="Translation" open={openSections.translation} onToggle={toggleSection}
        preview={live ? truncate(live.translation, 32) : undefined}>
        {verseText.status === 'loading' && <div className="vd-muted">Loading from Vedabase…</div>}
        {live && <div className="vd-card vd-translation">{live.translation}</div>}
        {verseText.status === 'unavailable' && (
          <div className="vd-muted">Could not load the translation right now.</div>
        )}
        <a className="vd-link" href={vedabaseUrl(verse)} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={13} />
          Open {verse.id} on vedabase.io
        </a>
      </Disclosure>

      {/* Commentary: Prabhupada's purport, fetched at view time from /api/verse
          and never stored — the Bhaktivedanta Book Trust permits display only. */}
      {(purport.length > 0 || verseText.status === 'loading') && (
        <Disclosure id="commentary" label="Commentary" open={openSections.commentary} onToggle={toggleSection}
          preview={purport.length > 0 ? `${readMinutes(purport)} min read` : 'loading…'}>
          {purport.map((paragraph, i) => (
            <p key={i} className="vd-purport">{paragraph}</p>
          ))}
          {live && <div className="vedabase-attribution">{live.attribution}</div>}
        </Disclosure>
      )}

      {/* Key concepts */}
      {verse.concepts.length > 0 && (
        <section className="vd-section">
          <div className="vd-label">
            <Tag size={13} />
            Key concepts
            {verse.curated && !verse.reviewed && (
              <span className="unreviewed-badge" title="Proposed by script; not yet checked by a person">
                unreviewed
              </span>
            )}
          </div>
          <div className="vd-chips">
            {verse.concepts.map((concept, i) => (
              <span
                key={concept}
                className={`concept-badge ${i === 0 ? 'primary' : i === 1 ? 'secondary' : ''}`}
                title={i === 0 ? 'Primary theme' : i === 1 ? 'Secondary theme' : undefined}
              >
                {concept}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Connected verses: solid cards */}
      {connectedVerses.length > 0 && (
        <section className="vd-section">
          <div className="vd-label">
            <Link2 size={13} />
            Connected verses ({connectedVerses.length})
          </div>
          <div className="vd-stack">
            {connectedVerses.map(({ verse: cv, connection }, index) => {
              const { bars, verdict } = strengthMeter(connection.strength);
              return (
                <div key={cv.id} className="vd-connected">
                  <div className="vd-connected-head">
                    <span className="vd-verse-ref">{cv.id}</span>
                    <span className="vd-type-pill">{getTypeLabel(PREDEFINED_CONNECTION_TYPES, connection.type)}</span>
                  </div>
                  <div className="vd-connected-theme">{cv.theme ?? cv.transliteration}</div>
                  <div className="vd-connected-desc">{connection.description}</div>
                  <div className="vd-meter" title={`Strength ${connection.strength} of 10`}>
                    <span className="vd-meter-bars" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={`vd-meter-bar ${n <= bars ? 'is-on' : ''}`} />
                      ))}
                    </span>
                    <span className="vd-meter-verdict">{verdict}</span>
                    {index === 0 && (
                      <span className="vd-help">
                        <button type="button" className="vd-help-btn" aria-describedby="vd-strength-tip" aria-label="What does link strength mean?">
                          ?
                        </button>
                        <span role="tooltip" id="vd-strength-tip" className="vd-tooltip">
                          <strong>How strongly these two verses relate</strong>
                          Scored from shared concepts, shared theme, and how directly one verse answers the other. {bars} of five bars — {verdict.replace(' link', '').toLowerCase()}.
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Suggested: ghost rows — an outline of a link that doesn't exist yet */}
      {suggestions.length > 0 && (
        <section className="vd-section">
          <div className="vd-label">
            <Sparkles size={13} />
            Suggested connections
          </div>
          <p className="vd-hint">Similar verses by shared concepts — add one to link it here.</p>
          <div className="vd-stack">
            {suggestions.map(({ verse: sv, shared, sameTheme }) => {
              const added = connectedNeighbors.has(sv.id);
              return (
                <div key={sv.id} className={`vd-suggested ${added ? 'is-added' : ''}`}>
                  <div className="vd-suggested-main">
                    <span className="vd-verse-ref">{sv.id}</span>
                    <div className="vd-connected-theme">{sv.theme ?? sv.transliteration}</div>
                    {shared.length > 0 && (
                      <div className="vd-shared">
                        <span className="vd-shared-prefix">Shares</span>
                        {shared.map((c) => (
                          <span key={c} className="vd-shared-tag">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="vd-suggested-status">{added ? 'Linked' : 'Not linked yet'}</span>
                  <button
                    type="button"
                    className="vd-suggested-add"
                    onClick={() =>
                      onAddSuggestion(
                        verse.id,
                        sv.id,
                        suggestionConnection(shared.length ? shared : sameTheme ? ['theme'] : []),
                      )
                    }
                    disabled={added}
                    title={added ? 'Added' : 'Add & connect'}
                    aria-label={added ? `${sv.id} added` : `Add and connect ${sv.id}`}
                  >
                    {added ? <Check size={14} /> : <Plus size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className={`verse-detail mobile-bottom-sheet ${sheetClassName}`} style={sheetStyle}>
        <div className="bottom-sheet-top" {...grabberProps} aria-label="Drag to resize verse details">
          <div className="bottom-sheet-handle" aria-hidden="true" />
          <button
            type="button"
            className="vd-close mobile-close-button"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
          <div className="mobile-sheet-header">
            <div className="mobile-sheet-title-row">
              <div className="mobile-sheet-title-meta">
                <div className="vd-id">{verse.id}</div>
                <div className="vd-chapter">Chapter {verse.chapter} • Verse {verse.verse}</div>
              </div>
              {addButton}
            </div>
          </div>
          {pager}
        </div>
        <div className="bottom-sheet-body">{body}</div>
      </div>
    );
  }

  return (
    <div className="verse-detail">
      <header className="vd-header">
        <div className="vd-header-meta">
          <div className="vd-id">{verse.id}</div>
          <div className="vd-chapter">Chapter {verse.chapter} • Verse {verse.verse}</div>
        </div>
        {addButton}
        <button
          type="button"
          className="vd-close"
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Close panel"
        >
          <X size={18} />
        </button>
      </header>
      {pager}
      {body}
    </div>
  );
}
