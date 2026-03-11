import { getDictionaryWordsAsArray } from './dictionary';

let cachedDictionaryArray: string[] | null = null;

/**
 * Optimized Levenshtein Distance.
 * Uses only two rows of memory (O(n) instead of O(n*m)) and supports early exit.
 */
function levenshteinDistance(a: string, b: string, threshold: number): number {
  if (Math.abs(a.length - b.length) > threshold) {
    return threshold + 1;
  }

  let v0 = new Int32Array(b.length + 1);
  let v1 = new Int32Array(b.length + 1);

  for (let i = 0; i <= b.length; i++) {
    v0[i] = i;
  }

  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    let minLineDist = v1[0];

    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      minLineDist = Math.min(minLineDist, v1[j + 1]);
    }

    // Early exit if the entire row exceeds threshold
    if (minLineDist > threshold) {
      return threshold + 1;
    }

    // Swap buffers
    const tmp = v0;
    v0 = v1;
    v1 = tmp;
  }

  return v0[b.length];
}

/**
 * Generates typographical suggestions for Quick Fixes.
 * Uses a cached dictionary array to avoid O(n) copy on every call.
 */
export function getSuggestions(word: string, maxSuggestions = 3): string[] {
  const target = word.toLowerCase();

  // Lazy initialization of the dictionary array cache
  if (!cachedDictionaryArray) {
    cachedDictionaryArray = getDictionaryWordsAsArray();
  }

  const dictionary = cachedDictionaryArray;
  const candidates: { word: string; distance: number }[] = [];
  const MAX_DISTANCE = 2; // Suggestions beyond 2 edits are rarely helpful

  for (const dictWord of dictionary) {
    // Length pre-filter (90% faster)
    if (Math.abs(dictWord.length - target.length) <= MAX_DISTANCE) {
      const dist = levenshteinDistance(target, dictWord, MAX_DISTANCE);
      if (dist <= MAX_DISTANCE) {
        candidates.push({ word: dictWord, distance: dist });
      }
    }
  }

  // Sort and return top results
  return candidates
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxSuggestions)
    .map((s) => s.word);
}

/**
 * Public method to invalidate the cache when the dictionary changes (new words added).
 */
export function invalidateSuggestionsCache() {
  cachedDictionaryArray = null;
}
