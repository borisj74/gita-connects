import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { chapters, verses } from '../data.js';
import './ChapterSidebar.css';

interface ChapterSidebarProps {
  onVerseSelect: (verseId: string) => void;
  selectedVerseId: string | null;
}

export default function ChapterSidebar({ onVerseSelect, selectedVerseId }: ChapterSidebarProps) {
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
                <div className="chapter-count">{chapterVerses.length}</div>
              </button>

              {isExpanded && (
                <div className="verses-list">
                  {chapterVerses.map((verse, vIndex) => (
                    <div
                      key={verse.id}
                      className={`verse-item ${selectedVerseId === verse.id ? 'selected' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, verse.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onVerseSelect(verse.id)}
                      style={{ animationDelay: `${vIndex * 20}ms` }}
                    >
                      <div className="verse-number">{verse.id}</div>
                      <div className="verse-theme">{verse.theme}</div>
                      <div className="verse-concepts">
                        {verse.concepts.slice(0, 2).map(concept => (
                          <span key={concept} className="concept-tag">{concept}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
