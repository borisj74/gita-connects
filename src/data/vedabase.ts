/**
 * Where a verse lives on vedabase.io. Our verse numbers come from the gita/gita
 * dataset, and Bhagavad-gita As It Is numbers a few places differently, so a
 * plain bg/<chapter>/<verse>/ URL can 404 or land on the wrong verse.
 */

// Vedabase gives some runs of verses one shared page (1.16–18 is at
// bg/1/16-18/, and bg/1/17/ is a 404). In As It Is numbering.
const COMBINED: Record<number, [number, number][]> = {
  1: [[16, 18], [21, 22], [32, 35], [37, 38]],
  2: [[42, 43]],
  5: [[8, 9], [27, 28]],
  6: [[11, 12], [13, 14], [20, 23]],
  10: [[4, 5], [12, 13]],
  11: [[10, 11], [26, 27], [41, 42]],
  12: [[3, 4], [6, 7], [13, 14], [18, 19]],
  13: [[1, 2], [6, 7], [8, 12]],
  14: [[22, 25]],
  15: [[3, 4]],
  16: [[1, 3], [11, 12], [13, 15]],
  17: [[5, 6], [26, 27]],
  18: [[51, 53]],
};

/**
 * Vedabase's page for one of our verses: "2/47" for 2.47, "1/16-18" for 1.17.
 *
 * Chapter 1 has 47 verses in our data and 46 in As It Is, whose 1.28 holds our
 * 1.28 and the first half of our 1.29. From there on each of our verses starts
 * in As It Is verse n − 1 (our 1.47 is its 1.46).
 */
export function vedabasePage(chapter: number, verse: number): string {
  const n = chapter === 1 && verse >= 29 ? verse - 1 : verse;
  const run = COMBINED[chapter]?.find(([from, to]) => n >= from && n <= to);
  return run ? `${chapter}/${run[0]}-${run[1]}` : `${chapter}/${n}`;
}
