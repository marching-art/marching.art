// Casting for AI-generated news and avatar images.
//
// Left to its defaults the image model casts almost every featured performer
// as a white man and puts every woman in color guard — the 2026 visual audit of
// 75 recap images found ~3 in 4 foreground figures drawn as white men, no woman
// on brass, drums, or the podium, and only one frame with two women in it.
//
// So each prompt names who its featured performers are, drawn at random for
// every image: gender is a coin flip, background is weighted to the makeup of
// young Americans, and neither is ever tied to a section or instrument. No
// rotation, no pattern — any performer can turn up on any part, and across a
// season the cast looks like the country rather than one stock figure.

/**
 * @typedef {{ woman: string, man: string, weight: number }} Background
 * @typedef {{ who: string, woman: boolean }} CastMember
 * @typedef {() => number} Rng - returns a float in [0, 1), like Math.random.
 */

/**
 * U.S. backgrounds with approximate shares (%) of Americans aged roughly
 * 15–24, rounded from Census Bureau population estimates (Hispanic/Latino of
 * any race counted once; Middle Eastern split out of white). Approximate by
 * design — the point is a believable national mix, not a quota.
 * @type {ReadonlyArray<Background>}
 */
const US_BACKGROUNDS = Object.freeze([
  { woman: "a white woman", man: "a white man", weight: 50 },
  { woman: "a Latina woman", man: "a Latino man", weight: 23 },
  { woman: "a Black woman", man: "a Black man", weight: 14 },
  { woman: "a multiracial woman", man: "a multiracial man", weight: 4 },
  { woman: "an East Asian woman", man: "an East Asian man", weight: 2.5 },
  { woman: "a South Asian woman", man: "a South Asian man", weight: 2 },
  { woman: "a Middle Eastern woman", man: "a Middle Eastern man", weight: 2 },
  { woman: "a Southeast Asian woman", man: "a Southeast Asian man", weight: 1.5 },
  { woman: "a Native American woman", man: "a Native American man", weight: 1 },
  { woman: "a Pacific Islander woman", man: "a Pacific Islander man", weight: 0.5 },
]);

const TOTAL_WEIGHT = US_BACKGROUNDS.reduce((sum, b) => sum + b.weight, 0);

/**
 * Standing rules every cast block carries, whatever the draw.
 * @type {ReadonlyArray<string>}
 */
const CASTING_RULES = Object.freeze([
  "Every section is mixed-gender: women play brass and percussion and conduct as drum major; men perform in color guard. Each listed performer takes whatever role the scene calls for — never swap a role to fit a gender or background.",
  "Cast the featured performers exactly as listed. Do not default to white men, and do not put every woman in color guard.",
  "Skin tones, facial features, and hair textures read clearly and naturally under the stadium light and any headwear; the uniform is identical on everyone.",
]);

/**
 * Clamp an RNG value into [0, 1) so a bad injected source can't index out.
 * @param {Rng} rng
 */
function roll(rng) {
  const r = Number(rng());
  return Number.isFinite(r) ? Math.min(Math.max(r, 0), 0.999999) : 0;
}

/**
 * Draw one performer: coin-flip gender, background weighted to US_BACKGROUNDS.
 * @param {Rng} [rng]
 * @returns {CastMember}
 */
function drawPerformer(rng = Math.random) {
  const woman = roll(rng) < 0.5;
  let pick = roll(rng) * TOTAL_WEIGHT;
  let background = US_BACKGROUNDS[US_BACKGROUNDS.length - 1];
  for (const b of US_BACKGROUNDS) {
    if (pick < b.weight) {
      background = b;
      break;
    }
    pick -= b.weight;
  }
  return { who: woman ? background.woman : background.man, woman };
}

/**
 * Draw the cast for one image: a lead plus `size - 1` companions, each drawn
 * independently.
 *
 * @param {number} [size] - featured performers in frame (1-3).
 * @param {Rng} [rng]
 * @returns {{ lead: CastMember, companions: CastMember[], womenTogether: boolean }}
 */
function dealCast(size = 1, rng = Math.random) {
  const count = Math.max(1, Math.min(3, Math.trunc(Number(size) || 1)));
  const lead = drawPerformer(rng);
  const companions = Array.from({ length: count - 1 }, () => drawPerformer(rng));
  const women = [lead, ...companions].filter(c => c.woman).length;
  return { lead, companions, womenTogether: women >= 2 };
}

/**
 * The CAST block appended to an image prompt.
 *
 * @param {object} [options]
 * @param {number} [options.size] - featured performers (1 = solo portrait).
 *   Defaults to 2.
 * @param {string} [options.historicalCorps] - a real corps name. Adds the
 *   all-male-era caveat so historical images stay accurate.
 * @param {Rng} [options.rng] - injectable for tests; Math.random otherwise.
 * @returns {string}
 */
function buildCastingBlock(options = {}) {
  const { lead, companions, womenTogether } = dealCast(options.size ?? 2, options.rng);

  const lines = [];
  if (companions.length === 0) {
    lines.push(`- FEATURED PERFORMER: ${lead.who}, in the role this scene gives them.`);
  } else {
    lines.push(`- LEAD (sharpest, most prominent): ${lead.who}, in the role this scene gives them.`);
    lines.push(`- ALONGSIDE THEM: ${companions.map(c => c.who).join(" and ")}.`);
    if (womenTogether) {
      lines.push(
        "- The women in frame are together in the moment — a shared glance, a word, a matched breath — not just sharing the frame."
      );
    }
    lines.push(
      "- Anyone else in frame, sharp or blurred, is a natural mix of women and men of varied backgrounds, like a real American corps."
    );
  }
  for (const rule of CASTING_RULES) lines.push(`- ${rule}`);
  if (options.historicalCorps) {
    lines.push(
      `- Historical accuracy wins: if ${options.historicalCorps} was an all-male corps in this season, keep each listed background but cast every performer as a man.`
    );
  }

  return `CAST — WHO IS IN THIS PICTURE:\n${lines.join("\n")}`;
}

module.exports = {
  US_BACKGROUNDS,
  CASTING_RULES,
  drawPerformer,
  dealCast,
  buildCastingBlock,
};
