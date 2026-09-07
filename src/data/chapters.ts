import type { Chapter } from '../types.js';

// Chapter metadata for all 18 chapters. Verse counts match the traditional
// 701-verse reckoning and are asserted against the imported verse files in
// src/data/data.test.ts.
export const chapters: Chapter[] = [
  { number: 1, title: "Arjuna's Dilemma", titleSanskrit: 'Arjuna Vishada Yoga', verses: 47, theme: 'The despair and moral crisis of Arjuna' },
  { number: 2, title: 'The Eternal Self', titleSanskrit: 'Sankhya Yoga', verses: 72, theme: 'Knowledge of the imperishable soul' },
  { number: 3, title: 'Path of Action', titleSanskrit: 'Karma Yoga', verses: 43, theme: 'The yoga of selfless action' },
  { number: 4, title: 'Wisdom & Renunciation', titleSanskrit: 'Jnana Karma Sannyasa Yoga', verses: 42, theme: 'Divine knowledge and the purpose of action' },
  { number: 5, title: 'Renunciation of Action', titleSanskrit: 'Karma Sannyasa Yoga', verses: 29, theme: 'True renunciation through action' },
  { number: 6, title: 'Meditation', titleSanskrit: 'Dhyana Yoga', verses: 47, theme: 'The practice of meditation and self-control' },
  { number: 7, title: 'Knowledge & Wisdom', titleSanskrit: 'Jnana Vijnana Yoga', verses: 30, theme: 'Understanding the absolute truth' },
  { number: 8, title: 'The Imperishable Brahman', titleSanskrit: 'Aksara Brahma Yoga', verses: 28, theme: 'The path to the eternal' },
  { number: 9, title: 'Royal Knowledge', titleSanskrit: 'Raja Vidya Raja Guhya Yoga', verses: 34, theme: 'The sovereign science and sovereign secret' },
  { number: 10, title: 'Divine Manifestations', titleSanskrit: 'Vibhuti Yoga', verses: 42, theme: 'The opulence of the Absolute' },
  { number: 11, title: 'Universal Form', titleSanskrit: 'Visvarupa Darsana Yoga', verses: 55, theme: 'The vision of the cosmic form' },
  { number: 12, title: 'Devotion', titleSanskrit: 'Bhakti Yoga', verses: 20, theme: 'The path of devotion' },
  { number: 13, title: 'Field & Knower', titleSanskrit: 'Ksetra Ksetrajna Vibhaga Yoga', verses: 35, theme: 'Distinguishing matter from spirit' },
  { number: 14, title: 'Three Modes', titleSanskrit: 'Gunatraya Vibhaga Yoga', verses: 27, theme: 'The three modes of material nature' },
  { number: 15, title: 'Supreme Person', titleSanskrit: 'Purusottama Yoga', verses: 20, theme: 'The yoga of the supreme person' },
  { number: 16, title: 'Divine & Demonic', titleSanskrit: 'Daivasura Sampad Vibhaga Yoga', verses: 24, theme: 'Divine and demoniac natures' },
  { number: 17, title: 'Three Types of Faith', titleSanskrit: 'Sraddhatraya Vibhaga Yoga', verses: 28, theme: 'The divisions of faith' },
  { number: 18, title: 'Liberation', titleSanskrit: 'Moksa Sannyasa Yoga', verses: 78, theme: 'The perfection of renunciation and surrender' },
];
