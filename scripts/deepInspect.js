#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deepInspect() {
  console.log('🔬 DEEP DIVE: Historical Scores & Caption Data\n');
  console.log('=' .repeat(80));

  try {
    // Get a recent year with full data
    const year2024 = await db.doc('historical_scores/2024').get();

    if (year2024.exists) {
      const data = year2024.data();
      console.log('\n📊 2024 HISTORICAL SCORES STRUCTURE');
      console.log('-'.repeat(80));
      console.log(`Total Events: ${data.data.length}`);

      // Show first 5 events
      console.log('\nFirst 5 Events:');
      data.data.slice(0, 5).forEach((event, idx) => {
        console.log(`\nEvent ${idx + 1}:`);
        console.log(`  Date: ${new Date(event.date).toLocaleDateString()}`);
        console.log(`  Location: ${event.location}`);
        console.log(`  Event Name: ${event.eventName}`);
        console.log(`  Off-Season Day: ${event.offSeasonDay || 'N/A'}`);
        console.log(`  Corps Count: ${event.scores.length}`);

        if (event.scores[0]) {
          console.log(`  Sample Corps: ${event.scores[0].corps}`);
          console.log(`  Total Score: ${event.scores[0].score}`);
          console.log(`  Captions:`, event.scores[0].captions);
        }
      });

      // Find Finals event
      const finalsEvent = data.data.find(e => e.eventName.includes('Finals'));
      if (finalsEvent) {
        console.log('\n\n🏆 2024 FINALS BREAKDOWN');
        console.log('-'.repeat(80));
        console.log(`Date: ${new Date(finalsEvent.date).toLocaleDateString()}`);
        console.log(`Location: ${finalsEvent.location}`);
        console.log(`Off-Season Day: ${finalsEvent.offSeasonDay || 'N/A'}`);
        console.log(`\nTop 5 Corps:`);

        finalsEvent.scores.slice(0, 5).forEach((corps, idx) => {
          console.log(`\n${idx + 1}. ${corps.corps} - ${corps.score}`);
          console.log(`   GE: ${corps.captions.GE1} + ${corps.captions.GE2} = ${corps.captions.GE1 + corps.captions.GE2}`);
          console.log(`   Visual: ${corps.captions.VP} + ${corps.captions.VA} + ${corps.captions.CG}`);
          console.log(`   Music: ${corps.captions.B} + ${corps.captions.MA} + ${corps.captions.P}`);
        });
      }

      // Check for progression through season
      console.log('\n\n📈 BLUECOATS 2024 SEASON PROGRESSION');
      console.log('-'.repeat(80));
      const bluecoatsScores = [];
      data.data.forEach(event => {
        const bluecoatsScore = event.scores.find(s => s.corps === 'Bluecoats');
        if (bluecoatsScore) {
          bluecoatsScores.push({
            date: new Date(event.date).toLocaleDateString(),
            offSeasonDay: event.offSeasonDay,
            location: event.location,
            total: bluecoatsScore.score,
            brass: bluecoatsScore.captions.B,
            ge1: bluecoatsScore.captions.GE1,
            guard: bluecoatsScore.captions.CG
          });
        }
      });

      console.log('Shows:', bluecoatsScores.length);
      console.log('\nProgression (first 10 shows):');
      bluecoatsScores.slice(0, 10).forEach((show, idx) => {
        console.log(`${idx + 1}. ${show.date} - Total: ${show.total} | B: ${show.brass} | GE1: ${show.ge1} | CG: ${show.guard}`);
      });
    }

    // Check current season DCI data structure
    console.log('\n\n🎯 CURRENT SEASON DCI DATA (allegro_2025-26)');
    console.log('-'.repeat(80));
    const currentSeason = await db.doc('dci-data/allegro_2025-26').get();

    if (currentSeason.exists) {
      const data = currentSeason.data();
      console.log(`Total Corps Available: ${data.corps?.length || 0}`);

      console.log('\nTop 10 Corps by Value:');
      data.corps.slice(0, 10).forEach((corps, idx) => {
        console.log(`${idx + 1}. ${corps.corpsName} (${corps.sourceYear}) - Value: ${corps.value} - Finals Score: ${corps.finalScore}`);
      });

      // Check if corps have caption-level data
      console.log('\n\nChecking if corps have caption-specific values...');
      const sampleCorps = data.corps[0];
      console.log('Sample Corps Full Data:', JSON.stringify(sampleCorps, null, 2));
    }

    // Check if there's a dci-stats collection
    console.log('\n\n📊 DCI STATISTICS COLLECTION');
    console.log('-'.repeat(80));
    const statsDoc = await db.doc('dci-stats/allegro_2025-26').get();
    if (statsDoc.exists) {
      const statsData = statsDoc.data();
      console.log('Stats available!');
      console.log(`Corps count: ${statsData.data?.length || 0}`);
      if (statsData.data && statsData.data[0]) {
        console.log('\nSample Corps Stats:');
        console.log(JSON.stringify(statsData.data[0], null, 2));
      }
    } else {
      console.log('No stats document found for current season.');
    }

    // Look at how show selections work
    console.log('\n\n🎭 SAMPLE USER CORPS LINEUP');
    console.log('-'.repeat(80));
    const userProfiles = await db.collectionGroup('profile').limit(3).get();
    let foundLineup = false;

    userProfiles.forEach(doc => {
      const data = doc.data();
      if (data.corps && !foundLineup) {
        Object.keys(data.corps).forEach(corpsClass => {
          const corps = data.corps[corpsClass];
          if (corps.lineup) {
            console.log(`\nUser: ${data.displayName || 'Unknown'}`);
            console.log(`Class: ${corpsClass}`);
            console.log(`Corps Name: ${corps.corpsName}`);
            console.log(`Lineup:`);
            Object.keys(corps.lineup).forEach(caption => {
              console.log(`  ${caption}: ${corps.lineup[caption]}`);
            });
            foundLineup = true;
          }
        });
      }
    });

    if (!foundLineup) {
      console.log('No user lineups found in sample.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }

  process.exit(0);
}

deepInspect();
