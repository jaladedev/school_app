/**
 * Word-level diff between two strings, using the classic LCS
 * (longest-common-subsequence) approach. No external dependency --
 * lesson-note bodies are short enough (a handful of paragraphs of
 * markdown, not whole documents) that an O(n*m) DP table is fine, and
 * pulling in a diff library for one feature felt like overkill.
 *
 * Tokenizing on `/(\s+)/` (a capturing split) keeps whitespace runs as
 * their own tokens interleaved with word tokens, so the diff is legible
 * for prose/markdown and the original spacing reconstructs exactly when
 * you concatenate all tokens back together.
 */

export type DiffToken = {
  type: "equal" | "added" | "removed";
  text: string;
};

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

export function computeWordDiff(oldText: string, newText: string): DiffToken[] {
  const a = tokenize(oldText);
  const b = tokenize(newText);

  // Word-level LCS is O(n*m) in both time and table memory. A lesson
  // note is normally a few paragraphs (low hundreds of tokens), but
  // nothing stops someone from pasting a huge document in -- cap the
  // word-level table size and fall back to a much cheaper line-level
  // diff rather than risk hanging the request or exhausting memory.
  if (a.length * b.length > 4_000_000) {
    return computeLineDiff(oldText, newText);
  }

  return diffTokens(a, b);
}

/** Coarser fallback for oversized inputs: whole lines as tokens instead of words. */
function computeLineDiff(oldText: string, newText: string): DiffToken[] {
  const a = oldText.split(/(\n)/).filter((t) => t.length > 0);
  const b = newText.split(/(\n)/).filter((t) => t.length > 0);
  return diffTokens(a, b);
}

function diffTokens(a: string[], b: string[]): DiffToken[] {
  const n = a.length;
  const m = b.length;

  // dp[i][j] = length of the LCS of a[i:] and b[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  // Merge adjacent tokens of the same type as we walk the DP table, so
  // "removed" runs and "added" runs render as single contiguous spans
  // instead of one <span> per word.
  function push(type: DiffToken["type"], text: string) {
    const last = tokens[tokens.length - 1];
    if (last && last.type === type) {
      last.text += text;
    } else {
      tokens.push({ type, text });
    }
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("removed", a[i]);
      i++;
    } else {
      push("added", b[j]);
      j++;
    }
  }
  while (i < n) {
    push("removed", a[i]);
    i++;
  }
  while (j < m) {
    push("added", b[j]);
    j++;
  }

  return tokens;
}
