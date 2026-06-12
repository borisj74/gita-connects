import { useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Check, Plus } from 'lucide-react';
import { chapters, verses } from '../data.js';
import './ChapterSidebar.css';

interface ChapterSidebarProps {
  onVerseSelect: (verseId: string) => void;
  selectedVerseId: string | null;
  networkVerses: Set<string>;
  isMobile?: boolean;
  onAddToNetwork?: (verseId: string) => void;
}

export default function ChapterSidebar({
  onVerseSelect,
  selectedVerseId,
  networkVerses,
  isMobile = false,
  onAddToNetwork,
}: ChapterSidebarProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set([2, 3, 6]));

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
    return verses.filter(v => v.chapter === chapterNum);
  };

  return (
    <div className="chapter-sidebar">
      <div className="chapters-list">
        {chapters.map((chapter, index) => {
          const isExpanded = expandedChapters.has(chapter.number);
          const chapterVerses = getChapterVerses(chapter.number);
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
                        <div className="verse-theme">{verse.theme}</div>
                        <div className="verse-concepts">
                          {verse.concepts.slice(0, 2).map(concept => (
                            <span key={concept} className="concept-tag">{concept}</span>
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
