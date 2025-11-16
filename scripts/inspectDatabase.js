#!/usr/bin/env node

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectDatabase() {
  console.log('🔍 MARCHING.ART DATABASE INSPECTION\n');
  console.log('=' .repeat(80));

  try {
    // 1. Check Historical Scores
    console.log('\n📊 HISTORICAL SCORES COLLECTION');
    console.log('-'.repeat(80));
    const historicalDocs = await db.collection('historical_scores').listDocuments();
    console.log(`Found ${historicalDocs.length} year(s) of historical data:`);
    console.log(historicalDocs.map(doc => doc.id).join(', '));

    // Sample one year
    if (historicalDocs.length > 0) {
      const sampleYearId = historicalDocs[0].id;
      const sampleYear = await db.doc(`historical_scores/${sampleYearId}`).get();
      if (sampleYear.exists) {
        const data = sampleYear.data();
        console.log(`\n📝 Sample Year (${sampleYearId}) Structure:`);
        console.log(JSON.stringify(data, null, 2).substring(0, 2000) + '...');

        // Count events and corps
        if (data.data && Array.isArray(data.data)) {
          console.log(`\nEvents in ${sampleYearId}: ${data.data.length}`);
          if (data.data[0]) {
            console.log('First event:', data.data[0].date, data.data[0].location);
            if (data.data[0].scores && data.data[0].scores[0]) {
              console.log('Sample score entry:', JSON.stringify(data.data[0].scores[0], null, 2));
            }
          }
        }
      }
    }

    // 2. Check DCI Data
    console.log('\n\n🏆 DCI-DATA COLLECTION');
    console.log('-'.repeat(80));
    const dciDataDocs = await db.collection('dci-data').listDocuments();
    console.log(`Found ${dciDataDocs.length} season(s) of DCI data:`);
    console.log(dciDataDocs.map(doc => doc.id).join(', '));

    // Sample one season
    if (dciDataDocs.length > 0) {
      const sampleSeasonId = dciDataDocs[0].id;
      const sampleSeason = await db.doc(`dci-data/${sampleSeasonId}`).get();
      if (sampleSeason.exists) {
        const data = sampleSeason.data();
        console.log(`\n📝 Sample Season (${sampleSeasonId}) Structure:`);
        console.log(JSON.stringify(data, null, 2).substring(0, 2000) + '...');

        if (data.corpsValues && Array.isArray(data.corpsValues)) {
          console.log(`\nCorps in season: ${data.corpsValues.length}`);
          console.log('Sample corps:', JSON.stringify(data.corpsValues[0], null, 2));
        }
      }
    }

    // 3. Check Current Season Settings
    console.log('\n\n⚙️  CURRENT SEASON SETTINGS');
    console.log('-'.repeat(80));
    const seasonSettings = await db.doc('game-settings/season').get();
    if (seasonSettings.exists) {
      const data = seasonSettings.data();
      console.log('Current Season:', data.name || data.seasonUid);
      console.log('Status:', data.status);
      console.log('Type:', data.type);
      console.log('Current Day:', data.currentDay);
      console.log('Data Doc ID:', data.dataDocId);
      console.log('\nFull settings:');
      console.log(JSON.stringify(data, null, 2).substring(0, 1500) + '...');
    }

    // 4. Check Staff Database
    console.log('\n\n👥 STAFF DATABASE');
    console.log('-'.repeat(80));
    const staffDocs = await db.collection('staff_database').limit(5).get();
    console.log(`Sample of ${staffDocs.size} staff members:`);
    staffDocs.forEach(doc => {
      console.log(`- ${doc.id}:`, JSON.stringify(doc.data(), null, 2));
    });

    // 5. Check Fantasy Recaps
    console.log('\n\n📜 FANTASY RECAPS');
    console.log('-'.repeat(80));
    const recapDocs = await db.collection('fantasy_recaps').listDocuments();
    console.log(`Found ${recapDocs.length} season recap(s):`);
    console.log(recapDocs.map(doc => doc.id).join(', '));

    if (recapDocs.length > 0) {
      const sampleRecap = await recapDocs[0].get();
      if (sampleRecap.exists) {
        const data = sampleRecap.data();
        console.log(`\nRecaps count: ${data.recaps?.length || 0}`);
        if (data.recaps && data.recaps[0]) {
          console.log('Sample recap:', JSON.stringify(data.recaps[0], null, 2).substring(0, 1000) + '...');
        }
      }
    }

    // 6. Check User Profiles (sample)
    console.log('\n\n👤 SAMPLE USER PROFILE');
    console.log('-'.repeat(80));
    const userProfiles = await db.collectionGroup('profile').limit(1).get();
    if (!userProfiles.empty) {
      userProfiles.forEach(doc => {
        const data = doc.data();
        console.log('User ID:', doc.ref.parent.parent.id);
        console.log('Profile data:');
        console.log(JSON.stringify({
          displayName: data.displayName,
          xp: data.xp,
          xpLevel: data.xpLevel,
          corpsCoin: data.corpsCoin,
          unlockedClasses: data.unlockedClasses,
          corps: data.corps ? Object.keys(data.corps) : [],
          staff: data.staff?.length || 0
        }, null, 2));
      });
    }

    // 7. Check Live Scores (if any)
    console.log('\n\n📡 LIVE SCORES');
    console.log('-'.repeat(80));
    const liveScoreCollections = await db.collection('live_scores').listDocuments();
    console.log(`Found ${liveScoreCollections.length} live score season(s)`);

    // 8. Summary Statistics
    console.log('\n\n📈 DATABASE SUMMARY');
    console.log('-'.repeat(80));
    console.log(`✓ Historical Score Years: ${historicalDocs.length}`);
    console.log(`✓ DCI Data Seasons: ${dciDataDocs.length}`);
    console.log(`✓ Fantasy Recaps: ${recapDocs.length}`);
    console.log(`✓ Staff Database: ${staffDocs.size}+ entries`);
    console.log(`✓ Live Score Seasons: ${liveScoreCollections.length}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Database inspection complete!\n');

  } catch (error) {
    console.error('❌ Error inspecting database:', error);
    console.error(error.stack);
  }

  process.exit(0);
}

inspectDatabase();
