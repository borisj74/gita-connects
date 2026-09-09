import { useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Check, Plus, X } from 'lucide-react';
import type { Concept } from '../concepts.js';
import { chapters, verses } from '../data/index.js';
import './ChapterSidebar.css';

interface ChapterSidebarProps {
  onVerseSelect: (verseId: string) => void;
  selectedVerseId: string | null;
  networkVerses: Set<string>;
  isMobile?: boolean;
  onAddToNetwork?: (verseId: string) => void;
  /** Active concept filter (App 23): only verses tagged with it are listed. */
  conceptFilter?: string | null;
  onConceptSelect?: (concept: string) => void;
  onClearConceptFilter?: () => void;
}

export default function ChapterSidebar({
  onVerseSelect,
  selectedVerseId,
  networkVerses,
  isMobile = false,
  onAddToNetwork,
  conceptFilter = null,
  onConceptSelect,
  onClearConceptFilter,
}: ChapterSidebarProps) {
  // Under a concept filter every matching chapter starts open; the parent
  // remounts this component (key) when the filter changes, so this initial
  // state is recomputed rather than synced.
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(() =>
    conceptFilter
      ? new Set(verses.filter((v) => v.concepts.includes(conceptFilter as Concept)).map((v) => v.chapter))
      : new Set([2, 3, 6]),
  );

  const toggleChapter = (chapterNum: number) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterNum)) {
        next.delete(chapterNum);
      } else {
        next.add(chapterNum);
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, verseId: string) => {
    e.dataTransfer.setData('verseId', verseId);
    e.dataTransfer.effectAllowed = 'copy';

    // Add visual feedback
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
  };

  const getChapterVerses = (chapterNum: number) => {
    return verses.filter(
      (v) => v.chapter === chapterNum && (!conceptFilter || v.concepts.includes(conceptFilter as Concept)),
    );
  };

  // Rows show two chips; under a filter the matching one is always among them.
  const visibleConcepts = (concepts: readonly string[]) => {
    const first = concepts.slice(0, 2);
    if (conceptFilter && concepts.includes(conceptFilter) && !first.includes(conceptFilter)) {
      return [first[0], conceptFilter];
    }
    return first;
  };

  const chipClick = (e: React.MouseEvent, concept: string) => {
    if (!onConceptSelect) return;
    e.stopPropagation();
    onConceptSelect(concept);
  };

  return (
    <div className="chapter-sidebar">
      {conceptFilter && (
        <div className="concept-filter-bar">
          <span className="concept-filter-label">Concept</span>
          <span className="concept-filter-chip">
            {conceptFilter}
            <button
              type="button"
              className="concept-filter-clear"
              onClick={onClearConceptFilter}
              aria-label={`Clear ${conceptFilter} filter`}
            >
              <X size={11} strokeWidth={3} />
            </button>
          </span>
        </div>
      )}
      <div className="chapters-list">
        {chapters.map((chapter, index) => {
          const isExpanded = expandedChapters.has(chapter.number);
          const chapterVerses = getChapterVerses(chapter.number);
          if (conceptFilter && chapterVerses.length === 0) return null;
          const inNetworkCount = chapterVerses.filter(v => networkVerses.has(v.id)).length;

          return (
            <div
              key={chapter.number}
              className="chapter-item"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <button
                className={`chapter-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleChapter(chapter.number)}
              >
                <div className="chapter-icon">
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
                <div className="chapter-info">
                  <div className="chapter-number">Chapter {chapter.number}</div>
                  <div className="chapter-title">{chapter.title}</div>
                  <div className="chapter-title-sanskrit">{chapter.titleSanskrit}</div>
                </div>
                <div className="chapter-count">
                  {inNetworkCount > 0 && (
                    <span className="chapter-count-active">{inNetworkCount}/</span>
                  )}
                  {chapterVerses.length}
                </div>
              </button>

              {isExpanded && (
                <div className="verses-list">
                  {chapterVerses.map((verse, vIndex) => {
                    const inNetwork = networkVerses.has(verse.id);
                    return (
                    <div
                      key={verse.id}
                      className={`verse-item ${selectedVerseId === verse.id ? 'selected' : ''} ${inNetwork ? 'in-network' : ''} ${isMobile ? 'touch-verse' : ''}`}
                      draggable={!isMobile}
                      onDragStart={isMobile ? undefined : (e) => handleDragStart(e, verse.id)}
                      onDragEnd={isMobile ? undefined : handleDragEnd}
                      onClick={() => onVerseSelect(verse.id)}
                      style={{ animationDelay: `${vIndex * 20}ms` }}
                    >
                      {inNetwork
                        ? <Check size={14} className="verse-grip verse-in-network-icon" />
                        : <GripVertical size={14} className={`verse-grip ${isMobile ? 'verse-grip-hidden' : ''}`} />}
                      <div className="verse-item-body">
                        <div className="verse-number">{verse.id}</div>
                        <div className="verse-theme">{verse.theme ?? verse.transliteration}</div>
                        <div className="verse-concepts">
                          {visibleConcepts(verse.concepts).map(concept => (
                            <button
                              key={concept}
                              type="button"
                              className={`concept-tag ${
                                conceptFilter === concept ? 'is-active' : conceptFilter ? 'is-muted' : ''
                              }`}
                              onClick={(e) => chipClick(e, concept)}
                              draggable={false}
                              title={conceptFilter === concept ? 'Clear filter' : `Show all verses on ${concept}`}
                            >
                              {concept}
                            </button>
                          ))}
                        </div>
                      </div>
                      {isMobile && !inNetwork && onAddToNetwork && (
                        <button
                          type="button"
                          className="verse-add-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToNetwork(verse.id);
                          }}
                          aria-label={`Add ${verse.id} to network`}
                          title="Add to network"
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
