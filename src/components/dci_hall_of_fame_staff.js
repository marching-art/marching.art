// ===============================
// DCI HALL OF FAME STAFF TRADING SYSTEM
// Based on actual Hall of Fame inductees with VERIFIED specialties
// Each staff member appears only once to avoid confusion
// Prioritizing recent HOF inductees where appropriate
// ===============================

const DCI_HALL_OF_FAME_STAFF = {
  // ===============================
  // GENERAL EFFECT 1 (Visual Design & Innovation)
  // ===============================
  GE1: [
    {
      id: 'ge1_vanderkolff',
      name: 'Jon Vanderkolff',
      era: '2000s-2020s',
      specialty: 'Artistic Director & Visual Designer',
      hallOfFameYear: 2024,
      baseValue: 96,
      currentValue: 96,
      bio: 'Artistic director and visual designer known for innovative show concepts and visual storytelling.',
      corps: ['Various']
    },
    {
      id: 'ge1_murphy',
      name: 'Jay Murphy',
      era: '1990s-2020s',
      specialty: 'Visual Designer',
      hallOfFameYear: 2021,
      baseValue: 93,
      currentValue: 93,
      bio: 'Visual Designer for Blue Devils, master of contemporary visual innovation and design.',
      corps: ['Blue Devils']
    },
    {
      id: 'ge1_zingali',
      name: 'George Zingali',
      era: '1970s-2010s',
      specialty: 'Visual Designer & Instructor',
      hallOfFameYear: 1991,
      baseValue: 91,
      currentValue: 91,
      bio: 'Visual designer and instructor for 27th Lancers, Garfield Cadets and Star of Indiana.',
      corps: ['27th Lancers', 'Garfield Cadets', 'Star of Indiana']
    },
    {
      id: 'ge1_gaines',
      name: 'Michael Gaines',
      era: '1998-2011',
      specialty: 'Visual Designer',
      hallOfFameYear: 2011,
      baseValue: 89,
      currentValue: 89,
      bio: 'Cavaliers visual designer 1998-2011, known for innovative visual concepts.',
      corps: ['Cavaliers']
    },
    {
      id: 'ge1_cesario',
      name: 'Michael Cesario',
      era: '1980s-2000s',
      specialty: 'Visual Designer & Consultant',
      hallOfFameYear: 1996,
      baseValue: 86,
      currentValue: 86,
      bio: 'Visual designer and consultant, DCI television broadcast commentator.',
      corps: ['Various']
    }
  ],

  // ===============================
  // GENERAL EFFECT 2 (Musical Architecture & Integration)
  // ===============================
  GE2: [
    {
      id: 'ge2_saucedo',
      name: 'Richard Saucedo',
      era: '1990s-2020s',
      specialty: 'Composer & Arranger',
      hallOfFameYear: 2022,
      baseValue: 95,
      currentValue: 95,
      bio: 'Master composer and arranger known for contemporary musical excellence and innovation.',
      corps: ['Various']
    },
    {
      id: 'ge2_glyde',
      name: 'David Glyde',
      era: '1990s-2020s',
      specialty: 'Music Director & Composer/Arranger',
      hallOfFameYear: 2023,
      baseValue: 92,
      currentValue: 92,
      bio: 'Music director and composer/arranger with exceptional musical leadership and vision.',
      corps: ['Various']
    },
    {
      id: 'ge2_bocook',
      name: 'Jay Bocook',
      era: '1980s-2020s',
      specialty: 'Music Arranger',
      hallOfFameYear: 2009,
      baseValue: 89,
      currentValue: 89,
      bio: 'Longtime Cadets music arranger, master composer whose arrangements defined modern drum corps.',
      corps: ['The Cadets']
    },
    {
      id: 'ge2_smith',
      name: 'Robert W. Smith',
      era: '1980s-2000s',
      specialty: 'Composer & Brass Arranger',
      hallOfFameYear: 2010,
      baseValue: 87,
      currentValue: 87,
      bio: 'Composer and brass arranger for Suncoast Sound and various corps.',
      corps: ['Suncoast Sound', 'Various']
    },
    {
      id: 'ge2_klesch',
      name: 'Michael Klesch',
      era: '1990s-2010s',
      specialty: 'Brass Arranger & Composer',
      hallOfFameYear: 2012,
      baseValue: 84,
      currentValue: 84,
      bio: 'Brass arranger and composer known for musical innovation and excellence.',
      corps: ['Various']
    }
  ],

  // ===============================
  // VISUAL PERFORMANCE (Drill Design & Movement)
  // ===============================
  VP: [
    {
      id: 'vp_rosander',
      name: 'Myron Rosander',
      era: '1980s-2010s',
      specialty: 'Visual Designer',
      hallOfFameYear: 2016,
      baseValue: 94,
      currentValue: 94,
      bio: 'Visual Designer for Santa Clara Vanguard, master of drill design and visual performance.',
      corps: ['Santa Clara Vanguard']
    },
    {
      id: 'vp_brazale',
      name: 'John Brazale',
      era: '1975-1992',
      specialty: 'Drill Designer & Instructor',
      hallOfFameYear: 1994,
      baseValue: 91,
      currentValue: 91,
      bio: 'Drill designer and instructor for Phantom Regiment 1975-1992, master of precision drill.',
      corps: ['Phantom Regiment']
    },
    {
      id: 'vp_moxley',
      name: 'Michael Moxley',
      era: '1974-1990',
      specialty: 'Visual Instructor, Designer & Director',
      hallOfFameYear: 1997,
      baseValue: 88,
      currentValue: 88,
      bio: 'Visual instructor, designer and director for the Blue Devils 1974-1990.',
      corps: ['Blue Devils']
    },
    {
      id: 'vp_pace',
      name: 'Ralph Pace',
      era: '1970s-1990s',
      specialty: 'Visual Designer & Instructor',
      hallOfFameYear: 1991,
      baseValue: 85,
      currentValue: 85,
      bio: 'Visual designer and instructor for Blue Rock, 27th Lancers, Cavaliers and Spirit of Atlanta.',
      corps: ['Blue Rock', '27th Lancers', 'Cavaliers', 'Spirit of Atlanta']
    },
    {
      id: 'vp_litteau',
      name: 'Paul Litteau',
      era: '1980s-1990s',
      specialty: 'Visual Designer & Instructor',
      hallOfFameYear: 1999,
      baseValue: 82,
      currentValue: 82,
      bio: 'Visual designer, instructor, judge and clinician known for precision and excellence.',
      corps: ['Various']
    }
  ],

  // ===============================
  // VISUAL ANALYSIS (Performance Quality & Training)
  // ===============================
  VA: [
    {
      id: 'va_ryan',
      name: 'Todd Ryan',
      era: '1990s-2010s',
      specialty: 'Visual Caption Head & Marching Instructor',
      hallOfFameYear: 2011,
      baseValue: 93,
      currentValue: 93,
      bio: 'Visual caption head and marching instructor, expert in performance quality and analysis.',
      corps: ['Various']
    },
    {
      id: 'va_sacktig',
      name: 'Jeff Sacktig',
      era: '1990s-2010s',
      specialty: 'Visual Design & Instructor',
      hallOfFameYear: 2015,
      baseValue: 90,
      currentValue: 90,
      bio: 'Visual Design & Instructor for The Cadets, known for precision and performance standards.',
      corps: ['The Cadets']
    },
    {
      id: 'va_sylvester',
      name: 'Marc Sylvester',
      era: '1982-Present',
      specialty: 'Visual Designer & Instructor',
      hallOfFameYear: 2001,
      baseValue: 87,
      currentValue: 87,
      bio: 'Visual designer and instructor for the Cadets since 1982, consistency and excellence.',
      corps: ['The Cadets']
    },
    {
      id: 'va_stratton',
      name: 'Mel Stratton',
      era: '1970-1980',
      specialty: 'Visual Instructor & Designer',
      hallOfFameYear: 2012,
      baseValue: 84,
      currentValue: 84,
      bio: 'Blue Devils visual instructor and designer 1970-1980, foundation of excellence.',
      corps: ['Blue Devils']
    },
    {
      id: 'va_brubaker',
      name: 'Steve Brubaker',
      era: '1978-1992',
      specialty: 'Visual Designer & Instructor',
      hallOfFameYear: 1992,
      baseValue: 81,
      currentValue: 81,
      bio: 'Visual designer and instructor for the Cavaliers 1978-1992, precision and performance.',
      corps: ['The Cavaliers']
    }
  ],

  // ===============================
  // COLOR GUARD (Guard Innovation & Excellence)
  // ===============================
  CG: [
    {
      id: 'cg_moore',
      name: 'Jim Moore',
      era: '1990s-2020s',
      specialty: 'Color Guard Designer & Choreographer',
      hallOfFameYear: 2025,
      baseValue: 95,
      currentValue: 95,
      bio: 'Contemporary color guard designer and choreographer, master of modern guard innovation.',
      corps: ['Various']
    },
    {
      id: 'cg_salas',
      name: 'Sal Salas',
      era: '1990s-2020s',
      specialty: 'Color Guard Designer & Program Coordinator',
      hallOfFameYear: 2020,
      baseValue: 92,
      currentValue: 92,
      bio: 'Color Guard Designer and Program Coordinator, innovative guard concepts and leadership.',
      corps: ['Various']
    },
    {
      id: 'cg_doucette',
      name: 'TJ Doucette',
      era: '1990s-2010s',
      specialty: 'Color Guard Instructor',
      hallOfFameYear: 2017,
      baseValue: 89,
      currentValue: 89,
      bio: 'Color Guard Instructor for Blue Devils, excellence in guard instruction and innovation.',
      corps: ['Blue Devils']
    },
    {
      id: 'cg_bonfiglio',
      name: 'Denise Bonfiglio',
      era: '1990s-2010s',
      specialty: 'Color Guard Instructor & Staff Coordinator',
      hallOfFameYear: 2016,
      baseValue: 86,
      currentValue: 86,
      bio: 'Color Guard Instructor and Staff Coordinator, organizational excellence and guard leadership.',
      corps: ['Various']
    },
    {
      id: 'cg_twiggs',
      name: 'Peggy Twiggs',
      era: '1970s-1990s',
      specialty: 'Color Guard Instructor',
      hallOfFameYear: 2005,
      baseValue: 83,
      currentValue: 83,
      bio: 'Groundbreaking color guard instructor with the 27th Lancers and Cadets.',
      corps: ['27th Lancers', 'The Cadets']
    }
  ],

  // ===============================
  // BRASS (Musical Excellence & Innovation)
  // ===============================
  B: [
    {
      id: 'b_henderson',
      name: 'Gordon Henderson',
      era: '1990s-2020s',
      specialty: 'Brass Arranger, Instructor & Program Coordinator',
      hallOfFameYear: 2024,
      baseValue: 94,
      currentValue: 94,
      bio: 'Brass arranger, instructor, and program coordinator with comprehensive brass expertise.',
      corps: ['Various']
    },
    {
      id: 'b_cipriani',
      name: 'Gino Cipriani',
      era: '1990s-2020s',
      specialty: 'Brass Instructor & Caption Head',
      hallOfFameYear: 2023,
      baseValue: 91,
      currentValue: 91,
      bio: 'Brass instructor and caption head, dedicated to brass excellence and innovation.',
      corps: ['Various']
    },
    {
      id: 'b_thrower',
      name: 'Douglas Thrower',
      era: '1990s-2010s',
      specialty: 'Brass Instructor & Arranger',
      hallOfFameYear: 2019,
      baseValue: 88,
      currentValue: 88,
      bio: 'Brass instructor and arranger with expertise in brass performance and training.',
      corps: ['Various']
    },
    {
      id: 'b_meehan',
      name: 'John Meehan',
      era: '1990s-2010s',
      specialty: 'Brass Instructor & Arranger',
      hallOfFameYear: 2019,
      baseValue: 85,
      currentValue: 85,
      bio: 'Brass instructor and arranger known for excellence in brass instruction.',
      corps: ['Various']
    },
    {
      id: 'b_prime',
      name: 'Jim Prime, Jr.',
      era: '1970s-1990s',
      specialty: 'Brass Arranger & Instructor',
      hallOfFameYear: 1996,
      baseValue: 82,
      currentValue: 82,
      bio: 'Master brass arranger and instructor, legendary for brass excellence and innovation.',
      corps: ['Various']
    }
  ],

  // ===============================
  // MUSIC ANALYSIS (Musical Training & Education)
  // ===============================
  MA: [
    {
      id: 'ma_duffy',
      name: 'Michael Duffy',
      era: '1990s-2020s',
      specialty: 'Brass Arranger & Instructor',
      hallOfFameYear: 2024,
      baseValue: 92,
      currentValue: 92,
      bio: 'Brass arranger and instructor with focus on musical education and analysis.',
      corps: ['Various']
    },
    {
      id: 'ma_salzman',
      name: 'Timothy Salzman',
      era: '1980s-2010s',
      specialty: 'Brass Arranger',
      hallOfFameYear: 2014,
      baseValue: 89,
      currentValue: 89,
      bio: 'Brass Arranger for Guardsmen, Santa Clara Vanguard, and Cavaliers.',
      corps: ['Guardsmen', 'Santa Clara Vanguard', 'Cavaliers']
    },
    {
      id: 'ma_wren',
      name: 'Jim Wren',
      era: '1970s-1990s',
      specialty: 'Brass Arranger',
      hallOfFameYear: 1994,
      baseValue: 86,
      currentValue: 86,
      bio: 'Phantom Regiment brass arranger, master of musical analysis and arrangement.',
      corps: ['Phantom Regiment']
    },
    {
      id: 'ma_simpson',
      name: 'John Simpson',
      era: '1980s-1990s',
      specialty: 'Brass Instructor',
      hallOfFameYear: 2014,
      baseValue: 83,
      currentValue: 83,
      bio: 'Brass Instructor for Bridgemen, Sky Ryders, Star of Indiana, musical excellence.',
      corps: ['Bridgemen', 'Sky Ryders', 'Star of Indiana']
    },
    {
      id: 'ma_elvord',
      name: 'James Elvord',
      era: '1970s-1990s',
      specialty: 'Brass Arranger & Instructor',
      hallOfFameYear: 1997,
      baseValue: 80,
      currentValue: 80,
      bio: 'Brass arranger and instructor, DCI judge with deep musical knowledge.',
      corps: ['Various']
    }
  ],

  // ===============================
  // PERCUSSION (Rhythm & Innovation)
  // ===============================
  P: [
    {
      id: 'p_kuhn',
      name: 'Bret Kuhn',
      era: '1990s-2020s',
      specialty: 'Percussion Caption Head & Arranger',
      hallOfFameYear: 2022,
      baseValue: 96,
      currentValue: 96,
      bio: 'Percussion caption head and arranger, master of contemporary percussion innovation.',
      corps: ['Various']
    },
    {
      id: 'p_rennick',
      name: 'Paul Rennick',
      era: '1990s-2020s',
      specialty: 'Percussion Instructor & Arranger',
      hallOfFameYear: 2017,
      baseValue: 93,
      currentValue: 93,
      bio: 'Percussion Instructor and Arranger, master of contemporary percussion excellence.',
      corps: ['Various']
    },
    {
      id: 'p_aungst',
      name: 'Tom Aungst',
      era: '1990s-2010s',
      specialty: 'Percussion Arranger',
      hallOfFameYear: 2006,
      baseValue: 90,
      currentValue: 90,
      bio: 'Percussion arranger and innovator, master of contemporary percussion concepts.',
      corps: ['Various']
    },
    {
      id: 'p_morrison',
      name: 'Bob Morrison',
      era: '1990s-2010s',
      specialty: 'Front Ensemble Percussion Arranger',
      hallOfFameYear: 2019,
      baseValue: 87,
      currentValue: 87,
      bio: 'Front ensemble percussion arranger and music education advocate.',
      corps: ['Various']
    },
    {
      id: 'p_johnson',
      name: 'Scott Johnson',
      era: '1994-Present',
      specialty: 'Percussion Director & Arranger',
      hallOfFameYear: 2012,
      baseValue: 84,
      currentValue: 84,
      bio: 'Blue Devils percussion director and arranger 1994-present, consistency and innovation.',
      corps: ['Blue Devils']
    }
  ],

  // ===============================
  // VOLUNTEERS (Value based on seasons completed)
  // Special category for volunteer HOF members
  // Base value starts lower but grows faster with seasons
  // ===============================
  VOLUNTEERS: [
    {
      id: 'vol_bevins',
      name: 'Jack Bevins',
      era: '1970s-2000s',
      specialty: 'Director',
      hallOfFameYear: 2025,
      baseValue: 75,
      currentValue: 75,
      seasonsCompleted: 0,
      bio: 'Director of Velvet Knights, dedicated volunteer leadership and corps development.',
      corps: ['Velvet Knights'],
      valueMultiplier: 1.5
    },
    {
      id: 'vol_kristensen',
      name: 'Allan E. Kristensen',
      era: '1980s-2010s',
      specialty: 'DCI Adjudicator',
      hallOfFameYear: 2025,
      baseValue: 70,
      currentValue: 70,
      seasonsCompleted: 0,
      bio: 'DCI adjudicator, dedicated to fair and consistent judging standards.',
      corps: ['DCI'],
      valueMultiplier: 1.3
    },
    {
      id: 'vol_robinson',
      name: 'Harold "Robby" Robinson',
      era: '1970s-2000s',
      specialty: 'Founding Director',
      hallOfFameYear: 2020,
      baseValue: 80,
      currentValue: 80,
      seasonsCompleted: 0,
      bio: 'Crossmen Founding Director, visionary leadership and corps development.',
      corps: ['Crossmen'],
      valueMultiplier: 1.4
    },
    {
      id: 'vol_cook',
      name: 'Bill Cook',
      era: '1980s-1990s',
      specialty: 'Founder',
      hallOfFameYear: 2014,
      baseValue: 85,
      currentValue: 85,
      seasonsCompleted: 0,
      bio: 'Founder of Star of Indiana, revolutionary vision and innovation in drum corps.',
      corps: ['Star of Indiana'],
      valueMultiplier: 1.6
    },
    {
      id: 'vol_smith',
      name: 'Kevin Smith',
      era: '1990s-2010s',
      specialty: 'Founder',
      hallOfFameYear: 2014,
      baseValue: 82,
      currentValue: 82,
      seasonsCompleted: 0,
      bio: 'Founder of Carolina Crown, building excellence from the ground up.',
      corps: ['Carolina Crown'],
      valueMultiplier: 1.5
    }
  ]
};

// ===============================
// VOLUNTEER VALUE CALCULATION
// Volunteers gain value based on seasons completed
// ===============================
const calculateVolunteerValue = (volunteer) => {
  const baseValue = volunteer.baseValue;
  const seasonsBonus = volunteer.seasonsCompleted * 2 * volunteer.valueMultiplier;
  return Math.min(100, baseValue + seasonsBonus); // Cap at 100
};

module.exports = {
  DCI_HALL_OF_FAME_STAFF,
  calculateVolunteerValue
};