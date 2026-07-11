#!/usr/bin/env node
/**
 * Idempotent PocketBase schema setup.
 *
 * NOTE: The Docker image auto-applies the migrations in pb/pb_migrations on
 * boot, so you usually do NOT need this. It's a convenience for pointing at a
 * bare PocketBase instance (e.g. `npm run dev` against a PB without the
 * migrations) and verifying / creating the collections manually.
 *
 * - Creates missing collections.
 * - Verifies existing collections have every expected field; if any are
 *   missing it auto-recreates the collection IF it has no records, or fails
 *   with a clear message (use --force to recreate non-empty collections,
 *   which drops the data).
 *
 * Reads credentials from .env.local (or environment):
 *   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
 */

import fs from 'node:fs';
import path from 'node:path';

const FORCE = process.argv.includes('--force');

const envFile = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set (use .env.local)');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let _token = null;
const auth = async () => {
  const r = await raw(null, 'POST', '/api/collections/_superusers/auth-with-password', {
    identity: EMAIL,
    password: PASSWORD,
  });
  _token = r.token;
  return _token;
};

const raw = async (token, method, pathname, body) => {
  const res = await fetch(`${PB_URL}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`${method} ${pathname} -> ${res.status}: ${text}`);
    err.response = data;
    err.status = res.status;
    throw err;
  }
  return data;
};

// Wraps `raw` with retries for transient errors that PocketBase emits while
// auth/state is settling after schema changes.
const api = async (method, pathname, body) => {
  if (!_token) await auth();
  const delays = [0, 400, 900, 1800, 3000];
  let lastErr;
  for (const delay of delays) {
    if (delay) await sleep(delay);
    try {
      return await raw(_token, method, pathname, body);
    } catch (e) {
      if (!e.status) throw e;
      const transient = e.status === 400 || e.status === 401 || e.status === 500;
      if (!transient || delay === delays[delays.length - 1]) throw e;
      lastErr = e;
      if (e.status === 401) await auth();
    }
  }
  throw lastErr;
};

const SYSTEM_FIELDS = [
  {
    name: 'id', type: 'text', system: true, primaryKey: true,
    pattern: '^[a-z0-9]+$', min: 15, max: 15,
    autogeneratePattern: '[a-z0-9]{15}',
  },
  { name: 'created', type: 'autodate', system: true, onCreate: true },
  { name: 'updated', type: 'autodate', system: true, onCreate: true, onUpdate: true },
];
const SYSTEM_NAMES = new Set(SYSTEM_FIELDS.map((f) => f.name));

const withSystem = (fields) => [...fields, ...SYSTEM_FIELDS];

const OPEN_RULES = {
  listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
};

const COLLECTIONS = [
  {
    name: 'players',
    type: 'base',
    ...OPEN_RULES,
    fields: withSystem([
      { name: 'name',     type: 'text', required: true, max: 100 },
      { name: 'name_key', type: 'text', required: true, max: 100 },
    ]),
    indexes: [
      'CREATE UNIQUE INDEX `idx_players_name_key` ON `players` (`name_key`)',
    ],
  },
  {
    name: 'games',
    type: 'base',
    ...OPEN_RULES,
    fields: withSystem([
      { name: 'name',             type: 'text',   required: true,  max: 200 },
      { name: 'starting_balance', type: 'number', required: false, min: 0 },
      { name: 'ended_at',         type: 'date',   required: false },
      { name: 'players_json',     type: 'json',   required: true,  maxSize: 200000 },
    ]),
    indexes: [
      'CREATE INDEX `idx_games_created` ON `games` (`created`)',
    ],
  },
  {
    name: 'player_pins',
    type: 'base',
    ...OPEN_RULES,
    fields: withSystem([
      { name: 'name_key', type: 'text', required: true, max: 100 },
      { name: 'salt',     type: 'text', required: true, max: 100 },
      { name: 'pin_hash', type: 'text', required: true, max: 200 },
    ]),
    indexes: [
      'CREATE UNIQUE INDEX `idx_player_pins_name_key` ON `player_pins` (`name_key`)',
    ],
  },
  // `transactions` resolved at runtime since its relation needs the games id.
];

const recordCount = async (name) => {
  try {
    const r = await api('GET', `/api/collections/${name}/records?perPage=1`);
    return r.totalItems ?? 0;
  } catch (e) {
    if (e.status === 404) return 0;
    throw e;
  }
};

const tryGet = async (path) => {
  try {
    return await api('GET', path);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
};

const diffFields = (existing, expected) => {
  const haveTypes = new Map(existing.map((f) => [f.name, f.type]));
  const missing = [];
  const wrongType = [];
  for (const want of expected) {
    if (!haveTypes.has(want.name)) {
      missing.push(want.name);
      continue;
    }
    if (haveTypes.get(want.name) !== want.type) {
      wrongType.push({ name: want.name, got: haveTypes.get(want.name), want: want.type });
    }
  }
  return { missing, wrongType };
};

const ensureCollection = async (def) => {
  const existing = await tryGet(`/api/collections/${def.name}`);
  if (!existing) {
    console.log(`→ creating ${def.name}`);
    await api('POST', '/api/collections', def);
    console.log(`  ✓ created`);
    return;
  }

  const { missing, wrongType } = diffFields(existing.fields ?? [], def.fields);
  if (missing.length === 0 && wrongType.length === 0) {
    console.log(`✓ ${def.name} ok`);
    return;
  }

  console.log(`⚠ ${def.name} schema drift detected:`);
  if (missing.length) {
    const sysMissing = missing.filter((n) => SYSTEM_NAMES.has(n));
    const userMissing = missing.filter((n) => !SYSTEM_NAMES.has(n));
    if (sysMissing.length) console.log(`    missing system fields: ${sysMissing.join(', ')}`);
    if (userMissing.length) console.log(`    missing fields:        ${userMissing.join(', ')}`);
  }
  for (const w of wrongType) {
    console.log(`    wrong type for ${w.name}: have ${w.got}, want ${w.want}`);
  }

  const count = await recordCount(def.name);
  if (count > 0 && !FORCE) {
    console.error(
      `\n✗ ${def.name} has ${count} record(s) and the schema is incorrect.\n` +
      `   Recreating will DROP all data in this collection.\n` +
      `   Back up first (npm run db:backup), then re-run with --force, or\n` +
      `   fix the fields manually in the admin UI: ${PB_URL}/_/`,
    );
    process.exit(2);
  }

  console.log(`→ recreating ${def.name} (${count} record${count === 1 ? '' : 's'} will be dropped)`);
  await api('DELETE', `/api/collections/${def.name}`);
  await api('POST', '/api/collections', def);
  console.log(`  ✓ recreated`);
};

const buildTransactionsDef = async () => {
  const games = await tryGet('/api/collections/games');
  if (!games) throw new Error('games collection should exist by now');
  return {
    name: 'transactions',
    type: 'base',
    ...OPEN_RULES,
    fields: withSystem([
      {
        name: 'game',
        type: 'relation',
        required: true,
        collectionId: games.id,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 1,
      },
      { name: 'from_party', type: 'text',   required: true,  max: 60 },
      { name: 'to_party',   type: 'text',   required: true,  max: 60 },
      { name: 'amount',     type: 'number', required: true,  min: 0 },
      { name: 'kind',       type: 'text',   required: false, max: 20 },
      { name: 'note',       type: 'text',   required: false, max: 200 },
    ]),
    indexes: [
      'CREATE INDEX `idx_txns_game` ON `transactions` (`game`, `created`)',
    ],
  };
};

console.log(`PocketBase setup → ${PB_URL}`);
console.log(`auth as superuser…`);
await auth();
console.log(`  ok`);

for (const def of COLLECTIONS) await ensureCollection(def);
await ensureCollection(await buildTransactionsDef());

console.log('\nAll collections ready.');
console.log(`Admin UI: ${PB_URL}/_/`);
console.log(`Login:    ${EMAIL}`);
if (FORCE) console.log('(--force was set: any malformed collections were recreated)');
