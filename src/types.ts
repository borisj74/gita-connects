export interface Verse {
  chapter: number;
  verse: number;
  id: string; // e.g., "2.47"
  sanskrit: string;
  transliteration: string;
  translation: string;
  theme: string;
  concepts: string[];
}

export interface Connection {
  from: string; // verse id
  to: string; // verse id
  type: string; // connection type id (predefined or custom)
  description: string;
  strength: number; // 1-10
}

export interface Chapter {
  number: number;
  title: string;
  titleSanskrit: string;
  verses: number; // total verses in chapter
  theme: string;
}
