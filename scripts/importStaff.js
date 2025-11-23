// scripts/importStaff.js
// Import DCI Hall of Fame members into Firestore staff_database

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// DCI Hall of Fame members organized by year and caption
// Caption categories:
// GE1 (General Effect 1) - Directors, Program Coordinators, Executives
// GE2 (General Effect 2) - Judges, Administrators, Broadcasters
// VP (Visual Performance) - Visual Designers, Drill Designers
// VA (Visual Analysis) - Visual Analysts, Choreographers
// CG (Color Guard) - Guard Designers & Instructors
// B (Brass) - Brass Arrangers & Instructors
// MA (Music Analysis) - Front Ensemble, Music Analysis
// P (Percussion) - Battery Instructors & Arrangers
const hallOfFameMembers = [
  // 2025
  { name: "Jack Bevins", yearInducted: 2025, caption: "GE1", role: "Director, Velvet Knights" },
  { name: "Matt Harloff", yearInducted: 2025, caption: "B", role: "Brass instructor, caption head" },
  { name: "Allan E. Kristensen", yearInducted: 2025, caption: "VA", role: "DCI adjudicator" },
  { name: "Jim Moore", yearInducted: 2025, caption: "CG", role: "Color guard designer & choreographer" },

  // 2024
  { name: "Scott Boerma", yearInducted: 2024, caption: "MA", role: "Brass arranger/composer" },
  { name: "Michael Duffy", yearInducted: 2024, caption: "B", role: "Brass arranger, instructor" },
  { name: "Gordon Henderson", yearInducted: 2024, caption: "B", role: "Brass arranger, instructor, program coordinator" },
  { name: "Jon Vanderkolff", yearInducted: 2024, caption: "VP", role: "Artistic director, visual designer" },

  // 2023
  { name: "Gino Cipriani", yearInducted: 2023, caption: "B", role: "Brass instructor, caption head" },
  { name: "David Glyde", yearInducted: 2023, caption: "MA", role: "Music director, composer/arranger" },

  // 2022
  { name: "Bret Kuhn", yearInducted: 2022, caption: "P", role: "Percussion caption head and arranger" },
  { name: "Gary Markham", yearInducted: 2022, caption: "VA", role: "Drum Corps International adjudicator" },
  { name: "Richard Saucedo", yearInducted: 2022, caption: "MA", role: "Composer/arranger" },

  // 2021
  { name: "Michael Boo", yearInducted: 2021, caption: "GE2", role: "Drum Corps International Staff Writer" },
  { name: "Jay Murphy", yearInducted: 2021, caption: "VP", role: "Visual Designer, Blue Devils" },

  // 2020
  { name: "Tony DiCarlo", yearInducted: 2020, caption: "GE2", role: "DCI Contest Director" },
  { name: "Harold \"Robby\" Robinson", yearInducted: 2020, caption: "GE1", role: "Crossmen Founding Director" },
  { name: "Sal Salas", yearInducted: 2020, caption: "CG", role: "Color Guard Designer, Program Coordinator" },

  // 2019
  { name: "John Meehan", yearInducted: 2019, caption: "B", role: "Brass instructor and arranger" },
  { name: "Bob Morrison", yearInducted: 2019, caption: "MA", role: "Front ensemble percussion arranger, music education advocate" },
  { name: "Douglas Thrower", yearInducted: 2019, caption: "B", role: "Brass instructor and arranger" },

  // 2018
  { name: "Jim Coates", yearInducted: 2018, caption: "GE1", role: "Executive Director, Carolina Crown" },
  { name: "Ken Turner", yearInducted: 2018, caption: "VA", role: "DCI Brass Caption Chair and Judge Administrator" },

  // 2017
  { name: "TJ Doucette", yearInducted: 2017, caption: "CG", role: "Color Guard Instructor, Blue Devils" },
  { name: "Paul Rennick", yearInducted: 2017, caption: "P", role: "Percussion Instructor, Arranger" },
  { name: "Bruno Zuccala", yearInducted: 2017, caption: "GE1", role: "Director/Assistant Director, Cavaliers" },

  // 2016
  { name: "Denise Bonfiglio", yearInducted: 2016, caption: "CG", role: "Color Guard Instructor, Staff Coordinator" },
  { name: "Frank Dorritie", yearInducted: 2016, caption: "MA", role: "Brass Instructor and Arranger, Audio Producer" },
  { name: "Dan Farrell", yearInducted: 2016, caption: "GE1", role: "Program Coordinator, Phantom Regiment" },
  { name: "Myron Rosander", yearInducted: 2016, caption: "VP", role: "Visual Designer, Santa Clara Vanguard" },

  // 2015
  { name: "Tom Blair", yearInducted: 2015, caption: "GE2", role: "Executive Producer, DCI World Championship Broadcasts" },
  { name: "Bill Harty", yearInducted: 2015, caption: "GE1", role: "Manager, Guardsmen Drum and Bugle Corps" },
  { name: "Scott Koter", yearInducted: 2015, caption: "GE1", role: "Program Coordinator, The Cavaliers" },
  { name: "John Phillips", yearInducted: 2015, caption: "VA", role: "DCI Judge Administrator" },
  { name: "Jeff Sacktig", yearInducted: 2015, caption: "VP", role: "Visual Design & Instructor, The Cadets" },

  // 2014
  { name: "Mark Arnold", yearInducted: 2014, caption: "GE1", role: "Executive Director, Blue Knights" },
  { name: "Bill Cook", yearInducted: 2014, caption: "GE1", role: "Founder, Star of Indiana" },
  { name: "Timothy Salzman", yearInducted: 2014, caption: "B", role: "Brass Arranger, Guardsmen, Santa Clara Vanguard, Cavaliers" },
  { name: "John Simpson", yearInducted: 2014, caption: "B", role: "Brass Instructor, Bridgemen, Sky Ryders, Star of Indiana" },
  { name: "Kevin Smith", yearInducted: 2014, caption: "GE1", role: "Founder, Carolina Crown" },

  // 2013
  { name: "Marie Grana-Czapinski", yearInducted: 2013, caption: "VA", role: "DCI Visual Adjudicator" },
  { name: "Bob Lendman", yearInducted: 2013, caption: "GE1", role: "Phantom Regiment Director 1976-1981" },
  { name: "Ray Mar", yearInducted: 2013, caption: "GE1", role: "Executive Director, Mandarins" },
  { name: "Steve Rondinaro", yearInducted: 2013, caption: "GE2", role: "DCI Broadcast Personality" },

  // 2012
  { name: "George Bevilacqua", yearInducted: 2012, caption: "GE1", role: "Boston Crusaders Director 1971-1980" },
  { name: "Marty Hurley", yearInducted: 2012, caption: "P", role: "Percussion instructor and music educator" },
  { name: "Scott Johnson", yearInducted: 2012, caption: "P", role: "Blue Devils percussion director and arranger 1994-present" },
  { name: "Michael Klesch", yearInducted: 2012, caption: "MA", role: "Brass arranger and composer" },
  { name: "Mel Stratton", yearInducted: 2012, caption: "VP", role: "Blue Devils visual instructor and designer 1970-1980" },

  // 2011
  { name: "Michael Gaines", yearInducted: 2011, caption: "CG", role: "Cavaliers visual designer 1998-2011" },
  { name: "Ken Norman", yearInducted: 2011, caption: "B", role: "Brass arranger and innovator" },
  { name: "Daniel Richardson", yearInducted: 2011, caption: "GE1", role: "Phantom Regiment program coordinator" },
  { name: "Todd Ryan", yearInducted: 2011, caption: "VP", role: "Visual caption head and marching instructor" },

  // 2010
  { name: "Raymond Baumgardt", yearInducted: 2010, caption: "MA", role: "Drum corps arranger" },
  { name: "Brandt Crocker", yearInducted: 2010, caption: "GE2", role: "Drum Corps International announcer since 1972" },
  { name: "Robert W. Smith", yearInducted: 2010, caption: "MA", role: "Composer, brass arranger for Suncoast Sound and various corps in the 1980s" },

  // 2009
  { name: "Jay Bocook", yearInducted: 2009, caption: "MA", role: "Longtime Cadets music arranger" },
  { name: "Richard Iannessa", yearInducted: 2009, caption: "VA", role: "Visual designer, innovator and judge" },
  { name: "Emil Pavlik", yearInducted: 2009, caption: "MA", role: "Music director and arranger, Kilties, 1950s and '60s" },
  { name: "Shirley Stratton Dorritie", yearInducted: 2009, caption: "CG", role: "Color guard educator, designer and consultant, Blue Devils and Santa Clara Vanguard" },
  { name: "Frank Williams", yearInducted: 2009, caption: "B", role: "Longtime brass instructor" },

  // 2008
  { name: "Dan Acheson", yearInducted: 2008, caption: "GE1", role: "Executive Director and CEO, Drum Corps International, 1995-present" },
  { name: "James Campbell", yearInducted: 2008, caption: "P", role: "Percussion arranger, instructor and innovator" },
  { name: "Rick Odello", yearInducted: 2008, caption: "GE1", role: "Director, Blue Devils B and Blue Devils C" },
  { name: "Greg Orwoll", yearInducted: 2008, caption: "GE1", role: "Executive Director, Colts, 1989-2012" },

  // 2007
  { name: "Howard Dahnert", yearInducted: 2007, caption: "GE1", role: "Racine Scouts director" },
  { name: "Jay Kennedy", yearInducted: 2007, caption: "VA", role: "Judge educator and musician" },
  { name: "Larry Kerchner", yearInducted: 2007, caption: "MA", role: "Arranger and instructor" },
  { name: "Steve Vickers", yearInducted: 2007, caption: "GE2", role: "Drum corps publisher" },

  // 2006
  { name: "Tom Aungst", yearInducted: 2006, caption: "P", role: "Percussion arranger and caption head" },
  { name: "Alfred Fabrizio", yearInducted: 2006, caption: "VA", role: "Instructor, arranger, adjudicator and show coordinator" },
  { name: "Freddy Martin", yearInducted: 2006, caption: "GE1", role: "Founder and director, Spirit of Atlanta 1976-1993" },
  { name: "Don Porter", yearInducted: 2006, caption: "GE1", role: "Director, Anaheim Kingsmen" },

  // 2005
  { name: "Dick Brown", yearInducted: 2005, caption: "VA", role: "Longtime arranger, instructor and judge with many different corps" },
  { name: "Jeff Fiedler", yearInducted: 2005, caption: "GE1", role: "Director of the Cavaliers 1990-2007; Santa Clara Vanguard CEO" },
  { name: "Peggy Twiggs", yearInducted: 2005, caption: "CG", role: "Groundbreaking color guard instructor with the 27th Lancers, Cadets" },

  // 2004
  { name: "Barry Bell", yearInducted: 2004, caption: "MA", role: "Musical director, designer, Toronto Optimists" },
  { name: "Scott Chandler", yearInducted: 2004, caption: "CG", role: "Instructor, Bridgemen, Spirit of Atlanta and the Cadets; program coordinator/choreographer, Blue Devils" },
  { name: "Tom Float", yearInducted: 2004, caption: "B", role: "Instructor for the Freelancers, Etobicoke-Oakland Crusaders, Spirit of Atlanta and Blue Devils" },
  { name: "Stephanie Lynde", yearInducted: 2004, caption: "CG", role: "Principal dance choreographer, Blue Devils, 1980s" },
  { name: "Donnie VanDoren", yearInducted: 2004, caption: "B", role: "Brass caption head for the Garfield Cadets, Star of Indiana" },

  // 2003
  { name: "Glenn Opie", yearInducted: 2003, caption: "GE1", role: "Charter member of DCI board of directors, director, Argonne Rebels, 1949-1973" },
  { name: "Len Piekarski", yearInducted: 2003, caption: "VP", role: "Visual instructor and designer, the Cavaliers, 1957-1968" },

  // 2002
  { name: "Clarence Beebe", yearInducted: 2002, caption: "GE1", role: "Founder and executive director, Madison Scouts, 1938-1967" },
  { name: "Sal Ferrera", yearInducted: 2002, caption: "MA", role: "Member, instructor, arranger, program director, the Cavaliers, 1953-1977" },
  { name: "David Gibbs", yearInducted: 2002, caption: "VP", role: "Member, instructor, designer, executive director, Blue Devils, 1974-present" },
  { name: "Moe Latour", yearInducted: 2002, caption: "GE1", role: "Member, instructor, tour manager, director, Blue Raeders, Blue Stars, Phantom Regiment, Star of Indiana, the Cadets" },
  { name: "Sie Lurye", yearInducted: 2002, caption: "GE1", role: "Founder and director, Royal Airs, 1958-1968" },

  // 2001
  { name: "Thom Hannum", yearInducted: 2001, caption: "P", role: "Percussion arranger, clinician and consultant" },
  { name: "Marc Sylvester", yearInducted: 2001, caption: "VP", role: "Visual designer and instructor, the Cadets, 1982-present" },
  { name: "James Wedge", yearInducted: 2001, caption: "B", role: "Brass arranger and instructor, 27th Lancers 1968-1982" },

  // 2000
  { name: "James Costello", yearInducted: 2000, caption: "GE1", role: "Founder of the Hawthorne Caballeros" },
  { name: "Adolph DeGrauwe", yearInducted: 2000, caption: "GE1", role: "Director of The Cavaliers 1979-1990" },
  { name: "Ralph Hardimon", yearInducted: 2000, caption: "P", role: "Percussion composer and arranger" },
  { name: "Larry McCormick", yearInducted: 2000, caption: "P", role: "Percussion instructor, arranger and innovator" },

  // 1999
  { name: "Gary Czapinski", yearInducted: 1999, caption: "VP", role: "Show consultant and designer" },
  { name: "Paul Litteau", yearInducted: 1999, caption: "VA", role: "Visual designer, instructor, judge and clinician" },
  { name: "Clarke Williams", yearInducted: 1999, caption: "VA", role: "DCI judge" },

  // 1998
  { name: "Charley Poole, Jr.", yearInducted: 1998, caption: "P", role: "Percussion arranger for the 27th Lancers, 1977-1986" },
  { name: "Gerry Shellmer", yearInducted: 1998, caption: "P", role: "Percussion arranger and instructor, 1950-1977" },
  { name: "Ernie Zimny", yearInducted: 1998, caption: "GE2", role: "Performer, instructor, judge, contest crew, and DCI office staff, 1931-1999" },

  // 1997
  { name: "James Elvord", yearInducted: 1997, caption: "B", role: "Brass arranger and instructor, DCI judge" },
  { name: "Michael Moxley", yearInducted: 1997, caption: "VP", role: "Visual instructor, designer and director, the Blue Devils, 1974-1990" },

  // 1996
  { name: "Michael Cesario", yearInducted: 1996, caption: "GE2", role: "Visual designer and consultant, DCI television broadcast commentator and consultant" },
  { name: "Jim Prime, Jr.", yearInducted: 1996, caption: "B", role: "Brass arranger and instructor" },
  { name: "Dave Richards", yearInducted: 1996, caption: "VA", role: "DCI Judge, 1972-1986" },

  // 1995
  { name: "Joe Marrella", yearInducted: 1995, caption: "MA", role: "Percussion arranger and consultant" },
  { name: "Sandra Opie", yearInducted: 1995, caption: "B", role: "Brass instructor for the Argonne Rebels, 1959-1973, DCI judge, 1973-1989" },
  { name: "Jim Ott", yearInducted: 1995, caption: "B", role: "Brass arranger for the Commodores, Blue Devils and Spirit of Atlanta" },

  // 1994
  { name: "John Brazale", yearInducted: 1994, caption: "VP", role: "Drill designer and instructor, Phantom Regiment, 1975-1992" },
  { name: "William Howard", yearInducted: 1994, caption: "GE1", role: "Charter member of the DCI Board of Directors, Director of the Madison Scouts, 1968-1976" },
  { name: "Jim Wren", yearInducted: 1994, caption: "B", role: "Phantom Regiment brass arranger" },

  // 1993
  { name: "Gene Monterastelli", yearInducted: 1993, caption: "VA", role: "Instructor and management with Troopers, 1966-1975, DCI judge, 1976 - present" },
  { name: "Jerry Seawright", yearInducted: 1993, caption: "GE1", role: "Founder and director of the Blue Devils, 1970-1984" },
  { name: "Scott Stewart", yearInducted: 1993, caption: "GE1", role: "Director of the Madison Scouts, 1977-2002" },

  // 1992
  { name: "Steve Brubaker", yearInducted: 1992, caption: "VP", role: "Visual designer and instructor, the Cavaliers, 1978-1992" },
  { name: "George Oliviero", yearInducted: 1992, caption: "VA", role: "DCI judge and judge educator" },
  { name: "Don Whiteley", yearInducted: 1992, caption: "GE2", role: "First DCI public relations director" },

  // 1991
  { name: "Roman Blenski", yearInducted: 1991, caption: "GE1", role: "Drum Corps Midwest executive director and former Division II & III coordinator" },
  { name: "Joe Colla", yearInducted: 1991, caption: "GE2", role: "Judging and DCI contest crew" },
  { name: "Truman Crawford", yearInducted: 1991, caption: "B", role: "Brass arranger and instructor" },
  { name: "Dennis DeLucia", yearInducted: 1991, caption: "P", role: "Percussion arranger and instructor" },
  { name: "Wayne Downey", yearInducted: 1991, caption: "B", role: "Brass arranger and instructor, Blue Devils, 1974-present" },
  { name: "Jack Meehan", yearInducted: 1991, caption: "B", role: "Brass instructor, Troopers, Blue Devils and Santa Clara Vanguard" },
  { name: "Ralph Pace", yearInducted: 1991, caption: "CG", role: "Visual designer and instructor, Blue Rock, 27th Lancers, Cavaliers and Spirit of Atlanta" },
  { name: "Fred Sanford", yearInducted: 1991, caption: "P", role: "Percussion arranger and instructor for the Santa Clara Vanguard, 1968-1980" },
  { name: "George Zingali", yearInducted: 1991, caption: "VP", role: "Visual designer and instructor, 27th Lancers, Garfield Cadets and Star of Indiana" },

  // 1990
  { name: "Rodney Goodhart", yearInducted: 1990, caption: "P", role: "Percussion judge and caption head of the DCI Task Force on Judging" },
  { name: "Bobby Hoffman", yearInducted: 1990, caption: "CG", role: "Visual designer and creator of the Bridgmen, Velvet Knights images" },
  { name: "Aram Kazazian", yearInducted: 1990, caption: "VA", role: "Visual and timing and penalty judge for DCI Championships in the 1970s and 1980s" },
  { name: "Robert Notaro", yearInducted: 1990, caption: "GE1", role: "A catalyst for DCI Division II & III corps in the 1980s" },
  { name: "Mary Pesceone", yearInducted: 1990, caption: "GE2", role: "DCI administrator" },

  // 1989
  { name: "Pete Emmons", yearInducted: 1989, caption: "VP", role: "Visual designer and instructor, Santa Clara Vanguard, 1968-1980" },
  { name: "Ken Kobold", yearInducted: 1989, caption: "GE2", role: "First DCI recording engineer; Created Championship records during the 1970s and 1980s" },
  { name: "Richard Maass", yearInducted: 1989, caption: "VA", role: "Visual judge and instructor; First DCI chief judge in 1972" },
  { name: "James Unrath", yearInducted: 1989, caption: "GE2", role: "Author of the original \"Blue Book\" of drum corps rules" },

  // 1988
  { name: "Bernard Baggs", yearInducted: 1988, caption: "VA", role: "DCI judge and executive board advisor" },
  { name: "Robert Briske", yearInducted: 1988, caption: "GE2", role: "DCI contest director, 1972-1994" },
  { name: "Earl Joyce", yearInducted: 1988, caption: "VA", role: "Father of modern judging; Influenced the development of a standard and uniform system of judging" },

  // 1987
  { name: "Robert Currie", yearInducted: 1987, caption: "P", role: "Percussion judge, 1958-1976" },

  // 1986
  { name: "Don Pesceone", yearInducted: 1986, caption: "GE1", role: "Executive director of DCI, 1973-1994" },
  { name: "Gail Royer", yearInducted: 1986, caption: "GE1", role: "Charter member of DCI Board of Directors; Founder and director of the Santa Clara Vanguard, 1967-1992" },

  // 1985
  { name: "Donald Angelica", yearInducted: 1985, caption: "VA", role: "Longtime DCI judges' administrator" },
  { name: "George Bonfiglio", yearInducted: 1985, caption: "GE1", role: "Charter member of DCI Board of Directors; Founder and director of the 27th Lancers" },
  { name: "Jim Jones", yearInducted: 1985, caption: "GE1", role: "Charter member of DCI Board of Directors; Founder and director of the Troopers for 30 years" },
  { name: "David Kampschroer", yearInducted: 1985, caption: "GE1", role: "First executive director of Western region for DCI; President of Blue Stars, 1968 – 1980" },
  { name: "Hugh Mahon", yearInducted: 1985, caption: "GE1", role: "First executive director of eastern region for DCI; Member, instructor and director, Garfield Cadets, 1955-1972" },
  { name: "Don Warren", yearInducted: 1985, caption: "GE1", role: "Charter member of DCI Board of Directors. Founder and director of the Cavaliers" }
];

// Calculate base value for each staff member based on induction year
// Older inductions = lower value, newer inductions = higher value
// Range: 100 (1985) to 1000 (2025)
function calculateBaseValue(yearInducted) {
  const minYear = 1985;
  const maxYear = 2025;
  const minValue = 100;
  const maxValue = 1000;

  const yearRange = maxYear - minYear;
  const valueRange = maxValue - minValue;
  const yearOffset = yearInducted - minYear;

  return Math.round(minValue + (yearOffset / yearRange) * valueRange);
}

// Generate biography text
function generateBiography(member) {
  return `${member.role}. Inducted into the DCI Hall of Fame in ${member.yearInducted}.`;
}

async function importStaff() {
  console.log('Starting staff import...');
  console.log(`Total members to import: ${hallOfFameMembers.length}`);

  let batch = db.batch();
  let batchCount = 0;
  let totalImported = 0;

  for (const member of hallOfFameMembers) {
    const staffId = member.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const staffRef = db.collection('staff_database').doc(staffId);

    const staffData = {
      name: member.name,
      caption: member.caption,
      yearInducted: member.yearInducted,
      biography: generateBiography(member),
      baseValue: calculateBaseValue(member.yearInducted),
      available: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    batch.set(staffRef, staffData);
    batchCount++;
    totalImported++;

    // Firestore batch limit is 500 operations
    if (batchCount >= 400) {
      console.log(`Committing batch of ${batchCount} staff members...`);
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining items
  if (batchCount > 0) {
    console.log(`Committing final batch of ${batchCount} staff members...`);
    await batch.commit();
  }

  console.log(`\n✅ Successfully imported ${totalImported} DCI Hall of Fame members!`);

  // Print caption distribution
  const captionCounts = {};
  hallOfFameMembers.forEach(member => {
    captionCounts[member.caption] = (captionCounts[member.caption] || 0) + 1;
  });

  console.log('\n📊 Caption Distribution:');
  Object.entries(captionCounts).sort((a, b) => b[1] - a[1]).forEach(([caption, count]) => {
    console.log(`  ${caption}: ${count} members`);
  });

  console.log('\n💰 Value Range:');
  console.log(`  1985: ${calculateBaseValue(1985)} CorpsCoin`);
  console.log(`  2025: ${calculateBaseValue(2025)} CorpsCoin`);
}

// Run the import
importStaff()
  .then(() => {
    console.log('\n✨ Import complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error importing staff:', error);
    process.exit(1);
  });
