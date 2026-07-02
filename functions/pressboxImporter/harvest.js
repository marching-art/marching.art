// Step 1: Discover and download the month recap documents for 2000-2013.
//
// Each fromthepressbox.com season page is a JS-rendered site-builder page.
// The page shell references per-page content bundles on Google Cloud Storage;
// those bundles contain the asset links ("urlAddress":{"type":"Asset",...})
// whose fileName gives the document path, e.g.
//   50c9f61c5f964d12bd48ad7182b9fe36/2000junerecaps.htm
// served from https://storage.googleapis.com/wzukusers/user-29900967/documents/.
//
// Writes manifest.json (year -> [{fileName, url}]) and downloads each document
// into cache/. Documents whose filename year doesn't match the season page are
// skipped: some season pages link the wrong year's files (as of July 2026 the
// 2011 page links the 2010 documents and the 2008 page links a 2000 document),
// so those months are genuinely unavailable from this source.
//
// Usage: node harvest.js

const fs = require("fs");
const path = require("path");
const {
  YEARS, SEASON_PAGE_URL, DOCUMENT_BASE_URL, CACHE_DIR, MANIFEST_PATH,
} = require("./config");

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function discoverYear(year) {
  const shell = await fetchText(SEASON_PAGE_URL(year));
  const bundleUrls = [...shell.matchAll(
    /src='(https:\/\/storage\.googleapis\.com\/wzukusers\/user-29900967\/sites\/[^']+\.js[^']*)'/g,
  )].map((m) => m[1]);

  const fileNames = new Set();
  for (const bundleUrl of bundleUrls) {
    const js = await fetchText(bundleUrl);
    for (const m of js.matchAll(
      /"urlAddress":\{"type":"Asset","url":\{[^}]*"fileName":"([^"]+\.html?)"/g,
    )) {
      fileNames.add(m[1]);
    }
  }

  const docs = [];
  for (const fileName of [...fileNames].sort()) {
    const base = fileName.split("/").pop();
    if (!base.startsWith(year)) {
      console.warn(`  [${year}] Skipping mislinked asset ${base} (wrong year).`);
      continue;
    }
    docs.push({ fileName, url: DOCUMENT_BASE_URL + fileName });
  }
  return docs;
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const manifest = {};

  for (const year of YEARS) {
    try {
      const docs = await discoverYear(year);
      manifest[year] = docs;
      console.log(`${year}: found ${docs.length} document(s): ` +
        docs.map((d) => d.fileName.split("/").pop()).join(", "));
    } catch (err) {
      console.error(`${year}: discovery failed - ${err.message}`);
      manifest[year] = [];
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${MANIFEST_PATH}`);

  for (const year of YEARS) {
    for (const doc of manifest[year]) {
      const dest = path.join(CACHE_DIR, doc.fileName.split("/").pop());
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
        console.log(`cached   ${path.basename(dest)}`);
        continue;
      }
      const buf = await fetchBuffer(doc.url);
      fs.writeFileSync(dest, buf);
      console.log(`fetched  ${path.basename(dest)} (${buf.length} bytes)`);
    }
  }

  console.log("\nHarvest complete. Next: node parse.js");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
