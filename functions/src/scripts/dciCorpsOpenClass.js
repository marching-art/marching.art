/**
 * DCI Open Class corps reference data.
 *
 * Verified corps and show data from DCX Museum (dcxmuseum.org).
 * Last updated: January 2025
 *
 * Split out of seedDciReference.js so the seed script stays under the
 * max-lines lint budget. World Class corps live in dciCorpsWorldClass.js.
 */

const OPEN_CLASS_CORPS = {
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

module.exports = { OPEN_CLASS_CORPS };
