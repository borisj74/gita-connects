import type { Chapter } from '../types.js';

// Chapter metadata for all 18 chapters. Titles are Prabhupada's from
// Bhagavad-gita As It Is. Verse counts match the traditional
// 701-verse reckoning and are asserted against the imported verse files in
// src/data/data.test.ts.
export const chapters: Chapter[] = [
  { number: 1, title: 'Observing the Armies on the Battlefield of Kurukṣetra', titleSanskrit: 'Arjuna Vishada Yoga', verses: 47, theme: 'The despair and moral crisis of Arjuna' },
  { number: 2, title: 'Contents of the Gītā Summarized', titleSanskrit: 'Sankhya Yoga', verses: 72, theme: 'Knowledge of the imperishable soul' },
  { number: 3, title: 'Karma-yoga', titleSanskrit: 'Karma Yoga', verses: 43, theme: 'The yoga of selfless action' },
  { number: 4, title: 'Transcendental Knowledge', titleSanskrit: 'Jnana Karma Sannyasa Yoga', verses: 42, theme: 'Divine knowledge and the purpose of action' },
  { number: 5, title: 'Karma-yoga – Action in Kṛṣṇa Consciousness', titleSanskrit: 'Karma Sannyasa Yoga', verses: 29, theme: 'True renunciation through action' },
  { number: 6, title: 'Dhyāna-yoga', titleSanskrit: 'Dhyana Yoga', verses: 47, theme: 'The practice of meditation and self-control' },
  { number: 7, title: 'Knowledge of the Absolute', titleSanskrit: 'Jnana Vijnana Yoga', verses: 30, theme: 'Understanding the absolute truth' },
  { number: 8, title: 'Attaining the Supreme', titleSanskrit: 'Aksara Brahma Yoga', verses: 28, theme: 'The path to the eternal' },
  { number: 9, title: 'The Most Confidential Knowledge', titleSanskrit: 'Raja Vidya Raja Guhya Yoga', verses: 34, theme: 'The sovereign science and sovereign secret' },
  { number: 10, title: 'The Opulence of the Absolute', titleSanskrit: 'Vibhuti Yoga', verses: 42, theme: 'The opulence of the Absolute' },
  { number: 11, title: 'The Universal Form', titleSanskrit: 'Visvarupa Darsana Yoga', verses: 55, theme: 'The vision of the cosmic form' },
  { number: 12, title: 'Devotional Service', titleSanskrit: 'Bhakti Yoga', verses: 20, theme: 'The path of devotion' },
  { number: 13, title: 'Nature, the Enjoyer and Consciousness', titleSanskrit: 'Ksetra Ksetrajna Vibhaga Yoga', verses: 35, theme: 'Distinguishing matter from spirit' },
  { number: 14, title: 'The Three Modes of Material Nature', titleSanskrit: 'Gunatraya Vibhaga Yoga', verses: 27, theme: 'The three modes of material nature' },
  { number: 15, title: 'The Yoga of the Supreme Person', titleSanskrit: 'Purusottama Yoga', verses: 20, theme: 'The yoga of the supreme person' },
  { number: 16, title: 'The Divine and Demoniac Natures', titleSanskrit: 'Daivasura Sampad Vibhaga Yoga', verses: 24, theme: 'Divine and demoniac natures' },
  { number: 17, title: 'The Divisions of Faith', titleSanskrit: 'Sraddhatraya Vibhaga Yoga', verses: 28, theme: 'The divisions of faith' },
  { number: 18, title: 'Conclusion – The Perfection of Renunciation', titleSanskrit: 'Moksa Sannyasa Yoga', verses: 78, theme: 'The perfection of renunciation and surrender' },
];
