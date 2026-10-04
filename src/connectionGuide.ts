/**
 * What each kind of connection means, in plain words: shown when a reader
 * picks a kind in the connection dialog, when they open a line's label, and
 * in full in the help panel's "Kinds of connection" tab.
 *
 * Examples are real connections from the app's own curation, described in
 * the app's own words (connectionGuide.test.ts checks each one exists).
 */
export interface ConnectionGuideEntry {
  /** What the kind means, in one or two plain sentences. */
  meaning: string;
  /** A question that helps a reader spot this kind. */
  ask: string;
  example: { from: string; to: string; why: string };
}

export const CONNECTION_GUIDE: Record<string, ConnectionGuideEntry> = {
  sequential: {
    meaning: 'The next verse carries the thought forward from the one before it. The argument as it unfolds.',
    ask: 'Does this verse continue what the last one began?',
    example: { from: '2.62', to: '2.63', why: 'Steps in the downward spiral from desire to destruction.' },
  },
  thematic: {
    meaning: 'Both verses share a concept, such as the soul, action, devotion or renunciation, wherever they sit in the Gita.',
    ask: 'Are these two verses about the same thing?',
    example: { from: '2.47', to: '3.19', why: 'Both teach performing duty without attachment to results.' },
  },
  progression: {
    meaning: 'An idea introduced in one verse is developed more fully in another, often chapters later.',
    ask: 'Does the second verse take the first one further?',
    example: { from: '2.14', to: '12.13', why: 'Equanimity in the face of dualities becomes a quality of a true devotee.' },
  },
  contrast: {
    meaning: 'One verse shows the material condition, the other its transcendence. Two sides of the same question.',
    ask: 'Does one show the problem and the other the way beyond it?',
    example: { from: '1.28', to: '2.11', why: 'Arjuna grieves for relatives; Krishna says the wise do not lament for the living or the dead.' },
  },
  goal: {
    meaning: 'Both verses point to the same final aim, especially surrender to Krishna.',
    ask: 'Do these lead to the same destination?',
    example: { from: '4.7', to: '18.66', why: 'Krishna’s promise to descend echoes his promise to deliver the surrendered soul.' },
  },
  dependency: {
    meaning: 'One verse builds on a premise that another verse establishes. The arrow points to the foundation.',
    ask: 'Would this verse make sense without that one?',
    example: { from: '7.14', to: '15.7', why: 'The struggle with illusion presupposes what the soul is.' },
  },
  'question-answer': {
    meaning: 'Arjuna asks in one verse; Krishna answers in another. The arrow runs from question to answer.',
    ask: 'Is this verse the reply to that one?',
    example: { from: '2.54', to: '2.55', why: 'Arjuna asks for the marks of steady consciousness; Krishna begins defining them.' },
  },
  definition: {
    meaning: 'One verse defines a term that another verse relies on. The arrow runs from the definition to where it is used.',
    ask: 'Do I need this verse to understand a word in that one?',
    example: { from: '2.48', to: '2.50', why: 'Yoga is defined as equanimity, which “yoga is skill in action” then relies on.' },
  },
  illustration: {
    meaning: 'One verse gives an example or a metaphor that makes another verse’s principle concrete.',
    ask: 'Is this a picture of that idea?',
    example: { from: '2.22', to: '2.13', why: 'The image of changing garments makes bodily aging and rebirth clear.' },
  },
  parallel: {
    meaning: 'The same teaching restated in another place, often in another chapter.',
    ask: 'Is this the same point, said again?',
    example: { from: '16.1', to: '12.13', why: 'The same character, described twice.' },
  },
};

/** Pairs of kinds that are easy to confuse, and how to tell them apart. */
export const TELLING_APART: { pair: string; answer: string }[] = [
  { pair: 'Sequential or Progression?', answer: 'Sequential is the very next step in the flow. Progression picks the idea up later and develops it.' },
  { pair: 'Thematic or Parallel?', answer: 'Thematic shares a subject. Parallel says the same thing again.' },
  { pair: 'Contrast or Goal?', answer: 'Contrast sets two sides against each other. Goal shows two paths arriving at one aim.' },
  { pair: 'Dependency or Definition?', answer: 'Dependency needs a whole idea from the other verse. Definition needs one word explained.' },
];
