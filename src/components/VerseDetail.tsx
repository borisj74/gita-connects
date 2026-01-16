import { BookMarked, Tag, Network, X } from 'lucide-react';
import { verses, connections } from '../data.js';
import './VerseDetail.css';

interface VerseDetailProps {
  verseId: string | null;
  onClose: () => void;
  networkVerses: Set<string>;
}

export default function VerseDetail({ verseId, onClose, networkVerses }: VerseDetailProps) {
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

  // Find connections for this verse that are in the network
  const relatedConnections = connections.filter(
    c => c.from === verseId || c.to === verseId
  );

  const connectedVerses = relatedConnections
    .map(conn => {
      const connectedId = conn.from === verseId ? conn.to : conn.from;
      const connectedVerse = verses.find(v => v.id === connectedId);
      return {
        verse: connectedVerse,
        connection: conn,
      };
    })
    .filter(item => item.verse && networkVerses.has(item.verse.id)); // Only show if in network

  return (
    <div className="verse-detail">
      <div className="detail-header">
        <div>
          <div className="verse-id-large">{verse.id}</div>
          <div className="chapter-info">
            Chapter {verse.chapter} • Verse {verse.verse}
          </div>
        </div>
        <button className="close-button" onClick={onClose} aria-label="Close panel">
          <X size={20} />
        </button>
      </div>

      <div className="detail-content">
        {/* Theme */}
        <div className="detail-section">
          <div className="section-label">Theme</div>
          <div className="verse-theme-large">{verse.theme}</div>
        </div>

        {/* Sanskrit */}
        <div className="detail-section">
          <div className="section-label">Sanskrit</div>
          <div className="sanskrit-text large">{verse.sanskrit}</div>
        </div>

        {/* Transliteration */}
        <div className="detail-section">
          <div className="section-label">Transliteration</div>
          <div className="transliteration-text">{verse.transliteration}</div>
        </div>

        {/* Translation */}
        <div className="detail-section">
          <div className="section-label">Translation</div>
          <div className="translation-text">{verse.translation}</div>
        </div>

        {/* Concepts */}
        <div className="detail-section">
          <div className="section-label">
            <Tag size={14} />
            Key Concepts
          </div>
          <div className="concepts-grid">
            {verse.concepts.map(concept => (
              <div key={concept} className="concept-badge">
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
      </div>
    </div>
  );
}
