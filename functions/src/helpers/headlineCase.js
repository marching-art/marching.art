// AP title case for news headlines.
//
// Every news headline — AI-generated recaps, the Podium season assessment,
// community submissions, director press releases, admin edits — is stored and
// served in AP title case so the news hub reads like one publication.
//
// Client twin: src/utils/headlineCase.ts (`toApTitleCase`). The two are
// hand-mirrored (functions can't import outside their deploy root) and held
// together by src/utils/headlineCase.test.ts, which runs both over the same
// corpus — edit one, edit the other.
//
// AP composition-title rules, as applied here:
//   - Capitalize principal words, including any word of four or more letters.
//   - Lowercase articles (a, an, the), conjunctions and prepositions of three
//     letters or fewer — unless first, last, or opening a subtitle (after a
//     colon, question/exclamation mark, dash or pipe).
//   - Capitalize each part of a hyphenated compound ("Top-Ranked",
//     "Head-to-Head").
//   - "up", "off" and "out" stay capitalized: in game headlines they are
//     almost always phrasal-verb particles ("Moves Up", "Holds Off"). So do
//     "on", "in" and "by" when another preposition follows them — the mark of
//     a particle ("Hold On in Toledo", "Moves On to Finals").
//
// Words the author cased deliberately are left alone: acronyms and mixed case
// (DCI, GE1, SoundSport), anything starting with a digit (2nd, 98.425), and
// dotted tokens (marching.art, a.m.). The class name "A Class" keeps its
// capital A. Idempotent: toApTitleCase(toApTitleCase(x)) === toApTitleCase(x).

const MINOR_WORDS = new Set([
  // Articles
  "a", "an", "the",
  // Coordinating conjunctions of three letters or fewer
  "and", "but", "for", "nor", "or", "so", "yet",
  // Prepositions of three letters or fewer
  "as", "at", "by", "en", "in", "of", "on", "per", "to", "via", "vs", "v",
]);

// Particles that read as part of the verb when a preposition follows them.
const PARTICLES = new Set(["on", "in", "by"]);
const PREPOSITIONS = new Set(["as", "at", "by", "in", "of", "on", "to", "via"]);

// A token whose trailing punctuation opens a subtitle forces the next word up.
const SUBTITLE_END = /[:?!|—–]$/;
// Standalone separators (" - ", " — ", " | ") likewise.
const SEPARATOR_TOKEN = /^(?:[-–—|/]+|\/\/)$/;
// Splits a token into leading punctuation, the word core, trailing punctuation.
const TOKEN_PARTS = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su;
// Compound separators inside a core; dashes open a new clause, hyphens/slashes don't.
const COMPOUND_SPLIT = /([-‐‑/]|[–—])/u;

/**
 * Whether a single word core carries casing the author chose on purpose and
 * must not be touched.
 * @param {string} word
 * @returns {boolean}
 */
function isPreservedWord(word) {
  if (/^\p{N}/u.test(word)) return true; // 2nd, 98.425, 1990s
  if (/\p{Lu}/u.test(word.slice(1))) return true; // DCI, GE1, SoundSport, McNeil
  if (/\p{L}\.\p{L}/u.test(word)) return true; // marching.art, a.m.
  return false;
}

/**
 * Case one compound segment (a hyphen/slash-free word).
 * @param {string} word - Segment with no surrounding punctuation.
 * @param {boolean} mustCap - First/last word or subtitle opener.
 * @param {string} nextWord - The following word (for "A Class").
 * @returns {string}
 */
function caseWord(word, mustCap, nextWord) {
  if (!word || isPreservedWord(word)) return word;
  const lower = word.toLowerCase();
  if (!mustCap && MINOR_WORDS.has(lower)) {
    // "A Class" is a proper noun (the competitive class), not an article.
    if (word === "A" && /^class\b/i.test(nextWord)) return word;
    if (!(PARTICLES.has(lower) && PREPOSITIONS.has(nextWord.toLowerCase()))) return lower;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Convert a headline to AP title case.
 *
 * @param {unknown} headline - Raw headline (non-strings yield "").
 * @returns {string} The headline in AP title case, whitespace collapsed.
 */
function toApTitleCase(headline) {
  if (typeof headline !== "string") return "";
  const tokens = headline.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  const parts = tokens.map(token => {
    const [, lead = "", core = "", trail = ""] = TOKEN_PARTS.exec(token) || [];
    return { token, lead, core, trail };
  });
  const wordIdx = parts.map((p, i) => (p.core ? i : -1)).filter(i => i >= 0);
  const firstWord = wordIdx[0];
  const lastWord = wordIdx[wordIdx.length - 1];

  let forceNext = true;
  return parts
    .map((p, i) => {
      if (!p.core) {
        if (SEPARATOR_TOKEN.test(p.token) || SUBTITLE_END.test(p.token)) forceNext = true;
        return p.token;
      }
      const opensClause = forceNext || i === firstWord;
      // The last word of the headline, or of a title before a subtitle, is capitalized.
      const closesClause = i === lastWord || SUBTITLE_END.test(p.trail);
      forceNext = SUBTITLE_END.test(p.trail);

      const nextCore = parts.slice(i + 1).find(n => n.core)?.core || "";
      const segments = p.core.split(COMPOUND_SPLIT);
      const lastSeg = segments.length - 1;
      let capSeg = opensClause;
      const cased = segments.map((seg, s) => {
        if (s % 2 === 1) {
          // Separator: an em/en dash opens a new clause; a hyphen/slash doesn't.
          capSeg = /[–—]/.test(seg);
          return seg;
        }
        const next = s < lastSeg ? segments[s + 2] : nextCore;
        const out = caseWord(seg, capSeg || (closesClause && s === lastSeg), next);
        capSeg = false;
        return out;
      });
      return p.lead + cased.join("") + p.trail;
    })
    .join(" ");
}

module.exports = { toApTitleCase, MINOR_WORDS };
