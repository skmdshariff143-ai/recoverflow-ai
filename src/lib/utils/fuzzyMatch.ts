/**
 * PayBack AI — Fuzzy-match utility for command palette search.
 *
 * Simple substring-based fuzzy filter: each character of the query
 * must appear in order (not necessarily contiguous) in the candidate.
 * Returns a score (higher = better match).
 *
 * Pure function — no side effects.
 */

export interface FuzzyMatchResult {
  /** Whether the candidate matches the query. */
  matches: boolean;
  /** Score for ranking: higher = tighter match. 0 if no match. */
  score: number;
}

/**
 * Test whether `query` fuzzy-matches `candidate`.
 *
 * Algorithm:
 * 1. If query is empty, everything matches (score 1).
 * 2. Walk through the candidate left-to-right, consuming query chars.
 * 3. Consecutive matches in the candidate boost the score.
 * 4. Exact prefix matches get the highest score.
 */
export function fuzzyMatch(query: string, candidate: string): FuzzyMatchResult {
  if (query.length === 0) return { matches: true, score: 1 };

  const q = query.toLowerCase();
  const c = candidate.toLowerCase();

  // Fast path: exact substring match
  const substringIndex = c.indexOf(q);
  if (substringIndex !== -1) {
    // Prefix match scores highest, then earlier positions
    const positionBonus = substringIndex === 0 ? 100 : Math.max(0, 50 - substringIndex);
    return { matches: true, score: 200 + positionBonus };
  }

  // Subsequence matching
  let qi = 0;
  let score = 0;
  let consecutiveBonus = 0;
  let lastMatchPos = -2;

  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) {
      // Consecutive character bonus
      if (ci === lastMatchPos + 1) {
        consecutiveBonus += 5;
      } else {
        consecutiveBonus = 0;
      }
      // Earlier matches are worth more
      score += 10 - Math.min(ci / c.length, 0.9) * 5 + consecutiveBonus;
      lastMatchPos = ci;
      qi++;
    }
  }

  if (qi === q.length) {
    return { matches: true, score: Math.max(1, Math.round(score)) };
  }

  return { matches: false, score: 0 };
}

/**
 * Searchable command item for the command palette.
 */
export interface CommandItem {
  /** Unique identifier. */
  id: string;
  /** Display label. */
  label: string;
  /** Search keywords (label is always included). */
  keywords: string[];
  /** Category grouping for visual separation. */
  category: 'payment' | 'navigation' | 'action';
  /** Optional icon hint. */
  icon?: string;
}

/**
 * Filter and rank a list of command items against a query.
 * Returns matched items sorted by score descending.
 */
export function filterCommands(
  items: ReadonlyArray<CommandItem>,
  query: string,
): Array<CommandItem & { score: number }> {
  if (query.trim() === '') return items.map((item) => ({ ...item, score: 1 }));

  const results: Array<CommandItem & { score: number }> = [];

  for (const item of items) {
    // Test against label and all keywords, take best score
    let bestScore = 0;
    const labelResult = fuzzyMatch(query, item.label);
    if (labelResult.matches && labelResult.score > bestScore) {
      bestScore = labelResult.score;
    }
    for (const kw of item.keywords) {
      const kwResult = fuzzyMatch(query, kw);
      if (kwResult.matches && kwResult.score > bestScore) {
        bestScore = kwResult.score;
      }
    }

    if (bestScore > 0) {
      results.push({ ...item, score: bestScore });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
