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
// Caption categories: GE (General Effect), Visual (VP, VA, CG), Brass (B), Percussion (MA, P)
const hallOfFameMembers = [
  // 2025
  { name: "Jack Bevins", yearInducted: 2025, caption: "GE1", role: "Director, Velvet Knights" },
  { name: "Matt Harloff", yearInducted: 2025, caption: "B", role: "Brass instructor, caption head" },
  { name: "Allan E. Kristensen", yearInducted: 2025, caption: "GE2", role: "DCI adjudicator" },
  { name: "Jim Moore", yearInducted: 2025, caption: "CG", role: "Color guard designer & choreographer" },

  // 2024
  { name: "Scott Boerma", yearInducted: 2024, caption: "B", role: "Brass arranger/composer" },
  { name: "Michael Duffy", yearInducted: 2024, caption: "B", role: "Brass arranger, instructor" },
  { name: "Gordon Henderson", yearInducted: 2024, caption: "B", role: "Brass arranger, instructor, program coordinator" },
  { name: "Jon Vanderkolff", yearInducted: 2024, caption: "VP", role: "Artistic director, visual designer" },

  // 2023
  { name: "Gino Cipriani", yearInducted: 2023, caption: "B", role: "Brass instructor, caption head" },
  { name: "David Glyde", yearInducted: 2023, caption: "B", role: "Music director, composer/arranger" },

  // 2022
  { name: "Bret Kuhn", yearInducted: 2022, caption: "P", role: "Percussion caption head and arranger" },
  { name: "Gary Markham", yearInducted: 2022, caption: "GE2", role: "Drum Corps International adjudicator" },
  { name: "Richard Saucedo", yearInducted: 2022, caption: "B", role: "Composer/arranger" },

  // 2021
  { name: "Michael Boo", yearInducted: 2021, caption: "GE1", role: "Drum Corps International Staff Writer" },
  { name: "Jay Murphy", yearInducted: 2021, caption: "VP", role: "Visual Designer, Blue Devils" },

  // 2020
  { name: "Tony DiCarlo", yearInducted: 2020, caption: "GE2", role: "DCI Contest Director" },
  { name: "Harold \"Robby\" Robinson", yearInducted: 2020, caption: "GE1", role: "Crossmen Founding Director" },
  { name: "Sal Salas", yearInducted: 2020, caption: "CG", role: "Color Guard Designer, Program Coordinator" },

  // 2019
  { name: "John Meehan", yearInducted: 2019, caption: "B", role: "Brass instructor and arranger" },
  { name: "Bob Morrison", yearInducted: 2019, caption: "MA", role: "Front ensemble percussion arranger" },
  { name: "Douglas Thrower", yearInducted: 2019, caption: "B", role: "Brass instructor and arranger" },

  // 2018
  { name: "Jim Coates", yearInducted: 2018, caption: "GE1", role: "Executive Director, Carolina Crown" },
  { name: "Ken Turner", yearInducted: 2018, caption: "B", role: "DCI Brass Caption Chair and Judge Administrator" },

  // 2017
  { name: "TJ Doucette", yearInducted: 2017, caption: "CG", role: "Color Guard Instructor, Blue Devils" },
  { name: "Paul Rennick", yearInducted: 2017, caption: "P", role: "Percussion Instructor, Arranger" },
  { name: "Bruno Zuccala", yearInducted: 2017, caption: "GE1", role: "Director/Assistant Director, Cavaliers" },

  // 2016
  { name: "Denise Bonfiglio", yearInducted: 2016, caption: "CG", role: "Color Guard Instructor, Staff Coordinator" },
  { name: "Frank Dorritie", yearInducted: 2016, caption: "B", role: "Brass Instructor and Arranger, Audio Producer" },
  { name: "Dan Farrell", yearInducted: 2016, caption: "GE1", role: "Program Coordinator, Phantom Regiment" },
  { name: "Myron Rosander", yearInducted: 2016, caption: "VP", role: "Visual Designer, Santa Clara Vanguard" },

  // 2015
  { name: "Tom Blair", yearInducted: 2015, caption: "GE2", role: "Executive Producer, DCI World Championship Broadcasts" },
  { name: "Bill Harty", yearInducted: 2015, caption: "GE1", role: "Manager, Guardsmen Drum and Bugle Corps" },
  { name: "Scott Koter", yearInducted: 2015, caption: "GE1", role: "Program Coordinator, The Cavaliers" },
  { name: "John Phillips", yearInducted: 2015, caption: "GE2", role: "DCI Judge Administrator" },
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
  { name: "Scott Johnson", yearInducted: 2012, caption: "P", role: "Blue Devils percussion director and arranger" },
  { name: "Michael Klesch", yearInducted: 2012, caption: "B", role: "Brass arranger and composer" },
  { name: "Mel Stratton", yearInducted: 2012, caption: "VP", role: "Blue Devils visual instructor and designer 1970-1980" },

  // 2011
  { name: "Michael Gaines", yearInducted: 2011, caption: "VP", role: "Cavaliers visual designer 1998-2011" },
  { name: "Ken Norman", yearInducted: 2011, caption: "B", role: "Brass arranger and innovator" },
  { name: "Daniel Richardson", yearInducted: 2011, caption: "GE1", role: "Phantom Regiment program coordinator" },
  { name: "Todd Ryan", yearInducted: 2011, caption: "VP", role: "Visual caption head and marching instructor" },

  // 2010
  { name: "Raymond Baumgardt", yearInducted: 2010, caption: "B", role: "Drum corps arranger" },
  { name: "Brandt Crocker", yearInducted: 2010, caption: "GE2", role: "Drum Corps International announcer since 1972" },
  { name: "Robert W. Smith", yearInducted: 2010, caption: "B", role: "Composer, brass arranger" },

  // 2009
  { name: "Jay Bocook", yearInducted: 2009, caption: "B", role: "Longtime Cadets music arranger" },
  { name: "Richard Iannessa", yearInducted: 2009, caption: "VP", role: "Visual designer, innovator and judge" },
  { name: "Emil Pavlik", yearInducted: 2009, caption: "B", role: "Music director and arranger, Kilties" },
  { name: "Shirley Stratton Dorritie", yearInducted: 2009, caption: "CG", role: "Color guard educator, Blue Devils and Santa Clara Vanguard" },
  { name: "Frank Williams", yearInducted: 2009, caption: "B", role: "Longtime brass instructor" },

  // 2008
  { name: "Dan Acheson", yearInducted: 2008, caption: "GE1", role: "Executive Director and CEO, DCI" },
  { name: "James Campbell", yearInducted: 2008, caption: "P", role: "Percussion arranger, instructor and innovator" },
  { name: "Rick Odello", yearInducted: 2008, caption: "GE1", role: "Director, Blue Devils B and C" },
  { name: "Greg Orwoll", yearInducted: 2008, caption: "GE1", role: "Executive Director, Colts" },

  // 2007
  { name: "Howard Dahnert", yearInducted: 2007, caption: "GE1", role: "Racine Scouts director" },
  { name: "Jay Kennedy", yearInducted: 2007, caption: "GE2", role: "Judge educator and musician" },
  { name: "Larry Kerchner", yearInducted: 2007, caption: "B", role: "Arranger and instructor" },
  { name: "Steve Vickers", yearInducted: 2007, caption: "GE2", role: "Drum corps publisher" },

  // 2006
  { name: "Tom Aungst", yearInducted: 2006, caption: "P", role: "Percussion arranger and caption head" },
  { name: "Alfred Fabrizio", yearInducted: 2006, caption: "GE2", role: "Instructor, arranger, adjudicator" },
  { name: "Freddy Martin", yearInducted: 2006, caption: "GE1", role: "Founder and director, Spirit of Atlanta" },
  { name: "Don Porter", yearInducted: 2006, caption: "GE1", role: "Director, Anaheim Kingsmen" },

  // 2005
  { name: "Dick Brown", yearInducted: 2005, caption: "GE2", role: "Arranger, instructor and judge" },
  { name: "Jeff Fiedler", yearInducted: 2005, caption: "GE1", role: "Director of the Cavaliers; Santa Clara Vanguard CEO" },
  { name: "Peggy Twiggs", yearInducted: 2005, caption: "CG", role: "Color guard instructor with 27th Lancers, Cadets" },

  // 2004
  { name: "Barry Bell", yearInducted: 2004, caption: "B", role: "Musical director, Toronto Optimists" },
  { name: "Scott Chandler", yearInducted: 2004, caption: "VP", role: "Program coordinator/choreographer, Blue Devils" },
  { name: "Tom Float", yearInducted: 2004, caption: "B", role: "Instructor, Blue Devils" },
  { name: "Stephanie Lynde", yearInducted: 2004, caption: "CG", role: "Principal dance choreographer, Blue Devils" },
  { name: "Donnie VanDoren", yearInducted: 2004, caption: "B", role: "Brass caption head, Star of Indiana" },

  // 2003
  { name: "Glenn Opie", yearInducted: 2003, caption: "GE1", role: "Director, Argonne Rebels" },
  { name: "Len Piekarski", yearInducted: 2003, caption: "VP", role: "Visual instructor and designer, Cavaliers" },

  // 2002
  { name: "Clarence Beebe", yearInducted: 2002, caption: "GE1", role: "Founder and executive director, Madison Scouts" },
  { name: "Sal Ferrera", yearInducted: 2002, caption: "B", role: "Program director, Cavaliers" },
  { name: "David Gibbs", yearInducted: 2002, caption: "GE1", role: "Executive director, Blue Devils" },
  { name: "Moe Latour", yearInducted: 2002, caption: "GE1", role: "Director, Phantom Regiment, Star of Indiana, Cadets" },
  { name: "Sie Lurye", yearInducted: 2002, caption: "GE1", role: "Founder and director, Royal Airs" },

  // 2001
  { name: "Thom Hannum", yearInducted: 2001, caption: "P", role: "Percussion arranger, clinician" },
  { name: "Marc Sylvester", yearInducted: 2001, caption: "VP", role: "Visual designer and instructor, Cadets" },
  { name: "James Wedge", yearInducted: 2001, caption: "B", role: "Brass arranger, 27th Lancers" },

  // 2000
  { name: "James Costello", yearInducted: 2000, caption: "GE1", role: "Founder of the Hawthorne Caballeros" },
  { name: "Adolph DeGrauwe", yearInducted: 2000, caption: "GE1", role: "Director of The Cavaliers" },
  { name: "Ralph Hardimon", yearInducted: 2000, caption: "P", role: "Percussion composer and arranger" },
  { name: "Larry McCormick", yearInducted: 2000, caption: "P", role: "Percussion instructor, arranger" },

  // 1999
  { name: "Gary Czapinski", yearInducted: 1999, caption: "VP", role: "Show consultant and designer" },
  { name: "Paul Litteau", yearInducted: 1999, caption: "VA", role: "Visual designer, instructor, judge" },
  { name: "Clarke Williams", yearInducted: 1999, caption: "GE2", role: "DCI judge" },

  // 1998
  { name: "Charley Poole, Jr.", yearInducted: 1998, caption: "P", role: "Percussion arranger, 27th Lancers" },
  { name: "Gerry Shellmer", yearInducted: 1998, caption: "P", role: "Percussion arranger and instructor" },
  { name: "Ernie Zimny", yearInducted: 1998, caption: "GE2", role: "Performer, instructor, judge" },

  // 1997
  { name: "James Elvord", yearInducted: 1997, caption: "B", role: "Brass arranger and instructor, DCI judge" },
  { name: "Michael Moxley", yearInducted: 1997, caption: "VP", role: "Visual director, Blue Devils" },

  // 1996
  { name: "Michael Cesario", yearInducted: 1996, caption: "VP", role: "Visual designer and consultant" },
  { name: "Jim Prime, Jr.", yearInducted: 1996, caption: "B", role: "Brass arranger and instructor" },
  { name: "Dave Richards", yearInducted: 1996, caption: "GE2", role: "DCI Judge" },

  // 1995
  { name: "Joe Marrella", yearInducted: 1995, caption: "P", role: "Percussion arranger and consultant" },
  { name: "Sandra Opie", yearInducted: 1995, caption: "B", role: "Brass instructor, Argonne Rebels, DCI judge" },
  { name: "Jim Ott", yearInducted: 1995, caption: "B", role: "Brass arranger, Blue Devils and Spirit of Atlanta" },

  // 1994
  { name: "John Brazale", yearInducted: 1994, caption: "VP", role: "Drill designer, Phantom Regiment" },
  { name: "William Howard", yearInducted: 1994, caption: "GE1", role: "Director of Madison Scouts" },
  { name: "Jim Wren", yearInducted: 1994, caption: "B", role: "Phantom Regiment brass arranger" },

  // 1993
  { name: "Gene Monterastelli", yearInducted: 1993, caption: "GE2", role: "Instructor, Troopers, DCI judge" },
  { name: "Jerry Seawright", yearInducted: 1993, caption: "GE1", role: "Founder and director of the Blue Devils" },
  { name: "Scott Stewart", yearInducted: 1993, caption: "GE1", role: "Director of the Madison Scouts" },

  // 1992
  { name: "Steve Brubaker", yearInducted: 1992, caption: "VP", role: "Visual designer, Cavaliers" },
  { name: "George Oliviero", yearInducted: 1992, caption: "GE2", role: "DCI judge and judge educator" },
  { name: "Don Whiteley", yearInducted: 1992, caption: "GE2", role: "First DCI public relations director" },

  // 1991
  { name: "Roman Blenski", yearInducted: 1991, caption: "GE1", role: "Drum Corps Midwest executive director" },
  { name: "Joe Colla", yearInducted: 1991, caption: "GE2", role: "Judging and DCI contest crew" },
  { name: "Truman Crawford", yearInducted: 1991, caption: "B", role: "Brass arranger and instructor" },
  { name: "Dennis DeLucia", yearInducted: 1991, caption: "P", role: "Percussion arranger and instructor" },
  { name: "Wayne Downey", yearInducted: 1991, caption: "B", role: "Brass arranger, Blue Devils" },
  { name: "Jack Meehan", yearInducted: 1991, caption: "B", role: "Brass instructor, Blue Devils and Santa Clara Vanguard" },
  { name: "Ralph Pace", yearInducted: 1991, caption: "VP", role: "Visual designer, Cavaliers and Spirit of Atlanta" },
  { name: "Fred Sanford", yearInducted: 1991, caption: "P", role: "Percussion arranger, Santa Clara Vanguard" },
  { name: "George Zingali", yearInducted: 1991, caption: "VP", role: "Visual designer, 27th Lancers, Garfield Cadets, Star of Indiana" },

  // 1990
  { name: "Rodney Goodhart", yearInducted: 1990, caption: "P", role: "Percussion judge and caption head" },
  { name: "Bobby Hoffman", yearInducted: 1990, caption: "VP", role: "Visual designer, Bridgemen, Velvet Knights" },
  { name: "Aram Kazazian", yearInducted: 1990, caption: "GE2", role: "Visual and timing judge" },
  { name: "Robert Notaro", yearInducted: 1990, caption: "GE1", role: "Division II & III corps catalyst" },
  { name: "Mary Pesceone", yearInducted: 1990, caption: "GE2", role: "DCI administrator" },

  // 1989
  { name: "Pete Emmons", yearInducted: 1989, caption: "VP", role: "Visual designer, Santa Clara Vanguard" },
  { name: "Ken Kobold", yearInducted: 1989, caption: "GE2", role: "First DCI recording engineer" },
  { name: "Richard Maass", yearInducted: 1989, caption: "VA", role: "Visual judge and instructor" },
  { name: "James Unrath", yearInducted: 1989, caption: "GE2", role: "Author of the original Blue Book" },

  // 1988
  { name: "Bernard Baggs", yearInducted: 1988, caption: "GE2", role: "DCI judge and executive board advisor" },
  { name: "Robert Briske", yearInducted: 1988, caption: "GE2", role: "DCI contest director" },
  { name: "Earl Joyce", yearInducted: 1988, caption: "GE2", role: "Father of modern judging" },

  // 1987
  { name: "Robert Currie", yearInducted: 1987, caption: "P", role: "Percussion judge" },

  // 1986
  { name: "Don Pesceone", yearInducted: 1986, caption: "GE1", role: "Executive director of DCI" },
  { name: "Gail Royer", yearInducted: 1986, caption: "GE1", role: "Founder and director, Santa Clara Vanguard" },

  // 1985
  { name: "Donald Angelica", yearInducted: 1985, caption: "GE2", role: "DCI judges' administrator" },
  { name: "George Bonfiglio", yearInducted: 1985, caption: "GE1", role: "Founder and director, 27th Lancers" },
  { name: "Jim Jones", yearInducted: 1985, caption: "GE1", role: "Founder and director, Troopers" },
  { name: "David Kampschroer", yearInducted: 1985, caption: "GE1", role: "First executive director, Western region, DCI; President, Blue Stars" },
  { name: "Hugh Mahon", yearInducted: 1985, caption: "GE1", role: "First executive director, eastern region, DCI; Director, Garfield Cadets" },
  { name: "Don Warren", yearInducted: 1985, caption: "GE1", role: "Founder and director, Cavaliers" }
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
