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
// No shouting: an all-caps word is cased like any other ("BLUE DEVILS WIN BIG"
// -> "Blue Devils Win Big"). It keeps its capitals only when it is a known
// acronym (ACRONYMS: DCI, SCV, XP, ...), carries a digit (GE1), is a state
// code after a comma ("Marion, IN"), or is AM/PM after a number ("8 PM").
// Ordinals and decades lose their shouted suffix ("3RD" -> "3rd", "1990S" ->
// "1990s"), and brand names get their own casing back (SoundSport,
// marching.art). An acronym missing from ACRONYMS is title-cased ("NOVA" ->
// "Nova"); add it there to protect it.
//
// Casing the author chose otherwise is left alone: genuine mixed case
// (SoundSport, McNeil), numbers (98.425) and dotted tokens (U.S., a.m.). The
// class name "A Class" keeps its capital A.
// Idempotent: toApTitleCase(toApTitleCase(x)) === toApTitleCase(x).

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

// All-caps words that stay all caps. Game terms first, then general ones.
const ACRONYMS = new Set([
  // Drum corps, captions and the game
  "DCI", "DCA", "WGI", "BOA", "SCV", "SCVC", "BAC", "BDB", "BD", "PR",
  "GE", "GE1", "GE2", "VP", "VA", "CG", "MA", "XP",
  // Sports, media, business
  "NFL", "NBA", "MLB", "NHL", "NCAA", "ESPN", "MVP", "VIP", "TV", "CEO", "DIY",
  "AI", "DJ", "FAQ", "HQ", "OK", "TBA", "TBD", "USA", "UK", "NYC",
  // Time zones (AM/PM are handled after a number, below)
  "ET", "CT", "MT", "PT", "EST", "EDT", "CST", "CDT", "MST", "MDT",
  "PST", "PDT", "OT",
  // Roman numerals
  "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "XIII", "XIV",
  "XV", "XX",
]);

// Clock suffixes, kept in caps only straight after a number ("8 PM").
const MERIDIEMS = new Set(["AM", "PM"]);

// US state codes, kept in caps only straight after a comma ("Marion, IN").
const STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

// Names with their own casing, restored however they were typed.
const CANONICAL = new Map([
  ["soundsport", "SoundSport"],
  ["marching.art", "marching.art"],
]);

// A token whose trailing punctuation opens a subtitle forces the next word up.
const SUBTITLE_END = /[:?!|—–]$/;
// Standalone separators (" - ", " — ", " | ") likewise.
const SEPARATOR_TOKEN = /^(?:[-–—|/]+|\/\/)$/;
// Splits a token into leading punctuation, the word core, trailing punctuation.
const TOKEN_PARTS = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su;
// Compound separators inside a core; dashes open a new clause, hyphens/slashes don't.
const COMPOUND_SPLIT = /([-‐‑/]|[–—])/u;

/**
 * Whether a word is shouted: two or more letters and none of them lowercase.
 * @param {string} word
 * @returns {boolean}
 */
function isShouted(word) {
  return /\p{Lu}.*\p{Lu}/su.test(word) && !/\p{Ll}/u.test(word);
}

/**
 * The all-caps form a shouted word keeps, or null when it should be cased.
 * @param {string} word - A shouted word.
 * @param {string} prevToken - The previous whitespace-separated token.
 * @param {boolean} stateSlot - Whether a state code fits here (see toApTitleCase).
 * @returns {string | null}
 */
function keptCaps(word, prevToken, stateSlot) {
  if (/\p{N}/u.test(word)) return word; // GE1, B1
  const [, base, possessive = ""] = /^(.+?)(['’]S)?$/su.exec(word) || [];
  if (ACRONYMS.has(base)) return base + possessive.toLowerCase(); // DCI's
  if (stateSlot && STATE_CODES.has(word)) return word;
  if (/\d$/.test(prevToken) && MERIDIEMS.has(word)) return word;
  return null;
}

/**
 * Case one compound segment (a hyphen/slash-free word).
 * @param {string} word - Segment with no surrounding punctuation.
 * @param {boolean} mustCap - First/last word or subtitle opener.
 * @param {string} nextWord - The following word (for "A Class" and particles).
 * @param {string} prevToken - The previous token ("" inside a compound).
 * @param {boolean} stateSlot - Whether a state code fits here (see toApTitleCase).
 * @returns {string}
 */
function caseWord(word, mustCap, nextWord, prevToken, stateSlot) {
  if (!word) return word;
  const canonical = CANONICAL.get(word.toLowerCase());
  if (canonical) return canonical;
  // Numbers stand as written; a shouted ordinal or decade suffix comes down.
  if (/^\p{N}/u.test(word)) return /^\d+(?:ST|ND|RD|TH|S)$/.test(word) ? word.toLowerCase() : word;
  if (/\p{L}\.\p{L}/u.test(word)) return word; // U.S., a.m.
  if (isShouted(word)) {
    const kept = keptCaps(word, prevToken, stateSlot);
    if (kept) return kept;
    word = word.toLowerCase();
  } else if (/\p{Lu}/u.test(word.slice(1))) {
    return word; // SoundSport, McNeil
  }
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
  // In a fully shouted headline, "IN"/"OR"/"ME" after a comma are far more
  // often words than states, so a state code there must also end the phrase
  // ("..., MARION, IN" / "MARION, IN: ...").
  const shouting = !/\p{Ll}/u.test(headline);

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
      const prevToken = i > 0 ? parts[i - 1].token : "";
      const stateSlot =
        /,$/.test(prevToken) && (!shouting || i === lastWord || p.trail !== "");
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
        const out = caseWord(
          seg,
          capSeg || (closesClause && s === lastSeg),
          next,
          s === 0 ? prevToken : "",
          s === 0 && stateSlot,
        );
        capSeg = false;
        return out;
      });
      return p.lead + cased.join("") + p.trail;
    })
    .join(" ");
}

module.exports = { toApTitleCase, MINOR_WORDS, ACRONYMS };
