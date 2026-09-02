#!/usr/bin/env node
// Deploys storage.rules to production, first making sure the bucket named in
// firebase.json is linked to Firebase.
//
// Why this exists: the project has no Firebase *default* bucket (it was
// never provisioned), and `firebase deploy --only storage` hard-fails on that
// ("Firebase Storage has not been set up on project ...") — which took the
// whole Cloud Functions deploy down on 2026-09-02. Instead, a domain-named
// Cloud Storage bucket (`marching.art`, domain-verified) is used. Two things
// have to be true for the rules to deploy against it:
//
//   1. firebase.json's `storage` entry is an ARRAY with an explicit `bucket`.
//      The CLI only looks up the default bucket for the object form; with an
//      explicit bucket it releases the ruleset straight to that bucket.
//   2. The bucket is linked to Firebase (what the console's "Import bucket"
//      does). A plain GCS bucket is not visible to the Firebase Rules
//      service, so the release would fail. This script performs the link via
//      the Cloud Storage for Firebase REST API (projects.buckets.addFirebase)
//      using the deploy service account; the call is idempotent.
//
// Outcomes:
//   - bucket linked (already, or just now) → deploy storage.rules; exit 1 if
//     that deploy itself fails (a real error).
//   - bucket cannot be linked (service account lacks permission, bucket does
//     not exist) → emit a GitHub Actions warning naming the fix and exit 0,
//     so Firestore rules and functions still ship. Skipping is safe: an
//     unlinked bucket is not reachable through Firebase Storage at all.
//
// Env:
//   GOOGLE_APPLICATION_CREDENTIALS  path to the deploy service-account key
//   FIREBASE_PROJECT                project id (default: marching-art)
//   STORAGE_RULES_SKIP_DEPLOY=1     link only; don't run `firebase deploy`
//                                   (for local checks)
//
// Usage (see .github/workflows/deploy-functions.yml):
//   node scripts/deployStorageRules.mjs

import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PROJECT = process.env.FIREBASE_PROJECT || 'marching-art';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_ROOT = `https://firebasestorage.googleapis.com/v1beta/projects/${PROJECT}`;
const CONSOLE_URL = `https://console.firebase.google.com/project/${PROJECT}/storage`;
const IS_GITHUB = Boolean(process.env.GITHUB_ACTIONS);

/** @param {string} msg */
function warn(msg) {
  // `::warning::` surfaces in the run summary + annotations on GitHub.
  console.error(IS_GITHUB ? `::warning::${msg}` : `WARNING: ${msg}`);
}

/**
 * The bucket names from firebase.json's `storage` entries — the single
 * source of truth, so this script and the CLI can never disagree.
 * @returns {Promise<string[]>}
 */
async function bucketsFromFirebaseJson() {
  const config = JSON.parse(await readFile(path.join(REPO_ROOT, 'firebase.json'), 'utf8'));
  const entries = Array.isArray(config.storage) ? config.storage : [config.storage];
  const buckets = entries.map((e) => e?.bucket).filter((b) => typeof b === 'string' && b);
  if (buckets.length === 0) {
    throw new Error(
      'firebase.json `storage` must be an array of { bucket, rules } entries — ' +
        'the object form makes the CLI look up a default bucket this project does not have'
    );
  }
  return buckets;
}

/**
 * Mint an OAuth2 access token for the service account in
 * GOOGLE_APPLICATION_CREDENTIALS using the JWT bearer grant — the same thing
 * google-auth-library does, without the dependency (this runs in a job that
 * has not necessarily installed node_modules).
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set');
  const key = JSON.parse(await readFile(keyPath, 'utf8'));
  if (!key.client_email || !key.private_key) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not a service-account key');
  }
  const tokenUri = key.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  /** @param {unknown} o */
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: now,
    exp: now + 600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: HTTP ${res.status} ${await res.text()}`);
  const body = /** @type {{ access_token?: string }} */ (await res.json());
  if (!body.access_token) throw new Error('token exchange returned no access_token');
  return body.access_token;
}

/**
 * @param {string} token
 * @param {"GET" | "POST"} method
 * @param {string} url
 * @returns {Promise<{ status: number, body: any }>}
 */
async function api(token, method, url) {
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'x-goog-user-project': PROJECT,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    body: method === 'POST' ? '{}' : undefined,
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

/** @param {{ status: number, body: any }} r */
function describe(r) {
  const err = r.body?.error;
  return err ? `${err.status || r.status}: ${err.message}` : `HTTP ${r.status}`;
}

/**
 * Link `bucket` to Firebase if it is not already.
 * @param {string} token
 * @param {string} bucket
 * @returns {Promise<{ ok: true, linked: boolean } | { ok: false, reason: string }>}
 */
async function ensureLinked(token, bucket) {
  const resource = `${API_ROOT}/buckets/${encodeURIComponent(bucket)}`;
  const existing = await api(token, 'GET', resource);
  if (existing.status === 200) return { ok: true, linked: false };
  if (existing.status !== 404) {
    return { ok: false, reason: `could not read bucket '${bucket}' (${describe(existing)})` };
  }

  console.log(`Bucket '${bucket}' is not linked to Firebase yet; linking...`);
  const linked = await api(token, 'POST', `${resource}:addFirebase`);
  if (linked.status === 200) return { ok: true, linked: true };
  // 409 = raced with someone importing it in the console; that's still linked.
  if (linked.status === 409) return { ok: true, linked: false };
  return { ok: false, reason: `could not link bucket '${bucket}' (${describe(linked)})` };
}

async function main() {
  const buckets = await bucketsFromFirebaseJson();
  /** @type {string[]} */
  const problems = [];
  try {
    const token = await getAccessToken();
    for (const bucket of buckets) {
      const result = await ensureLinked(token, bucket);
      if (!result.ok) {
        problems.push(result.reason);
        continue;
      }
      console.log(
        result.linked
          ? `Linked bucket '${bucket}' to Firebase project '${PROJECT}'.`
          : `Bucket '${bucket}' is already linked to Firebase.`
      );
      if (result.linked && IS_GITHUB) {
        console.log(
          `::notice::Storage bucket '${bucket}' is now linked to Firebase. ` +
            `Make sure the VITE_FIREBASE_STORAGE_BUCKET repository secret is '${bucket}'.`
        );
      }
    }
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if (problems.length > 0) {
    warn(
      `storage.rules NOT deployed: ${problems.join('; ')}. ` +
        `One-time fix for the project owner: open ${CONSOLE_URL}, use "Import bucket" to link ` +
        `'${buckets.join("', '")}' to Firebase (or grant the deploy service account the ` +
        `"Firebase Admin" role so CI can link it), then re-run this workflow with ` +
        `deploy_target=rules-only. Firestore rules and functions are unaffected.`
    );
    return 0;
  }

  if (process.env.STORAGE_RULES_SKIP_DEPLOY === '1') return 0;

  const deploy = spawnSync(
    'firebase',
    ['deploy', '--only', 'storage', '--force', '--project', PROJECT, '--non-interactive'],
    { stdio: 'inherit', cwd: REPO_ROOT }
  );
  if (deploy.error) throw deploy.error;
  return deploy.status ?? 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
