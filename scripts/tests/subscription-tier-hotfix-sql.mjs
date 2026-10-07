// Runs the EXACT deployable resolver against the captured eight-column production
// schema in isolated PostgreSQL (PGlite). Never accepts a network DB URL.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const temp = await mkdtemp(join(tmpdir(), 'lotti-hotfix-test-'));
const base = new URL('../../supabase/hotfixes/subscription-tier/', import.meta.url);
const schema = JSON.parse(await readFile(new URL('production-schema.json', base)));
for (const name of ['revenuecatState', 'premiumAccess']) {
  const source = await readFile(new URL(`supabase/functions/_shared/${name}.ts`, base), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}}).outputText;
  await writeFile(join(temp, `${name}.mjs`), compiled.replaceAll('./revenuecatState.ts', './revenuecatState.mjs'));
}
const {syncRevenueCatTier, verifySubscriptionFeatureAccess} = await import(pathToFileURL(join(temp, 'premiumAccess.mjs')));
const user = '11111111-1111-4111-8111-111111111111';
const config = {premium: 'entl7a7b4e9838'};
let assertions = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
// Minimal PostgREST protocol adapter: all filtering and mutations execute in SQL.
const identifier = value => { assert.match(value, /^[a-z_]+$/); return `"${value}"`; };
const admin = {from(table) {
  let op = 'select', fields = '*', row, options, single = false;
  const filters = [];
  const query = {
    select(value) { fields = value; return query; },
    eq(key, value) { filters.push([key, value]); return query; },
    maybeSingle() { single = true; return query; },
    update(value) { op = 'update'; row = value; return query; },
    upsert(value, opts) { op = 'insert'; row = value; options = opts; return query; },
    async then(done, reject) {
      try {
        const args = [], bind = value => {args.push(value); return `$${args.length}`;};
        const cols = fields === '*' ? '*' : fields.split(',').map(x => identifier(x.trim())).join(',');
        let sql;
        if (op === 'insert') {
          const keys = Object.keys(row);
          assert.equal(options?.ignoreDuplicates, true);
          sql = `INSERT INTO ${identifier(table)} (${keys.map(identifier)}) VALUES (${keys.map(k => bind(row[k]))}) ON CONFLICT (user_id) DO NOTHING RETURNING ${cols}`;
        } else {
          const action = op === 'select' ? `SELECT ${cols} FROM` : 'UPDATE';
          sql = `${action} ${identifier(table)}`;
          if (op === 'update') sql += ' SET ' + Object.entries(row).map(([k,v]) => `${identifier(k)}=${bind(v)}`).join(',');
          if (filters.length) sql += ' WHERE ' + filters.map(([k,v]) => `${identifier(k)}=${bind(v)}`).join(' AND ');
          if (op === 'update') sql += ` RETURNING ${cols}`;
        }
        const {rows} = await db.query(sql, args);
        // Match Supabase's JSON timestamptz representation rather than JS Date.
        for (const value of rows) for (const [k,v] of Object.entries(value)) if (v instanceof Date) value[k] = v.toISOString();
        return done({data: single ? rows[0] ?? null : rows, error: null});
      } catch (error) { return done({data: null, error}); }
    },
  };
  return query;
}};
const originalFetch = globalThis.fetch;
let tier = 'lite', store = 'play_store', interval = 'monthly', active = true, failure = 0;
let pause, started;
const product = () => store === 'play_store' ? `lottibaby_${tier}:${interval}` : `${tier === 'standard' ? 'lottibaby' : `lottibaby_${tier}`}_${interval}`;
const end = () => Date.now() + 3600000;
globalThis.fetch = async url => {
  if (failure) return new Response('', {status: failure});
  if (String(url).includes('active_entitlements')) {
    const payload = {items: active ? [{entitlement_id: config.premium, expires_at: end()}] : []};
    return Response.json(payload);
  }
  if (String(url).includes('/subscriptions')) return Response.json({items: [{product_id:'product',store,gives_access:active,ends_at:end(),entitlements:{items:[{id:config.premium}]}}]});
  const payload = {id:'product',store_identifier:product()};
  if (pause) { const wait = pause; pause = null; started(); await wait; }
  return Response.json(payload);
};
const sync = () => syncRevenueCatTier(admin,user,'test','project',config,'revenuecat_webhook');
const verify = () => verifySubscriptionFeatureAccess(admin,user,'fragLotti','test','project',config);
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA caretaker_private; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${user}');
    CREATE TABLE profiles(id uuid PRIMARY KEY,is_admin boolean,paywall_access_role text);
    INSERT INTO profiles VALUES ('${user}',false,null);
    CREATE TABLE subscription_plan_features(feature_key text,plan_key text,enabled boolean);
    INSERT INTO subscription_plan_features VALUES ('fragLotti','lite',false),('fragLotti','standard',false),('fragLotti','premium',true);`);
  const definitions = schema.columns.map(c => `${identifier(c.name)} ${c.type} ${c.nullable === 'NO' ? 'NOT NULL' : ''} ${c.default ? `DEFAULT ${c.default}` : ''}`);
  await db.exec(`CREATE TABLE lotti_subscription_entitlements (${[...definitions,...schema.constraints].join(',')});
    ALTER TABLE lotti_subscription_entitlements ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON lotti_subscription_entitlements FROM PUBLIC,anon,authenticated;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20260924064154_subscription_tier_cache_guard.sql',import.meta.url),'utf8'));
  for (store of ['app_store','play_store']) for (tier of ['lite','standard','premium']) for (interval of ['monthly','yearly']) {
    const state = await sync();
    check(state.tier,tier); check(state.productId,product());
    const row = (await db.query('SELECT * FROM lotti_subscription_entitlements')).rows[0];
    check(Object.keys(row).sort(),schema.columns.map(c=>c.name).sort());
    check(row.is_premium,tier==='premium');
    check((await verify()).allowed,tier==='premium');
    check((await db.query(`SELECT caretaker_private.has_premium('${user}') AS allowed`)).rows[0].allowed,tier==='premium');
  }
  for (const id of ['entl7a7b4e9838','LottiBabyAbo']) {
    await db.query("UPDATE lotti_subscription_entitlements SET product_id=$1,checked_at=now(),tier='premium',is_premium=true",[id]);
    const before = (await db.query('SELECT * FROM lotti_subscription_entitlements')).rows[0];
    for (failure of [401,403,404,429,500]) {
      check((await verify()).allowed,false);
      check((await db.query('SELECT * FROM lotti_subscription_entitlements')).rows[0],before);
    }
    check((await db.query(`SELECT caretaker_private.has_premium('${user}') AS allowed`)).rows[0].allowed,false);
  }
  failure=0; active=false; await sync(); check((await verify()).allowed,false);
  active=true; tier='premium'; check((await verify()).allowed,true); // restore negative cache
  await db.exec("UPDATE lotti_subscription_entitlements SET expires_at=now()-interval '1 second'");
  failure=503; check((await verify()).allowed,false);
  failure=0; check((await verify()).allowed,true); // renewal beyond previous expiry
  // Real SQL compare-and-set: a late request cannot overwrite an intervening revoke.
  let release;
  const hasStarted = new Promise(resolve => {started=resolve;});
  pause = new Promise(resolve => {release=resolve;});
  const slow = sync(); await hasStarted;
  active=false; await sync(); release();
  check((await slow).tier,null);
  check((await db.query('SELECT tier FROM lotti_subscription_entitlements')).rows[0].tier,null);
  check((await db.query("SELECT has_function_privilege('authenticated','caretaker_private.has_premium(uuid)','EXECUTE') AS allowed")).rows[0].allowed,false);
  console.log(`${assertions} assertions passed: exact hotfix code + captured production schema (isolated PostgreSQL/PGlite).`);
} finally {globalThis.fetch=originalFetch; await db.close(); await rm(temp,{recursive:true,force:true});}
