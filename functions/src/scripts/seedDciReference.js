/**
 * DCI Reference Data Seed Script
 *
 * Populates Firestore with verified DCI corps and show data from DCX Museum (dcxmuseum.org).
 * This data is used for accurate image generation in news articles.
 *
 * Usage:
 *   node seedDciReference.js
 *
 * Or via Firebase Functions shell:
 *   firebase functions:shell
 *   > require('./src/scripts/seedDciReference').seedDciReference()
 */

const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =============================================================================
// VERIFIED SHOW DATA FROM DCX MUSEUM (dcxmuseum.org)
// Last updated: January 2025
// =============================================================================

const DCI_CORPS_DATA = {
  // =========================================================================
  // WORLD CLASS - TOP TIER
  // =========================================================================

  "Blue Devils": {
    id: "blue-devils",
    location: "Concord, California",
    founded: 1957,
    colors: { primary: "navy blue", secondary: "white", accent: "silver" },
    defaultUniform: {
      uniform: "traditional navy blue coat with black pants, military-style design",
      helmet: "shako with white plume",
      brass: "silver King brass instruments",
      percussion: "Pearl drums with navy blue shells",
      guard: "show-specific costumes, often theatrical designs",
    },
    shows: {
      2013: { title: "The re:Rite of Spring" },
      2014: { title: "Felliniesque" },
      2015: { title: "Ink" },
      2016: { title: "As Dreams Are Made On" },
      2017: { title: "Metamorph" },
      2018: { title: "Dreams and Nighthawks" },
      2019: { title: "Ghostlight" },
      2021: { title: "Stockton Reflections" },
      2022: { title: "Tempus Blue" },
      2023: { title: "The Cut-Outs" },
      2024: { title: "The Romantics" },
      2025: { title: "Variations on a Gathering" },
    },
  },

  "Carolina Crown": {
    id: "carolina-crown",
    location: "Fort Mill, South Carolina",
    founded: 1988,
    colors: { primary: "purple", secondary: "cream", accent: "gold" },
    defaultUniform: {
      uniform: "distinctive vertical line design from head to toe, purple and cream with gold accents",
      helmet: "shako with plume featuring crown emblem",
      brass: "gold-lacquered Yamaha brass",
      percussion: "Mapex drums",
      guard: "show-specific costumes with signature vertical line element",
    },
    shows: {
      2013: { title: "E=mc²" },
      2014: { title: "Out of this World" },
      2015: { title: "Inferno" },
      2016: { title: "Relentless" },
      2017: {
        title: "IT IS",
        uniform: {
          uniform: "dark navy blue fitted modern uniform with sleek athletic cut",
          helmet: "no traditional shako, modern minimalist look",
          brass: "silver brass instruments",
          percussion: "navy blue uniforms matching brass section",
          guard: "silver metallic fitted costumes with green accent pieces",
        },
      },
      2018: { title: "Beast" },
      2019: { title: "Beneath the Surface" },
      2021: { title: "In My Mind" },
      2022: { title: "Right Here Right Now" },
      2023: { title: "The Round Table: Echoes of Camelot" },
      2024: { title: "Promethean" },
      2025: { title: "The Point of No Return" },
    },
  },

  "The Cadets": {
    id: "the-cadets",
    location: "Allentown, Pennsylvania",
    founded: 1934,
    colors: { primary: "maroon", secondary: "cream", accent: "gold" },
    defaultUniform: {
      uniform: "iconic maroon jacket with cream pants, gold cummerbund and drop sash",
      helmet: "maroon and white shako with silver eagle and white plume",
      brass: "silver brass instruments",
      percussion: "Pearl drums with maroon shells",
      guard: "maroon and cream traditional uniforms",
    },
    shows: {
      2013: { title: "Side by Side: The Music of Samuel Barber" },
      2014: { title: "Promise: An American Portrait" },
      2015: {
        title: "The Power of 10",
        uniform: {
          uniform: "black fitted uniform with white West Point-style military chest braiding, traditional frogging pattern, thin white sash with silver buckle",
          helmet: "no traditional helmet, modern look",
          brass: "silver brass instruments contrasting against black uniforms",
          percussion: "black uniforms with white military braiding",
          guard: "black base costumes with colorful flowing silks in yellow, purple, and pink",
        },
      },
      2016: { title: "Awakening" },
      2017: { title: "The Faithful, The Fallen, The Forgiven" },
      2018: { title: "The Unity Project" },
      2019: { title: "Behold!" },
      2021: { title: "Shall Always Be" },
      2022: { title: "Rearview Mirror" },
      2023: { title: "Atlas Rising" },
    },
    inactive: true,
    inactiveReason: "Not competing 2024-2025",
  },

  "Santa Clara Vanguard": {
    id: "santa-clara-vanguard",
    location: "Santa Clara, California",
    founded: 1967,
    colors: { primary: "red", secondary: "green", accent: "white" },
    defaultUniform: {
      uniform: "red tunic inspired by Canadian Mountie uniform, diagonal stripe from right shoulder to left hip",
      helmet: "green Aussie hat (pith helmet style) with gold/silver star emblem",
      brass: "silver brass instruments",
      percussion: "Pearl drums",
      guard: "show-specific costumes in red, green, and white",
    },
    shows: {
      2013: { title: "Les Miserables" },
      2014: { title: "Scheherazade: Words 2 Live By" },
      2015: { title: "The Spark of Invention" },
      2016: { title: "Force of Nature" },
      2017: { title: "Ouroboros" },
      2018: {
        title: "Babylon",
        uniform: {
          uniform: "cream ivory fitted bodysuit with distinctive V-shaped chest design, sleek modern athletic cut",
          helmet: "no traditional helmet, clean modern look",
          brass: "silver brass instruments contrasting against cream uniforms",
          percussion: "cream ivory uniforms matching brass section, silver Pearl drums",
          guard: "contrasting coral red fitted uniforms with modern athletic design",
        },
      },
      2019: { title: "Vox Eversio" },
      2022: { title: "Finding Nirvana" },
      2024: { title: "Vagabond" },
      2025: { title: "The aVANt GUARD" },
    },
  },

  "Bluecoats": {
    id: "bluecoats",
    location: "Canton, Ohio",
    founded: 1972,
    colors: { primary: "blue", secondary: "white", accent: "silver" },
    defaultUniform: {
      uniform: "contemporary design, often white base with blue accents, athletic modern cut",
      helmet: "varies by show - first corps to win DCI title without headgear (2016)",
      brass: "silver brass instruments",
      percussion: "Mapex drums",
      guard: "contemporary athletic costumes, innovative designs",
    },
    shows: {
      2013: { title: "...to look for America" },
      2014: {
        title: "Tilt",
        uniform: {
          uniform: "traditional navy blue military-style uniform with white trim and accents",
          helmet: "white shako with large fluffy white plume, traditional military style",
          brass: "silver brass instruments",
          percussion: "navy blue uniforms with white shakos and white plumes",
          guard: "bright orange fitted costumes, striking contrast against navy blue corps",
        },
      },
      2015: { title: "Kinetic Noise" },
      2016: { title: "Down Side Up" },
      2017: { title: "Jagged Line" },
      2018: { title: "Session 44" },
      2019: { title: "The Bluecoats" },
      2021: { title: "Lucy" },
      2022: { title: "Riffs & Revelations" },
      2023: { title: "The Garden of Love" },
      2024: { title: "Change Is Everything" },
      2025: { title: "The Observer Effect" },
    },
  },

  "Phantom Regiment": {
    id: "phantom-regiment",
    location: "Rockford, Illinois",
    founded: 1956,
    colors: { primary: "black", secondary: "white", accent: "red" },
    defaultUniform: {
      uniform: "black and white color scheme, often with red accents",
      helmet: "iconic pith helmet - signature headwear since 1970s",
      brass: "silver brass instruments",
      percussion: "drums with black/white scheme",
      guard: "theatrical costumes often in red, black, and white",
    },
    shows: {
      2013: { title: "Triumphant Journey" },
      2014: { title: "Swan Lake" },
      2015: { title: "City of Light" },
      2016: { title: "Voice of Promise" },
      2017: { title: "Phantasm" },
      2018: { title: "This New World" },
      2019: { title: "I Am Joan" },
      2021: { title: "Harmonic Journey" },
      2022: { title: "No Walk Too Far" },
      2023: { title: "Exogenesis" },
      2024: { title: "Mynd" },
      2025: { title: "Untitled" },
    },
  },

  "Cavaliers": {
    id: "cavaliers",
    location: "Rosemont, Illinois",
    founded: 1948,
    colors: { primary: "kelly green", secondary: "white", accent: "gold" },
    defaultUniform: {
      uniform: "kelly green musketeer/swashbuckler style - 'The Green Machine'",
      helmet: "feathered Aussie-style cavalier hat, incorporated into choreography",
      brass: "silver brass instruments",
      percussion: "green Pearl drums",
      guard: "green and white cavalier-inspired costumes",
    },
    shows: {
      2013: { title: "Secret Society" },
      2014: { title: "Immortal" },
      2015: { title: "Game On" },
      2016: { title: "Propaganda" },
      2017: { title: "Men are from Mars" },
      2018: { title: "On Madness and Creativity" },
      2019: { title: "The Wrong Side of the Tracks" },
      2021: { title: "LIVE! From The Rose" },
      2022: { title: "Signs of the Times" },
      2023: {
        title: "...Where You'll Find Me",
        uniform: {
          uniform: "black fitted uniform with bright kelly green accents and panels, modern athletic design",
          helmet: "white helmet with white flowing plume, classic cavalier style",
          brass: "silver brass instruments",
          percussion: "natural wood tan colored drums, black and green uniforms",
          guard: "green and black modern costumes with flowing elements",
        },
      },
      2024: { title: "Beneath the Armor" },
      2025: { title: "Shape|Shift" },
    },
  },

  // =========================================================================
  // WORLD CLASS - MID TIER
  // =========================================================================

  "Madison Scouts": {
    id: "madison-scouts",
    location: "Madison, Wisconsin",
    founded: 1938,
    colors: { primary: "green", secondary: "white", accent: "red" },
    defaultUniform: {
      uniform: "green and white with red accents, evolved from Boy Scout uniforms",
      helmet: "white Aussie hat - traditionally no plumes, fleur-de-lis symbol",
      brass: "silver brass instruments",
      percussion: "drums with green and white scheme",
      guard: "green, white, and red costumes",
    },
    shows: {
      2013: { title: "Corps of Brothers - 75 Years of Survival" },
      2014: { title: "Time Trip - The Music of Stan Kenton and Don Ellis" },
      2015: { title: "78th & Madison" },
      2016: { title: "Judas" },
      2017: { title: "The Last Man Standing" },
      2018: { title: "Heart & Soul" },
      2019: { title: "Majestic" },
      2021: { title: "Between The Lines" },
      2022: { title: "Installation 85" },
      2023: { title: "The Sound Garden" },
      2024: { title: "Mosaic" },
      2025: { title: "The Nature of Being" },
    },
  },

  "Boston Crusaders": {
    id: "boston-crusaders",
    location: "Boston, Massachusetts",
    founded: 1940,
    colors: { primary: "red", secondary: "black", accent: "white" },
    defaultUniform: {
      uniform: "red, black, and white - West Point inspired origins, now contemporary designs",
      helmet: "shako with plume, varies by show",
      brass: "silver brass instruments",
      percussion: "drums with corps colors",
      guard: "show-specific contemporary costumes",
    },
    shows: {
      2013: { title: "Rise" },
      2014: { title: "Animal Farm" },
      2015: { title: "Conquest" },
      2016: { title: "QUIXOTIC" },
      2017: { title: "Wicked Games" },
      2018: {
        title: "S.O.S.",
        uniform: {
          uniform: "magenta purple fitted uniform with bright neon green accents, tropical island survival theme",
          helmet: "no traditional helmet, modern athletic look",
          brass: "silver brass instruments",
          percussion: "magenta purple uniforms with green accents",
          guard: "orange and tan tropical island-inspired costumes, beach survival aesthetic",
        },
      },
      2019: { title: "Goliath" },
      2021: { title: "Zoom" },
      2022: { title: "Paradise Lost" },
      2023: { title: "The White Whale" },
      2024: { title: "Glitch" },
      2025: { title: "BOOM" },
    },
  },

  "Blue Stars": {
    id: "blue-stars",
    location: "La Crosse, Wisconsin",
    founded: 1964,
    colors: { primary: "navy blue", secondary: "white", accent: "silver" },
    defaultUniform: {
      uniform: "navy blue with white cross straps and silver buckle, North Star emblem",
      helmet: "pith helmet with red plume historically, now shako with white/red plume",
      brass: "silver brass instruments",
      percussion: "drums with blue and white scheme",
      guard: "show-specific costumes in corps colors",
    },
    shows: {
      2013: { title: "Voodoo: I Put a Spell on You" },
      2014: { title: "Where The Heart Is" },
      2015: { title: "Sideshow" },
      2016: { title: "Le Reve" },
      2017: { title: "Star Crossed" },
      2018: { title: "The Once and Future Carpenter" },
      2019: { title: "Call of the Wild" },
      2021: { title: "@ The Top of the World" },
      2022: {
        title: "Of War And Peace",
        uniform: {
          uniform: "dark charcoal grey fitted uniform with purple magenta accents, modern athletic design",
          helmet: "no traditional helmet, modern minimalist look",
          brass: "silver brass instruments",
          percussion: "charcoal grey uniforms with purple accents",
          guard: "colorful vibrant costumes with orange, blue, and multi-colored silks",
        },
      },
      2023: { title: "In ABSINTHEia" },
      2024: { title: "Universal" },
      2025: { title: "Spectator Sport" },
    },
  },

  "Mandarins": {
    id: "mandarins",
    location: "Sacramento, California",
    founded: 1963,
    colors: { primary: "red", secondary: "white", accent: "black" },
    defaultUniform: {
      uniform: "red and white, founded as Ye Wah Drum & Bugle Corps for Sacramento Chinese-American community",
      helmet: "shako or show-specific headwear",
      brass: "brass instruments",
      percussion: "drums with corps colors",
      guard: "show-specific costumes",
    },
    shows: {
      2013: { title: "DESTINATION AMERICA: Journey of the Paper Sons" },
      2014: { title: "UnbreakABLE: The Human Spirit is Limitless" },
      2015: { title: "Resurrection" },
      2016: { title: "Forbidden Forest" },
      2017: { title: "Inside the Ink" },
      2018: { title: "Life Rite After" },
      2019: { title: "Subterra" },
      2021: { title: "Beyond the Canvas" },
      2022: { title: "The Otherside" },
      2023: {
        title: "Sinnerman",
        uniform: {
          uniform: "all-red fitted modern uniform, sleek monochromatic athletic design",
          helmet: "red beret cap, modern minimalist headwear",
          brass: "silver brass instruments contrasting against all-red uniforms",
          percussion: "red drums with black accents, matching red uniforms",
          guard: "red fitted costumes matching corps aesthetic, dramatic angular props",
        },
      },
      2024: { title: "Vieux Carré" },
      2025: { title: "If I Must Fall..." },
    },
  },

  "Troopers": {
    id: "troopers",
    location: "Casper, Wyoming",
    founded: 1957,
    colors: { primary: "brown", secondary: "gold", accent: "military blue" },
    defaultUniform: {
      uniform: "cavalry-inspired browns and golds with military blues, based on 11th Ohio Cavalry uniforms",
      helmet: "cavalry campaign hat",
      brass: "brass instruments",
      percussion: "drums with corps colors",
      guard: "Western/cavalry themed costumes",
    },
    shows: {
      2013: { title: "Magnificent 11" },
      2014: { title: "A People's House" },
      2015: { title: "Wild Horses" },
      2016: { title: "hero" },
      2017: { title: "Duels and Duets" },
      2018: { title: "The New Road West" },
      2019: { title: "Beyond Boundaries" },
      2021: { title: "UNLEASHED" },
      2022: { title: "VorAcious" },
      2023: { title: "To Lasso the Sun" },
      2024: { title: "Dance with the Devil" },
      2025: {
        title: "The Final Sunset",
        uniform: {
          uniform: "rust burnt orange and black Western cavalry uniform, traditional frontier style with modern fit",
          helmet: "black cavalry cowboy hat with decorative band",
          brass: "silver brass instruments",
          percussion: "natural tan wood colored drums, rust orange and black uniforms",
          guard: "yellow gold and white flowing costumes, sunset-inspired color palette",
        },
      },
    },
  },

  "Colts": {
    id: "colts",
    location: "Dubuque, Iowa",
    founded: 1963,
    colors: { primary: "black", secondary: "red", accent: "white" },
    defaultUniform: {
      uniform: "black with red accents, distinctive triangle mirror on shako, from Dubuque, Iowa",
      helmet: "black shako with triangle mirror emblem",
      brass: "silver brass instruments",
      percussion: "drums with corps colors",
      guard: "show-specific costumes in corps colors",
    },
    shows: {
      2013: { title: "Field of Dreams" },
      2014: { title: "Dark Side of The Rainbow" },
      2015: { title: "...And A Shot Rings Out: A Johnny Staccato Murder Mystery" },
      2016: { title: "Nachtmusik" },
      2017: { title: "Both Sides Now" },
      2018: { title: "True Believer" },
      2019: { title: "When Hell Freezes Over" },
      2021: { title: "Leap of Faith" },
      2022: { title: "The Silk Road" },
      2023: { title: "Where The Heart Is" },
      2024: { title: "On Fields" },
      2025: {
        title: "In Restless Dreams",
        uniform: {
          uniform: "bold neon yellow lime green with red and black horizontal stripes, surreal dreamlike design",
          helmet: "no traditional helmet, modern look with colorful aesthetic",
          brass: "silver brass instruments contrasting against bright neon uniforms",
          percussion: "black drums, neon yellow and red striped uniforms",
          guard: "pink fitted costumes, dreamlike surreal aesthetic",
        },
      },
    },
  },

  "Spirit of Atlanta": {
    id: "spirit-of-atlanta",
    location: "Atlanta, Georgia",
    founded: 1976,
    colors: { primary: "navy blue", secondary: "cream", accent: "white" },
    defaultUniform: {
      uniform: "navy blue top with cream pants, Southern heritage, historically baby blue uniforms",
      helmet: "shako with plume",
      brass: "brass instruments",
      percussion: "drums with corps colors",
      guard: "show-specific costumes in corps colors",
    },
    shows: {
      2013: { title: "Speakeasy" },
      2014: { title: "Magnolia" },
      2015: { title: "Out of the Ashes" },
      2016: { title: "Georgia" },
      2017: { title: "CROSSROADS: We Are Here" },
      2018: { title: "Knock" },
      2019: { title: "Neon Underground" },
      2021: { title: "Legend of the Bottle Tree" },
      2023: { title: "Up, Down and All Around" },
      2024: { title: "Creatures" },
      2025: { title: "Rocket" },
    },
  },

  "Blue Knights": {
    id: "blue-knights",
    location: "Denver, Colorado",
    founded: 1958,
    colors: { primary: "navy blue", secondary: "white", accent: "silver" },
    defaultUniform: {
      uniform: "navy blue with signature 21-button triangle 'DOTS' pattern, knight-themed from Denver",
      helmet: "shako with plume",
      brass: "silver brass instruments",
      percussion: "drums with blue and white scheme",
      guard: "show-specific costumes in corps colors",
    },
    shows: {
      2013: { title: "NoBeginningNoEnd" },
      2014: { title: "That One Second" },
      2015: { title: "Because" },
      2016: { title: "The Great Event" },
      2017: { title: "i" },
      2018: {
        title: "The Fall and Rise",
        uniform: {
          uniform: "purple and black horizontal striped fitted uniform, bold modern athletic design with teal accents",
          helmet: "no traditional helmet, modern minimalist look",
          brass: "silver brass instruments contrasting against purple striped uniforms",
          percussion: "natural wood tan colored drums, purple and black striped uniforms",
          guard: "purple and black costumes with teal accent pieces",
        },
      },
      2019: { title: "...I Remember Everything" },
      2021: { title: "Always" },
      2022: { title: "Vibe" },
      2023: { title: "Unharnessed" },
      2024: { title: "BUSK" },
      2025: { title: "DRiP" },
    },
  },

  "Crossmen": {
    id: "crossmen",
    location: "San Antonio, Texas",
    founded: 1974,
    colors: { primary: "black", secondary: "red", accent: "white" },
    defaultUniform: {
      uniform: "black with red and white cross-pattern stripes, originally from suburban Philadelphia",
      helmet: "shako or show-specific headwear",
      brass: "silver brass instruments",
      percussion: "drums with corps colors",
      guard: "show-specific costumes in corps colors",
    },
    shows: {
      2013: { title: "Protest" },
      2014: { title: "Alma Gitana: A Gypsy Soul" },
      2015: { title: "Above and Beyond" },
      2016: { title: "Continuum" },
      2017: { title: "Enigma" },
      2018: { title: "The In-Between" },
      2019: { title: "Valkyrie" },
      2021: { title: "Your Move" },
      2022: { title: "A Mobius Trip" },
      2023: { title: "Meetings at the Edge" },
      2024: { title: "Lush Life" },
      2025: { title: "CROSSWALKing" },
    },
  },

  "Pacific Crest": {
    id: "pacific-crest",
    location: "Diamond Bar, California",
    founded: 1993,
    colors: { primary: "black", secondary: "teal", accent: "white" },
    defaultUniform: {
      uniform: "black base with white and teal accents, athletic fit, Southern California corps",
      helmet: "black shako with white and teal accents and white plume",
      brass: "silver brass instruments",
      percussion: "drums with corps colors",
      guard: "show-specific costumes in corps colors",
    },
    shows: {
      2013: { title: "Transfixed" },
      2014: { title: "No Strings Attached ..." },
      2015: { title: "The Catalyst" },
      2016: { title: "The Union" },
      2017: { title: "Golden State of Mind" },
      2018: { title: "Here's to the Ones Who Dream" },
      2019: { title: "Everglow" },
      2021: { title: "eX" },
      2022: { title: "Welcome to the V-O-I-D" },
      2023: { title: "Goddess" },
      2024: { title: "The Broken Column" },
      2025: { title: "It Sin Our Nature" },
    },
  },

  // =========================================================================
  // WORLD CLASS - NEWER/TRANSITIONING
  // =========================================================================

  "The Academy": {
    id: "the-academy",
    location: "Tempe, Arizona",
    founded: 2001,
    colors: { primary: "black", secondary: "red", accent: "white" },
    defaultUniform: {
      uniform: "black with red accents, large 'A' logo on back, Arizona-based corps",
      helmet: "shako or show-specific headwear",
      brass: "silver brass instruments",
      percussion: "drums with black and red scheme",
      guard: "show-specific costumes in corps colors",
    },
    shows: {
      2013: { title: "Piano Man" },
      2014: { title: "Vanity Fair" },
      2015: { title: "A Step in Time" },
      2016: { title: "Drum Corpse Bride" },
      2017: { title: "By a Hare" },
      2018: { title: "Academic" },
      2019: { title: "The Bridge Between" },
      2021: { title: "Exposed" },
      2022: { title: "A World of My Creation" },
      2023: { title: "Sol Et Luna: Until Our Next Eclipse" },
      2024: { title: "When Opportunity Knocks" },
      2025: { title: "London Fog" },
    },
  },

  "Genesis": {
    id: "genesis",
    location: "Austin, Texas",
    founded: 2009,
    colors: { primary: "orange", secondary: "black", accent: "white" },
    defaultUniform: {
      uniform: "orange and black, Texas-based corps from Austin",
      helmet: "shako or show-specific headwear",
      brass: "silver brass instruments",
      percussion: "drums with orange and black scheme",
      guard: "show-specific costumes in corps colors",
    },
    shows: {
      2013: { title: "mOZaic" },
      2014: { title: "Art of Darkness" },
      2015: { title: "Phantom Revisited" },
      2016: { title: "Hell Hath No Fury..." },
      2017: { title: "The Other Side of Now" },
      2018: { title: "RetroVertigo" },
      2019: { title: "From the Ground Up" },
      2021: { title: "There's No Place Like Home" },
      2022: { title: "Dorothy" },
      2023: { title: "SYMBIO.SYS" },
      2024: { title: "Signal" },
      2025: { title: "Kaleidoscope Heart" },
    },
  },

  "Music City": {
    id: "music-city",
    location: "Nashville, Tennessee",
    founded: 2008,
    colors: { primary: "purple", secondary: "gold", accent: "white" },
    defaultUniform: {
      uniform: "purple and gold, Nashville-based corps representing Music City",
      helmet: "shako or show-specific headwear",
      brass: "brass instruments",
      percussion: "drums with purple and gold scheme",
      guard: "show-specific costumes in corps colors",
    },
    shows: {
      2013: { title: "Postcards from Havana" },
      2014: { title: "Go West!" },
      2015: { title: "In the Stars" },
      2016: { title: "Coronation" },
      2017: { title: "Tribe" },
      2018: { title: "Hell on Wheels: The Final Journey of Casey Jones" },
      2019: { title: "Of Mice & Music" },
      2021: { title: "Circuloso" },
      2022: { title: "Gasoline Rainbows" },
      2023: { title: "Violent Delights: A Rose and its Thorns" },
      2024: { title: "Leave It At The River" },
      2025: { title: "It Tolls for Thee" },
    },
  },

  "Seattle Cascades": {
    id: "seattle-cascades",
    location: "Seattle, Washington",
    founded: 1976,
    colors: { primary: "green", secondary: "white", accent: "silver" },
    defaultUniform: {
      uniform: "green and white, Pacific Northwest corps from Seattle",
      helmet: "shako or show-specific headwear",
      brass: "silver brass instruments",
      percussion: "drums with green and white scheme",
      guard: "show-specific costumes in corps colors",
    },
    shows: {
      2013: { title: "Inescapable" },
      2014: { title: "Turn" },
      2015: { title: "Intergalactic" },
      2016: { title: "O" },
      2017: { title: "Set Free" },
      2018: { title: "What Goes Around" },
      2019: { title: "Off the Grid" },
      2023: { title: "Revival" },
      2024: { title: "Sky Above Home Was Always Waiting For You" },
      2025: { title: "Primary" },
    },
  },

  "Spartans": {
    id: "spartans",
    location: "Nashua, New Hampshire",
    founded: 1955,
    colors: { primary: "black", secondary: "red", accent: "gold" },
    defaultUniform: {
      uniform: "black, red, and gold, Spartan-themed New England corps",
      helmet: "distinctive Spartan helmet design",
      brass: "brass instruments",
      percussion: "drums with corps colors",
      guard: "show-specific costumes in corps colors",
    },
    shows: {
      2013: { title: "Live Free" },
      2014: { title: "Olympus" },
      2015: { title: "Spartans... At The Gates!" },
      2016: { title: "Totem" },
      2017: { title: "Connected" },
      2018: { title: "Da Vinci's Workshop" },
      2019: { title: "Experiment X" },
      2022: { title: "On The Edge" },
      2023: { title: "Surreal" },
      2024: { title: "Youtopia" },
      2025: { title: "Mistica" },
    },
  },
};

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

/**
 * Seeds the Firestore database with DCI reference data.
 * Creates/updates:
 * - dci-reference/corps - All corps metadata
 * - dci-reference/shows-{corpsId} - Shows by corps (hyphenated for valid doc path)
 */
async function seedDciReference() {
  console.log("Starting DCI reference data seed...\n");

  const batch = db.batch();
  const corpsRef = db.doc("dci-reference/corps");
  const corpsIndex = {};

  // Process each corps
  for (const [corpsName, corpsData] of Object.entries(DCI_CORPS_DATA)) {
    const { shows, ...corpsMeta } = corpsData;
    corpsIndex[corpsData.id] = {
      name: corpsName,
      ...corpsMeta,
    };

    // Write shows document for this corps (using shows-{id} format for valid doc path)
    if (shows && Object.keys(shows).length > 0) {
      const showsRef = db.doc(`dci-reference/shows-${corpsData.id}`);
      batch.set(showsRef, {
        corpsName,
        shows,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  Prepared shows for ${corpsName} (${Object.keys(shows).length} shows)`);
    }
  }

  // Write corps index
  batch.set(corpsRef, {
    corps: corpsIndex,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "DCX Museum (dcxmuseum.org)",
    lastVerified: "2025-01",
  });
  console.log(`\nPrepared corps index with ${Object.keys(corpsIndex).length} corps`);

  // Commit all writes
  await batch.commit();
  console.log("\nDCI reference data seed completed successfully!");

  return {
    success: true,
    corpsCount: Object.keys(corpsIndex).length,
    showsCount: Object.values(DCI_CORPS_DATA).reduce(
      (acc, corps) => acc + Object.keys(corps.shows || {}).length,
      0
    ),
  };
}

/**
 * Reads corps data from Firestore.
 */
async function getCorpsData(corpsId) {
  const corpsDoc = await db.doc("dci-reference/corps").get();
  if (!corpsDoc.exists) return null;

  const data = corpsDoc.data();
  return data.corps?.[corpsId] || null;
}

/**
 * Reads show data for a specific corps and year.
 */
async function getShowData(corpsId, year) {
  const showsDoc = await db.doc(`dci-reference/shows-${corpsId}`).get();
  if (!showsDoc.exists) return null;

  const data = showsDoc.data();
  return data.shows?.[year] || null;
}

/**
 * Gets uniform description for a corps, optionally with year-specific details.
 */
async function getUniformForCorps(corpsName, year = null) {
  const corpsDoc = await db.doc("dci-reference/corps").get();
  if (!corpsDoc.exists) return null;

  const data = corpsDoc.data();
  const corpsEntry = Object.values(data.corps || {}).find(c => c.name === corpsName);

  if (!corpsEntry) return null;

  const uniform = corpsEntry.defaultUniform;

  // If year specified, get show title
  if (year) {
    const showsDoc = await db.doc(`dci-reference/shows-${corpsEntry.id}`).get();
    if (showsDoc.exists) {
      const showData = showsDoc.data().shows?.[year];
      if (showData) {
        return { ...uniform, showTitle: showData.title, year };
      }
    }
  }

  return uniform;
}

module.exports = {
  seedDciReference,
  getCorpsData,
  getShowData,
  getUniformForCorps,
  DCI_CORPS_DATA,
};

// Allow running directly: node seedDciReference.js
if (require.main === module) {
  seedDciReference()
    .then(result => {
      console.log("\nResult:", result);
      process.exit(0);
    })
    .catch(err => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
