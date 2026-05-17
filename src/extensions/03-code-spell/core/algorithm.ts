import { getDictionaryWordsAsArray } from './dictionary';

let cachedDictionaryArray: string[] | null = null;

/**
 * Calculates Sørensen–Dice coefficient using bigrams.
 * Returns value between 0.0 (no similarity) and 1.0 (exact match).
 * Excellent for capturing typos and transposed letters.
 */
function diceCoefficient(a: string, b: string): number {
  if (a === b) {return 1;}
  if (a.length < 2 || b.length < 2) {return 0;}
  
  const aBigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.substring(i, i + 2);
    aBigrams.set(bg, (aBigrams.get(bg) || 0) + 1);
  }
  
  let matches = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.substring(i, i + 2);
    const count = aBigrams.get(bg);
    if (count && count > 0) {
      matches++;
      aBigrams.set(bg, count - 1);
    }
  }
  
  return (2.0 * matches) / (a.length - 1 + b.length - 1);
}

/**
 * Optimized Levenshtein Distance.
 * Uses only two rows of memory (O(n)).
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

    if (minLineDist > threshold) {
      return threshold + 1;
    }

    const tmp = v0;
    v0 = v1;
    v1 = tmp;
  }

  return v0[b.length];
}

/**
 * Generates the BEST typographical suggestion.
 * Now uses a combined Levenshtein + Dice Coefficient logic
 * for vastly superior accuracy on multi-letter typos.
 */
export function getBestSuggestions(word: string, maxSuggestions = 1): string[] {
  const target = word.toLowerCase();

  // Lazy initialization of the dictionary array cache
  if (!cachedDictionaryArray) {
    cachedDictionaryArray = getDictionaryWordsAsArray();
  }

  const dictionary = cachedDictionaryArray;
  const candidates: { word: string; distance: number; score: number }[] = [];
  
  // Dynamic threshold: Allow 3 edits for longer words! Solves the "one letter support" issue.
  const MAX_DISTANCE = target.length >= 6 ? 3 : 2;

  for (const dictWord of dictionary) {
    // Fast initial length filter
    if (Math.abs(dictWord.length - target.length) <= MAX_DISTANCE) {
      const dist = levenshteinDistance(target, dictWord, MAX_DISTANCE);
      
      if (dist <= MAX_DISTANCE) {
        // Tie-breaker algorithm (Jaro/Dice similarity)
        const similarity = diceCoefficient(target, dictWord);
        
        // Start letter penalty: Typos rarely change the first letter
        const firstLetterPenalty = (target[0] !== dictWord[0]) ? 1.0 : 0.0;
        
        // Final Algorithm Score. Lower is better.
        // Base distance + penalties - similarity bonus
        const score = dist + firstLetterPenalty - similarity;
        
        candidates.push({ word: dictWord, distance: dist, score });
      }
    }
  }

  // Sort and return the best match
  return candidates
    .sort((a, b) => a.score - b.score)
    .slice(0, maxSuggestions)
    .map((s) => s.word);
}

/**
 * Invalidates the cache when new words are added.
 */
export function invalidateSuggestionsCache() {
  cachedDictionaryArray = null;
}
