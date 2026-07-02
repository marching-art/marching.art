// Hardcoded DCI uniform knowledge base (fallback when Firestore data is
// unavailable). Extracted verbatim from newsUniforms.js.

// =============================================================================
// DCI UNIFORM KNOWLEDGE BASE
// Comprehensive uniform descriptions by corps and year for image generation
// Includes equipment details, helmet/shako styles, and section-specific elements
// =============================================================================

const DCI_UNIFORMS = {
  // ==========================================================================
  // WORLD CLASS - TOP 12 CORPS
  // ==========================================================================

  "Blue Devils": {
    default: {
      uniform: "navy blue military-style uniform with silver trim and white baldric",
      helmet: "silver shako with tall white horsehair plume",
      brass: "silver-plated King brass instruments with navy blue valve caps",
      percussion: "Pearl drums with navy blue shells, silver hardware, Zildjian cymbals",
      guard: "navy and silver unitards with flowing silver capes",
    },
    2014: {
      uniform: "classic navy blue with white chest baldric, silver braiding, polished brass buttons in double-breasted style",
      helmet: "traditional tall silver shako with blue and white ostrich plume",
      brass: "traditional silver brass instruments with white valve guards",
      percussion: "white Pearl drums with silver hardware, traditional concert bass drums",
      guard: "classical white and navy gowns, traditional rifle and sabre",
      showName: "Felliniesque",
    },
    2017: {
      uniform: "midnight blue with iridescent butterfly-wing patterns, metamorphosis theme with color-shifting fabric",
      helmet: "sleek chrome helmet with fiber optic butterfly antennae elements",
      brass: "silver brass with holographic blue finish on bells",
      percussion: "navy shells with morphing color graphics, LED-lit pit",
      guard: "iridescent blue costumes transforming through show, butterfly wing silks",
      showName: "Metamorph",
    },
    2018: {
      uniform: "deep midnight blue uniforms with metallic silver geometric accents, asymmetrical chest design with flowing navy capes",
      helmet: "chrome-finished helmet with fiber optic lighting elements and white plume",
      brass: "Dynasty brass with silver finish, illuminated bell covers during ballad",
      percussion: "Pearl Championship drums, navy shells with LED rim lighting",
      guard: "midnight blue with silver holographic fabric, 6-foot silk flags in navy and silver",
      showName: "Dreams and Nighthawks",
    },
    2019: {
      uniform: "navy blue with geometric silver angular patterns, modern athletic cut with metallic chest plate",
      helmet: "streamlined chrome visor helmet with blue LED accents",
      brass: "polished silver brass, contoured ergonomic grips",
      percussion: "transparent blue acrylic shells on snares, navy tenors",
      guard: "geometric silver and blue costumes, angular equipment in chrome",
      showName: "Ghostlight",
    },
    2023: {
      uniform: "deep navy with silver Art Deco geometric patterns, 1920s jazz age elegance",
      helmet: "chrome helmet with navy plume and Art Deco crest",
      brass: "silver brass with jazz-era styling, muted brass sections",
      percussion: "navy shells with silver geometric inlays, vintage-inspired pit setup",
      guard: "Art Deco navy and silver gowns, fan props and vintage silks",
      showName: "The Cut-Outs",
    },
  },

  "Carolina Crown": {
    default: {
      uniform: "deep maroon with ornate gold filigree chest plate, burgundy sash",
      helmet: "gold-trimmed shako with maroon and gold plume featuring crown emblem",
      brass: "gold-lacquered Yamaha brass with burgundy valve caps",
      percussion: "Mapex drums with wine-red shells, gold lugs, Sabian cymbals",
      guard: "flowing burgundy and gold Renaissance-inspired costumes",
    },
    2013: {
      uniform: "deep burgundy with elaborate gold filigree armor-style chest plate, Renaissance royalty aesthetic",
      helmet: "ornate gold crown-shaped headpiece with burgundy velvet accents",
      brass: "gold-lacquered brass with etched crown designs on bells",
      percussion: "burgundy drums with gold crown emblems, matching marimba frames",
      guard: "Renaissance court costumes in deep burgundy velvet with gold trim, ceremonial flags",
      showName: "E=MC²",
    },
    2015: {
      uniform: "fiery orange-red with gold flame patterns, inferno theme with heat-shimmer metallic fabric",
      helmet: "gold helmet with flame-shaped orange plume rising upward",
      brass: "gold brass with orange-red flame graphics on bells",
      percussion: "orange-red shells with gold fire graphics, flame-colored mallets",
      guard: "flame-inspired orange, red, and gold costumes with fire silks",
      showName: "Inferno",
    },
    2017: {
      uniform: "dark navy blue fitted modern uniform with sleek athletic cut, clean contemporary design",
      helmet: "no traditional shako, modern minimalist look with natural hair",
      brass: "silver brass instruments with clean contemporary appearance",
      percussion: "navy blue uniforms matching brass section, silver drum hardware",
      guard: "silver metallic fitted costumes with flowing elements, additional green costume pieces for visual contrast",
      showName: "It Is",
    },
    2019: {
      uniform: "maroon base with rose gold metallic overlay panels, modern athletic silhouette with illuminated crown logo",
      helmet: "rose gold metallic helmet with built-in LED crown halo",
      brass: "rose gold-finished brass with modern ergonomic design",
      percussion: "maroon shells with rose gold hardware, electronic trigger pads",
      guard: "rose gold and maroon athletic wear with flowing fabric extensions",
      showName: "Beneath the Surface",
    },
    2022: {
      uniform: "burgundy with cascading gold water-like patterns, reflective metallic threads",
      helmet: "gold helmet with flowing burgundy plume suggesting movement",
      brass: "gold brass with wave-pattern engravings",
      percussion: "burgundy shells with gold ripple graphics",
      guard: "flowing burgundy and gold costumes with water-themed movement silks",
      showName: "Right Here Right Now",
    },
  },

  "The Cadets": {
    default: {
      uniform: "classic maroon with cream trim, military precision with brass buttons",
      helmet: "tall maroon busby-style shako with cream plume",
      brass: "silver brass instruments with maroon valve guards, Cadets crest on bells",
      percussion: "Pearl drums with maroon shells, silver hardware",
      guard: "maroon and cream military-inspired uniforms with traditional equipment",
    },
    2005: {
      uniform: "maroon with black and silver geometric zones, avant-garde angular design",
      helmet: "angular maroon and silver helmet with geometric plume",
      brass: "silver brass with zone-inspired geometric graphics",
      percussion: "maroon drums with silver angular patterns",
      guard: "geometric maroon, black, and silver costumes with angular props",
      showName: "The Zone",
    },
    2011: {
      uniform: "burgundy with gold rope braiding across chest, Revolutionary War inspired double-breasted design",
      helmet: "tricorn-influenced shako in burgundy with gold trim and cream cockade",
      brass: "antiqued brass finish instruments evoking colonial era",
      percussion: "field drums styled after Revolutionary War with rope tension",
      guard: "colonial-era costumes with tricorn hats, period-accurate flags",
      showName: "Between Angels and Demons",
    },
    2015: {
      uniform: "black fitted uniform with white West Point-style military chest braiding, traditional frogging pattern design, thin white sash with silver buckle",
      helmet: "no traditional helmet, modern look with natural appearance",
      brass: "silver brass instruments contrasting against black uniforms",
      percussion: "black uniforms with white military braiding matching brass section",
      guard: "black base costumes with colorful flowing silks in yellow, purple, and pink",
      showName: "The Power of 10",
    },
    2023: {
      uniform: "deep maroon with copper metallic accents, steampunk-inspired gears and clockwork patterns",
      helmet: "copper-accented helmet with gear-shaped crest",
      brass: "copper-tinted brass with clockwork engravings",
      percussion: "maroon drums with copper gear graphics",
      guard: "steampunk-inspired maroon and copper costumes with gear props",
      showName: "Atlas Rising",
    },
  },

  "Santa Clara Vanguard": {
    default: {
      uniform: "scarlet red with white and gold trim, dramatic Spanish-influenced design with flowing capes",
      helmet: "traditional shako with tall red and white plume",
      brass: "gold-lacquered brass with red bell covers",
      percussion: "red Pearl drums with gold hardware, red-wrapped mallets",
      guard: "Spanish-inspired red and white costumes with dramatic capes and fans",
    },
    2014: {
      uniform: "rich jewel-toned red with gold Arabian patterns, Scheherazade-inspired flowing fabrics",
      helmet: "ornate gold headpiece with red jewels and flowing red plume",
      brass: "gold brass with Arabian geometric engravings",
      percussion: "red drums with gold Arabian patterns, Middle Eastern percussion accents",
      guard: "Arabian Nights-inspired red and gold costumes with veils and flowing silks",
      showName: "Scheherazade",
    },
    2018: {
      uniform: "cream ivory fitted bodysuit with distinctive V-shaped chest design, sleek modern athletic cut with subtle textured fabric",
      helmet: "no traditional helmet, clean modern look with natural hair or minimal headwear",
      brass: "silver brass instruments contrasting against cream uniforms",
      percussion: "cream ivory uniforms matching brass section, silver Pearl drums with chrome hardware",
      guard: "contrasting coral red fitted uniforms with modern athletic design, dramatic movement-focused costumes",
      showName: "Babylon",
    },
    2019: {
      uniform: "deep scarlet with revolutionary voice theme, dramatic transformation aesthetic",
      helmet: "gold and red headpiece with revolutionary imagery",
      brass: "gold brass with dramatic voice-inspired engravings",
      percussion: "red and gold drums with revolutionary imagery",
      guard: "revolutionary-inspired red and gold costumes with dramatic silks",
      showName: "Vox Eversio",
    },
  },

  "Bluecoats": {
    default: {
      uniform: "electric blue with white contemporary design, modern athletic cut",
      helmet: "chrome-finished modern helmet with blue accents",
      brass: "silver brass with blue LED accents during evening shows",
      percussion: "blue Mapex drums with chrome hardware, electronic integration",
      guard: "contemporary blue and white athletic wear with technology elements",
    },
    2014: {
      uniform: "traditional navy blue military-style uniform with white trim and accents, classic formal cut",
      helmet: "white shako with large fluffy white plume, traditional military style",
      brass: "silver brass instruments with traditional appearance",
      percussion: "navy blue uniforms matching brass section, white shako helmets with white plumes",
      guard: "bright orange fitted costumes, striking contrast against navy blue corps members",
      showName: "Tilt",
    },
    2016: {
      uniform: "electric blue with silver geometric circuit-board patterns, futuristic LED-integrated panels",
      helmet: "chrome visor helmet with programmable LED strip, no traditional plume",
      brass: "custom silver brass with blue LED rings around bells",
      percussion: "transparent blue acrylic drums with internal LED lighting",
      guard: "futuristic silver and blue bodysuits with fiber optic elements, LED props",
      showName: "Down Side Up",
    },
    2017: {
      uniform: "electric blue with white jagged patterns, rock concert-inspired modern athletic design",
      helmet: "chrome helmet with blue LED strip, concert-style headset mics",
      brass: "silver brass with blue electric bolt graphics",
      percussion: "blue drums with white lightning patterns, electronic integration",
      guard: "rock-inspired blue and white costumes with electric guitar props",
      showName: "Jagged Line",
    },
    2019: {
      uniform: "deep navy blue with silver thread patterns, vintage jazz club aesthetic",
      helmet: "vintage-style chrome helmet with blue accents",
      brass: "silver brass with vintage jazz styling",
      percussion: "navy drums with silver accents, jazz-era pit setup",
      guard: "1940s jazz club-inspired navy and silver costumes",
      showName: "The Bluecoats",
    },
    2022: {
      uniform: "electric blue with yellow warning stripe accents, industrial caution tape aesthetic",
      helmet: "yellow and blue industrial-style helmet",
      brass: "silver brass with blue and yellow caution graphics",
      percussion: "blue drums with yellow warning stripe patterns",
      guard: "industrial blue and yellow costumes with caution tape props",
      showName: "Riffs & Revelations",
    },
  },

  "Phantom Regiment": {
    default: {
      uniform: "deep maroon and black with dramatic theatrical design, flowing opera capes",
      helmet: "black and maroon shako with skull regiment insignia",
      brass: "dark lacquered brass with phantom skull bell engravings",
      percussion: "black drums with maroon accents, dramatic cymbal work",
      guard: "theatrical black and maroon costumes with phantom masks and capes",
    },
    2003: {
      uniform: "burgundy with gold harmonic wave patterns, orchestral elegance with flowing capes",
      helmet: "gold-trimmed black helmet with burgundy plume",
      brass: "gold brass with musical notation engravings",
      percussion: "burgundy drums with gold orchestral graphics",
      guard: "burgundy and gold orchestral costumes with conductor-inspired elements",
      showName: "Harmonic Journey",
    },
    2008: {
      uniform: "deep burgundy with black velvet trim, full-length opera capes with burgundy lining",
      helmet: "black helmet with Spartan-inspired crest and regiment skull emblem",
      brass: "dark nickel-finished brass with dramatic bell flares",
      percussion: "black shells with burgundy flame graphics, orchestral percussion",
      guard: "operatic burgundy and black costumes with dramatic masks",
      showName: "Spartacus",
    },
    2010: {
      uniform: "deep maroon with silver theatrical accents, Into the Light redemption theme",
      helmet: "silver and maroon helmet with light-ray crest",
      brass: "silver brass with ray-of-light engravings",
      percussion: "maroon drums with silver light-beam graphics",
      guard: "transitioning maroon to silver costumes suggesting emergence into light",
      showName: "Into the Light",
    },
    2023: {
      uniform: "black and burgundy with silver threads, modern theatrical athletic design",
      helmet: "black helmet with burgundy plume and silver skull crest",
      brass: "dark nickel brass with silver accents",
      percussion: "black drums with burgundy and silver graphics",
      guard: "contemporary theatrical black and burgundy costumes",
      showName: "Exogenesis",
    },
  },

  "Cavaliers": {
    default: {
      uniform: "hunter green with white trim, cavalier-inspired design with plumed hats",
      helmet: "classic cavalier hat with sweeping white plume",
      brass: "silver brass with green valve guards",
      percussion: "green Pearl drums with silver hardware",
      guard: "Three Musketeers inspired green and white costumes with rapiers",
    },
    2002: {
      uniform: "forest green military coat with white lapels and gold buttons, cavalier sash",
      helmet: "authentic cavalier hat with dramatic white ostrich plumes",
      brass: "polished silver brass with traditional French horn section",
      percussion: "traditional green drums with white heads, field drum heritage",
      guard: "cavalier-era costumes with capes, swords, and period flags",
      showName: "Frameworks",
    },
    2006: {
      uniform: "dark green with silver machine-like geometric patterns, mechanical precision design",
      helmet: "silver-green mechanical helmet with gear-like plume",
      brass: "chrome brass with machine-part engravings",
      percussion: "green drums with silver mechanical graphics, precise visual design",
      guard: "machine-inspired green and silver costumes with mechanical props",
      showName: "Machine",
    },
    2023: {
      uniform: "black fitted uniform with bright kelly green accents and panels, modern athletic design",
      helmet: "white helmet with white flowing plume, classic cavalier style",
      brass: "silver brass instruments with black and green uniform backdrop",
      percussion: "natural wood tan colored drums, black and green uniforms matching brass section",
      guard: "green and black modern costumes with flowing elements",
      showName: "...Where You'll Find Me",
    },
  },

  "Madison Scouts": {
    default: {
      uniform: "kelly green with gold trim, scout-inspired military design",
      helmet: "green shako with gold trim and green plume",
      brass: "gold-lacquered brass with scout emblem on bells",
      percussion: "green drums with gold hardware",
      guard: "green and gold military-inspired uniforms",
    },
    2013: {
      uniform: "deep green with shadowy black accents, mysterious dancing shadows theme",
      helmet: "black and green helmet with shadow-like plume",
      brass: "dark green lacquered brass with shadow graphics",
      percussion: "green drums with black shadow patterns",
      guard: "green and black shadow-inspired costumes with mysterious silks",
      showName: "Dancing Shadows",
    },
    2023: {
      uniform: "kelly green with gold modern accents, refreshed scout tradition design",
      helmet: "green helmet with gold trim and traditional plume",
      brass: "gold brass with scout emblem",
      percussion: "green drums with gold accents",
      guard: "green and gold contemporary scout costumes",
      showName: "The Return",
    },
    2024: {
      uniform: "dark forest green fitted uniform with gold yellow accents, modern athletic design with traditional elements",
      helmet: "black Aussie-style hat, classic Madison Scouts headwear",
      brass: "silver brass instruments",
      percussion: "green uniforms with gold accents matching brass section",
      guard: "colorful mosaic-inspired costumes with purple, pink, and multi-colored elements",
      showName: "Mosaic",
    },
  },

  "Boston Crusaders": {
    default: {
      uniform: "crimson red with colonial white and blue accents, Revolutionary War heritage",
      helmet: "tricorn-influenced design with red, white, and blue",
      brass: "silver brass with patriotic bell engravings",
      percussion: "red and white drums with Revolutionary field drum heritage",
      guard: "colonial-era inspired costumes with American Revolution flags",
    },
    2017: {
      uniform: "black with crimson red accents, Wicked Games dark theatrical design",
      helmet: "black helmet with red plume and wicked styling",
      brass: "dark lacquered brass with red accents",
      percussion: "black drums with crimson graphics",
      guard: "dark theatrical black and red costumes with dramatic props",
      showName: "Wicked Games",
    },
    2018: {
      uniform: "magenta purple fitted uniform with bright neon green accents, tropical island survival theme",
      helmet: "no traditional helmet, modern athletic look",
      brass: "silver brass instruments with magenta and green uniform backdrop",
      percussion: "magenta purple uniforms with green accents matching brass section",
      guard: "orange and tan tropical island-inspired costumes, beach survival aesthetic",
      showName: "S.O.S.",
    },
    2019: {
      uniform: "crimson red with gold accents, bold contemporary athletic design",
      helmet: "gold and red helmet with modern plume",
      brass: "gold brass with crimson accents",
      percussion: "red drums with gold hardware",
      guard: "crimson and gold contemporary athletic costumes",
      showName: "Goliath",
    },
    2022: {
      uniform: "crimson with purple and gold paradise-inspired patterns, tropical elegance",
      helmet: "gold helmet with crimson and purple plume",
      brass: "gold brass with paradise engravings",
      percussion: "crimson drums with tropical gold and purple graphics",
      guard: "paradise-inspired crimson, purple, and gold flowing costumes",
      showName: "Paradise Lost",
    },
  },

  "Blue Stars": {
    default: {
      uniform: "royal blue with cascading silver star patterns, patriotic elegance",
      helmet: "blue shako with silver star emblem and white plume",
      brass: "silver brass with star engravings on bells",
      percussion: "blue drums with silver star decals",
      guard: "celestial blue and silver costumes with star-themed silks",
    },
    2019: {
      uniform: "royal blue with silver celestial Romeo and Juliet star-crossed theme",
      helmet: "silver helmet with blue star accents and flowing plume",
      brass: "silver brass with star and moon engravings",
      percussion: "blue drums with silver star graphics",
      guard: "romantic blue and silver costumes with celestial silks",
      showName: "STAR Crossed",
    },
    2022: {
      uniform: "dark charcoal grey fitted uniform with purple magenta accents, modern athletic design",
      helmet: "no traditional helmet, modern minimalist look",
      brass: "silver brass instruments contrasting against grey and purple uniforms",
      percussion: "charcoal grey uniforms with purple accents matching brass section",
      guard: "colorful vibrant costumes with orange, blue, and multi-colored silks",
      showName: "Of War and Peace",
    },
    2023: {
      uniform: "royal blue with silver constellation patterns, updated celestial design",
      helmet: "blue helmet with silver star crest",
      brass: "silver brass with constellation engravings",
      percussion: "blue drums with silver star patterns",
      guard: "blue and silver celestial costumes",
      showName: "Beneath the Blue",
    },
  },

  "Mandarins": {
    default: {
      uniform: "crimson red with gold dragon embroidery, Asian-inspired flowing design",
      helmet: "ornate gold and red headpiece with dragon motifs",
      brass: "gold-lacquered brass with dragon engraving on bells",
      percussion: "red drums with gold dragon graphics, Asian percussion elements",
      guard: "flowing Asian-inspired crimson and gold costumes with fans and ribbons",
    },
    2019: {
      uniform: "crimson and gold with phoenix rising theme, dramatic transformation design",
      helmet: "gold phoenix-shaped headpiece with red plume",
      brass: "gold brass with phoenix engravings",
      percussion: "red drums with gold phoenix graphics",
      guard: "phoenix-inspired crimson and gold costumes with fire silks",
      showName: "Inside the Ink",
    },
    2022: {
      uniform: "crimson red with gold kintsugi-inspired golden crack patterns, beautiful imperfection theme",
      helmet: "gold and red helmet with kintsugi design",
      brass: "gold brass with golden crack patterns",
      percussion: "red drums with gold kintsugi graphics",
      guard: "crimson costumes with gold kintsugi accents and flowing silks",
      showName: "Kintsugi",
    },
    2023: {
      uniform: "all-red fitted modern uniform, sleek monochromatic athletic design",
      helmet: "red beret cap, modern minimalist headwear",
      brass: "silver brass instruments contrasting against all-red uniforms",
      percussion: "red drums with black accents, matching red uniforms",
      guard: "red fitted costumes matching corps aesthetic, dramatic angular props",
      showName: "Sinnerman",
    },
  },

  "Troopers": {
    default: {
      uniform: "tan and brown cavalry style, Western frontier with yellow trim",
      helmet: "cavalry campaign hat with crossed sabers insignia",
      brass: "traditional brass finish with Western engravings",
      percussion: "brown drums with cavalry yellow accents",
      guard: "cavalry uniforms with Western elements, American flags",
    },
    2023: {
      uniform: "tan with gold and brown Western accents, modern cavalry athletic design",
      helmet: "updated cavalry hat with gold trim",
      brass: "gold brass with cavalry engravings",
      percussion: "tan drums with gold cavalry graphics",
      guard: "modern cavalry tan and gold costumes",
      showName: "The Sky Is Not the Limit",
    },
    2025: {
      uniform: "rust burnt orange and black Western cavalry uniform, traditional frontier style with modern fit",
      helmet: "black cavalry cowboy hat with decorative band",
      brass: "silver brass instruments with rust and black uniform backdrop",
      percussion: "natural tan wood colored drums, rust orange and black uniforms matching brass section",
      guard: "yellow gold and white flowing costumes, sunset-inspired color palette",
      showName: "The Final Sunset",
    },
  },

  "Colts": {
    default: {
      uniform: "deep purple with silver accents, equestrian elegance",
      helmet: "purple shako with flowing silver mane-like plume",
      brass: "silver brass with purple valve caps and colt emblems",
      percussion: "purple drums with silver horse motifs",
      guard: "purple and silver costumes with flowing horse-mane elements",
    },
    2023: {
      uniform: "deep purple with silver modern accents, updated equestrian athletic design",
      helmet: "purple helmet with silver mane plume",
      brass: "silver brass with purple accents",
      percussion: "purple drums with silver horse graphics",
      guard: "purple and silver flowing costumes",
      showName: "Heartland",
    },
    2025: {
      uniform: "bold neon yellow lime green with red and black horizontal stripes, surreal dreamlike design",
      helmet: "no traditional helmet, modern look with colorful aesthetic",
      brass: "silver brass instruments contrasting against bright neon uniforms",
      percussion: "black drums, neon yellow and red striped uniforms matching brass section",
      guard: "pink fitted costumes, dreamlike surreal aesthetic contrasting with corps colors",
      showName: "In Restless Dreams",
    },
  },

  "Spirit of Atlanta": {
    default: {
      uniform: "scarlet red with white and black accents, phoenix and Southern heritage",
      helmet: "red shako with phoenix emblem and white plume",
      brass: "gold-lacquered brass with phoenix bell art",
      percussion: "red drums with flame graphics and phoenix imagery",
      guard: "phoenix-inspired red and orange costumes with flame silks",
    },
    2019: {
      uniform: "vibrant magenta pink fitted uniform with orange accents, neon underground aesthetic",
      helmet: "no traditional helmet, modern athletic look",
      brass: "silver brass instruments",
      percussion: "pink magenta drums matching corps uniform colors",
      guard: "neon pink and orange costumes with underground theme",
      showName: "Neon Underground",
    },
    2023: {
      uniform: "scarlet red with gold phoenix patterns, modern Southern pride design",
      helmet: "gold and red helmet with phoenix crest",
      brass: "gold brass with phoenix engravings",
      percussion: "red drums with gold phoenix graphics",
      guard: "red and gold phoenix costumes with fire silks",
      showName: "Coming Home",
    },
  },

  "Blue Knights": {
    default: {
      uniform: "royal blue with chrome armor plating, medieval knight aesthetic",
      helmet: "knight-style helmet with chrome visor and blue plume",
      brass: "chrome-finished brass with knight crest engravings",
      percussion: "blue drums with chrome hardware, shield graphics",
      guard: "medieval knight-inspired blue and silver armor costumes",
    },
    2018: {
      uniform: "purple and black horizontal striped fitted uniform, bold modern athletic design with teal accents",
      helmet: "no traditional helmet, modern minimalist look",
      brass: "silver brass instruments contrasting against purple striped uniforms",
      percussion: "natural wood tan colored drums, purple and black striped uniforms matching brass section",
      guard: "purple and black costumes with teal accent pieces",
      showName: "The Fall and Rise",
    },
    2022: {
      uniform: "royal blue with silver knight armor accents, modern crusader design",
      helmet: "chrome knight helmet with blue plume",
      brass: "chrome brass with shield engravings",
      percussion: "blue drums with silver shield graphics",
      guard: "knight-inspired blue and silver athletic costumes",
      showName: "The Count of Monte Cristo",
    },
  },

  "Crossmen": {
    default: {
      uniform: "royal blue with bold white cross patterns, modern design",
      helmet: "blue and white helmet with cross emblem",
      brass: "silver brass with blue accents",
      percussion: "blue and white drums with cross graphics",
      guard: "contemporary blue and white with cross motifs",
    },
    2023: {
      uniform: "royal blue with silver cross patterns, updated modern athletic design",
      helmet: "blue helmet with white cross crest",
      brass: "silver brass with cross engravings",
      percussion: "blue drums with white cross graphics",
      guard: "blue and white contemporary cross-themed costumes",
      showName: "The Grass Is Always Greener",
    },
  },

  "Pacific Crest": {
    default: {
      uniform: "ocean teal with white mountain peak imagery, Pacific Northwest",
      helmet: "teal helmet with silver mountain crest",
      brass: "silver brass with ocean wave engravings",
      percussion: "teal drums with white evergreen graphics",
      guard: "teal and white costumes with mountain and wave elements",
    },
    2023: {
      uniform: "teal with silver mountain and wave patterns, Pacific pride design",
      helmet: "silver and teal helmet with mountain crest",
      brass: "silver brass with wave engravings",
      percussion: "teal drums with silver mountain graphics",
      guard: "teal and silver Pacific-themed costumes",
      showName: "Wonder",
    },
  },

};

module.exports = { DCI_UNIFORMS };
