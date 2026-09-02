#!/usr/bin/env node
// Deploys storage.rules to production, provisioning the project's default
// Cloud Storage bucket first if it has never been set up.
//
// Why this exists: `firebase deploy --only storage` hard-fails on a project
// whose Storage console page has never had "Get Started" clicked ("Firebase
// Storage has not been set up on project ..."). On 2026-09-02 that took the
// whole Cloud Functions deploy down with it. The console button is just a
// call to the Cloud Storage for Firebase REST API's
// projects.defaultBucket.create method, so this script makes the same call
// non-interactively with the deploy service account, then deploys the rules.
//
// Outcomes:
//   - bucket exists (or was just created)  → deploy storage.rules; exit 1 if
//     that deploy itself fails (a real error).
//   - bucket missing and the service account may not create it (403), or the
//     project is not eligible (400/412) → emit a GitHub Actions warning and
//     exit 0. Skipping is safe: with no bucket there is nothing the rules
//     could be protecting, and Firestore rules have already shipped by the
//     time this runs. The warning names the one-time fix for the owner.
//
// Env:
//   GOOGLE_APPLICATION_CREDENTIALS  path to the deploy service-account key
//   FIREBASE_PROJECT                project id (default: marching-art)
//   STORAGE_BUCKET_LOCATION         location for a newly created bucket
//                                   (default: US-CENTRAL1, same region as
//                                   the Cloud Functions)
//   STORAGE_RULES_SKIP_DEPLOY=1     ensure the bucket only; don't run
//                                   `firebase deploy` (for local checks)
//
// Usage (see .github/workflows/deploy-functions.yml):
//   node scripts/deployStorageRules.mjs

import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const PROJECT = process.env.FIREBASE_PROJECT || 'marching-art';
const LOCATION = (process.env.STORAGE_BUCKET_LOCATION || 'US-CENTRAL1').toUpperCase();
const DEFAULT_BUCKET_URL = `https://firebasestorage.googleapis.com/v1beta/projects/${PROJECT}/defaultBucket`;
const CONSOLE_URL = `https://console.firebase.google.com/project/${PROJECT}/storage`;
const IS_GITHUB = Boolean(process.env.GITHUB_ACTIONS);

/** @param {string} msg */
function warn(msg) {
  // `::warning::` surfaces in the run summary + annotations on GitHub.
  console.error(IS_GITHUB ? `::warning::${msg}` : `WARNING: ${msg}`);
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
 * @param {object} [json]
 * @returns {Promise<{ status: number, body: any }>}
 */
async function api(token, method, json) {
  const res = await fetch(DEFAULT_BUCKET_URL, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'x-goog-user-project': PROJECT,
      ...(json ? { 'content-type': 'application/json' } : {}),
    },
    body: json ? JSON.stringify(json) : undefined,
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

/** @param {any} defaultBucket */
function bucketName(defaultBucket) {
  // DefaultBucket.bucket.name is "projects/_/buckets/<bucket>"; .name is
  // "projects/<project>/defaultBucket".
  const full = defaultBucket?.bucket?.name || '';
  return full.split('/').pop() || `${PROJECT}.firebasestorage.app`;
}

/**
 * Make sure the project has a default bucket.
 * @returns {Promise<{ ok: true, bucket: string, created: boolean } | { ok: false, reason: string }>}
 */
async function ensureDefaultBucket() {
  const token = await getAccessToken();

  const existing = await api(token, 'GET');
  if (existing.status === 200) {
    return { ok: true, bucket: bucketName(existing.body), created: false };
  }
  if (existing.status !== 404) {
    return { ok: false, reason: `could not read default bucket (${describe(existing)})` };
  }

  console.log(`No default Storage bucket on '${PROJECT}'; creating one in ${LOCATION}...`);
  const created = await api(token, 'POST', { location: LOCATION });
  if (created.status === 200) {
    return { ok: true, bucket: bucketName(created.body), created: true };
  }
  // 409 = raced with someone clicking the console button; re-read.
  if (created.status === 409) {
    const again = await api(token, 'GET');
    if (again.status === 200) return { ok: true, bucket: bucketName(again.body), created: false };
  }
  return { ok: false, reason: `could not create default bucket (${describe(created)})` };
}

async function main() {
  /** @type {Awaited<ReturnType<typeof ensureDefaultBucket>>} */
  let ensured;
  try {
    ensured = await ensureDefaultBucket();
  } catch (error) {
    ensured = { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }

  if (!ensured.ok) {
    warn(
      `storage.rules NOT deployed: ${ensured.reason}. ` +
        `One-time fix for the project owner: either click "Get Started" at ${CONSOLE_URL}, ` +
        `or grant the deploy service account the "Firebase Admin" role so CI can create the ` +
        `bucket itself. Firestore rules and functions are unaffected.`
    );
    return 0;
  }

  console.log(
    ensured.created
      ? `Created default Storage bucket '${ensured.bucket}' (${LOCATION}).`
      : `Default Storage bucket '${ensured.bucket}' already exists.`
  );
  if (ensured.created && IS_GITHUB) {
    console.log(
      `::notice::Default Storage bucket created: ${ensured.bucket}. ` +
        `Set the VITE_FIREBASE_STORAGE_BUCKET repository secret to this value if it differs.`
    );
  }

  if (process.env.STORAGE_RULES_SKIP_DEPLOY === '1') return 0;

  const deploy = spawnSync(
    'firebase',
    ['deploy', '--only', 'storage', '--force', '--project', PROJECT, '--non-interactive'],
    { stdio: 'inherit' }
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
