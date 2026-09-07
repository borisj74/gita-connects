import { BookMarked, Tag, Network, X, ScrollText, Plus, Check, Sparkles, ExternalLink, BookOpen } from 'lucide-react';
import { verses, connections, vedabaseUrl } from '../data/index.js';
import { useVerseText } from '../hooks/useVerseText.js';
import { clusterLabel } from '../clusters.js';
import { suggestSimilar, suggestionConnection } from '../suggestions.js';
import { useBottomSheet } from '../hooks/useBottomSheet.js';
import './VerseDetail.css';

interface VerseDetailProps {
  verseId: string | null;
  onClose: () => void;
  networkVerses: Set<string>;
  onAddToNetwork: (verseId: string) => void;
  onAddSuggestion: (fromId: string, toId: string, conn: { type: string; description: string; strength: number }) => void;
  connectedNeighbors: Set<string>;
  isMobile?: boolean;
}

export default function VerseDetail({
  verseId,
  onClose,
  networkVerses,
  onAddToNetwork,
  onAddSuggestion,
  connectedNeighbors,
  isMobile = false,
}: VerseDetailProps) {
  const { sheetClassName, sheetStyle, grabberProps } = useBottomSheet({
    enabled: isMobile && !!verseId,
    onClose,
  });

  // Above the early returns below, so hook order is identical on every render.
  const verseText = useVerseText(verseId);
  const live = verseText.status === 'ready' ? verseText.text : null;

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

  const verse = verses.find(v => v.id === verseId);
  if (!verse) return null;

  const inNetwork = networkVerses.has(verse.id);

  // Find connections for this verse that are in the network
  const relatedConnections = connections.filter(
    c => c.from === verseId || c.to === verseId
  );

  // One entry per connected verse, keeping the strongest connection — mirrors
  // the canvas, which collapses multiple connections per pair to one edge.
  const strongestByVerse = new Map<string, typeof connections[number]>();
  relatedConnections.forEach(conn => {
    const connectedId = conn.from === verseId ? conn.to : conn.from;
    if (!networkVerses.has(connectedId)) return;
    const current = strongestByVerse.get(connectedId);
    if (!current || conn.strength > current.strength) {
      strongestByVerse.set(connectedId, conn);
    }
  });

  const connectedVerses = [...strongestByVerse.entries()]
    .map(([connectedId, connection]) => ({
      verse: verses.find(v => v.id === connectedId),
      connection,
    }))
    .filter(item => item.verse);

  // Discovery: verses similar by concept that aren't already authored-linked.
  const suggestions = suggestSimilar(verse.id, 5);

  const detailHeader = (
    <div className="detail-header">
      <button
        className="close-button"
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Close panel"
      >
        <X size={20} />
      </button>
      <div className="detail-header-row">
        <div className="detail-header-meta">
          <div className="verse-id-large">{verse.id}</div>
          <div className="chapter-info">
            Chapter {verse.chapter} • Verse {verse.verse}
          </div>
        </div>
        <button
          className={`add-to-network-button ${inNetwork ? 'in-network' : ''}`}
          onClick={() => onAddToNetwork(verse.id)}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={inNetwork}
        >
          {inNetwork ? <Check size={16} /> : <Plus size={16} />}
          {inNetwork ? 'In network' : 'Add to network'}
        </button>
      </div>
    </div>
  );

  const detailBody = (
      <div className="detail-content">
        {/* Theme */}
        <div className="detail-section">
          <div className="section-label">
            Theme
            {verse.curated && !verse.reviewed && (
              <span className="unreviewed-badge" title="Proposed by script; not yet checked by a person">
                unreviewed
              </span>
            )}
          </div>
          <div className="verse-theme-large">{verse.theme ?? verse.transliteration}</div>
          {verse.cluster && (
            <div className="verse-cluster">{clusterLabel(verse.cluster)}</div>
          )}
        </div>

        {/* Sanskrit */}
        <div className="detail-section">
          <div className="section-label">Sanskrit</div>
          <div className="sanskrit-text large">{live?.sanskrit || verse.sanskrit}</div>
        </div>

        {/* Transliteration */}
        <div className="detail-section">
          <div className="section-label">Transliteration</div>
          <div className="transliteration-text">
            {live?.transliteration || verse.transliteration}
          </div>
        </div>

        {/* Word-by-word meanings */}
        <div className="detail-section">
          <div className="section-label">Word by word</div>
          <div className="word-meanings-text">{live?.synonyms || verse.wordMeanings}</div>
        </div>

        {/* Summary — our own words. Prabhupada's translation and purport are
            BBT copyright, so we link to Vedabase rather than reproduce them. */}
        {verse.summary && (
          <div className="detail-section">
            <div className="section-label">
              <ScrollText size={14} />
              Summary
            </div>
            <div className="purport-text">{verse.summary}</div>
          </div>
        )}

        {/* Prabhupada's translation and purport. Fetched at view time from
            /api/verse; never stored, never committed — the Bhaktivedanta Book
            Trust permits display only. Falls back to a link if unavailable. */}
        <div className="detail-section">
          <div className="section-label">
            <BookOpen size={14} />
            Translation
          </div>

          {verseText.status === 'loading' && (
            <div className="vedabase-loading">Loading from Vedabase…</div>
          )}

          {verseText.status === 'ready' && (
            <>
              <div className="translation-text">{verseText.text.translation}</div>

              {verseText.text.purport.length > 0 && (
                <>
                  <div className="section-label purport-label">
                    <ScrollText size={14} />
                    Purport
                  </div>
                  {verseText.text.purport.map((paragraph, i) => (
                    <p key={i} className="purport-text">
                      {paragraph}
                    </p>
                  ))}
                </>
              )}

              <div className="vedabase-attribution">{verseText.text.attribution}</div>
            </>
          )}

          {verseText.status === 'unavailable' && (
            <div className="vedabase-loading">
              Could not load the translation right now.
            </div>
          )}

          <a
            className="vedabase-link"
            href={vedabaseUrl(verse)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} />
            Open {verse.id} on vedabase.io
          </a>
        </div>

        {/* Concepts */}
        <div className="detail-section">
          <div className="section-label">
            <Tag size={14} />
            Key Concepts
            {verse.curated && !verse.reviewed && (
              <span className="unreviewed-badge" title="Proposed by script; not yet checked by a person">
                unreviewed
              </span>
            )}
          </div>
          <div className="concepts-grid">
            {verse.concepts.map((concept, i) => (
              <div
                key={concept}
                className={`concept-badge ${i === 0 ? 'primary' : i === 1 ? 'secondary' : ''}`}
                title={i === 0 ? 'Primary theme' : i === 1 ? 'Secondary theme' : undefined}
              >
                {concept}
              </div>
            ))}
          </div>
        </div>

        {/* Connected Verses */}
        {connectedVerses.length > 0 && (
          <div className="detail-section">
            <div className="section-label">
              <Network size={14} />
              Connected Verses ({connectedVerses.length})
            </div>
            <div className="connected-verses">
              {connectedVerses.map(({ verse: connVerse, connection }) => (
                <div key={connVerse!.id} className="connected-verse-item">
                  <div className="connected-header">
                    <span className="connected-id">{connVerse!.id}</span>
                    <span className={`connection-type ${connection.type}`}>
                      {connection.type}
                    </span>
                  </div>
                  <div className="connected-theme">{connVerse!.theme}</div>
                  <div className="connection-description">
                    {connection.description}
                  </div>
                  <div className="connection-strength">
                    Strength: {connection.strength}/10
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested connections (discovery) */}
        {suggestions.length > 0 && (
          <div className="detail-section">
            <div className="section-label">
              <Sparkles size={14} />
              Suggested Connections
            </div>
            <p className="suggested-hint">Similar verses by shared concepts — add one to link it here.</p>
            <div className="suggested-verses">
              {suggestions.map(({ verse: sv, shared, sameTheme }) => {
                const added = connectedNeighbors.has(sv.id);
                return (
                <div key={sv.id} className="suggested-verse-item">
                  <div className="suggested-main">
                    <div className="connected-header">
                      <span className="connected-id">{sv.id}</span>
                      <span className="suggested-overlap">
                        {shared.length > 0 ? `${shared.length} shared` : 'similar theme'}
                      </span>
                    </div>
                    <div className="connected-theme">{sv.theme}</div>
                    {shared.length > 0 && (
                      <div className="suggested-shared">
                        {shared.map((c) => (
                          <span key={c} className="suggested-shared-tag">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className={`suggested-add ${added ? 'added' : ''}`}
                    onClick={() => onAddSuggestion(verse.id, sv.id, suggestionConnection(shared.length ? shared : (sameTheme ? ['theme'] : [])))}
                    disabled={added}
                    title={added ? 'Added' : 'Add & connect'}
                    aria-label={added ? `${sv.id} added` : `Add and connect ${sv.id}`}
                  >
                    {added ? <Check size={16} /> : <Plus size={16} />}
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
  );

  const mobileSheetHeader = (
    <div className="mobile-sheet-header">
      <div className="mobile-sheet-title-row">
        <div className="mobile-sheet-title-meta">
          <div className="verse-id-large">{verse.id}</div>
          <div className="chapter-info">
            Chapter {verse.chapter} • Verse {verse.verse}
          </div>
        </div>
        <button
          className={`mobile-status-button ${inNetwork ? 'in-network' : 'add-network'}`}
          onClick={() => onAddToNetwork(verse.id)}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={inNetwork}
        >
          {inNetwork ? <Check size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
          {inNetwork ? 'In network' : 'Add to network'}
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div
        className={`verse-detail mobile-bottom-sheet ${sheetClassName}`}
        style={sheetStyle}
      >
        <div
          className="bottom-sheet-top"
          {...grabberProps}
          aria-label="Drag to resize verse details"
        >
          <div className="bottom-sheet-handle" aria-hidden="true" />
          <button
            className="close-button mobile-close-button"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Close panel"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
          {mobileSheetHeader}
        </div>
        <div className="bottom-sheet-body">{detailBody}</div>
      </div>
    );
  }

  return (
    <div className="verse-detail">
      {detailHeader}
      {detailBody}
    </div>
  );
}
