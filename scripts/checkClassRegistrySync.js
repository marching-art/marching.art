#!/usr/bin/env node
// Phase 1.1 guard: the class registry exists as two committed copies because
// Cloud Functions cannot import files outside their deploy root. This script
// verifies they are byte-identical (run in CI / pre-commit), or copies the
// functions copy over the client copy with --fix.
const fs = require('node:fs');
const path = require('node:path');

const canonical = path.join(__dirname, '../functions/src/config/classRegistry.json');
const mirror = path.join(__dirname, '../src/config/classRegistry.json');

const a = fs.readFileSync(canonical, 'utf8');
if (process.argv.includes('--fix')) {
  fs.writeFileSync(mirror, a);
  console.log('classRegistry.json mirror updated.');
  process.exit(0);
}
const b = fs.existsSync(mirror) ? fs.readFileSync(mirror, 'utf8') : '';
if (a !== b) {
  console.error(
    'classRegistry.json copies differ. Edit functions/src/config/classRegistry.json, then run:\n' +
      '  node scripts/checkClassRegistrySync.js --fix'
  );
  process.exit(1);
}
console.log('classRegistry.json copies are in sync.');
