// Run with: NODE_PATH=/path/to/pglite/node_modules node scripts/tests/caretaker-access.mjs
// PGlite is a test-only PostgreSQL runtime, installed outside the app dependencies.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const owner = '00000000-0000-4000-a000-000000000001';
const grandma = '00000000-0000-4000-a000-000000000002';
const stranger = '00000000-0000-4000-a000-000000000003';
const baby = '00000000-0000-4000-b000-000000000001';
const otherBaby = '00000000-0000-4000-b000-000000000002';
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid primary key);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
  INSERT INTO auth.users VALUES ('${owner}'), ('${grandma}'), ('${stranger}');
  CREATE TABLE public.profiles (id uuid primary key, is_admin boolean default false, paywall_access_role text);
  CREATE TABLE public.lotti_subscription_entitlements (user_id uuid primary key, tier text, is_premium boolean, expires_at timestamptz);
  INSERT INTO public.profiles (id) VALUES ('${owner}'), ('${grandma}'), ('${stranger}');
  INSERT INTO public.lotti_subscription_entitlements VALUES ('${owner}', 'premium', true, now() + interval '1 day');
  CREATE TABLE public.custom_activity_types (id uuid primary key default gen_random_uuid(), baby_id uuid, name text, emoji text, color text, tracking_mode text, unit text, default_quantity numeric, is_archived boolean default false);
  CREATE TABLE public.baby_info (id uuid primary key, user_id uuid, name text);
  INSERT INTO public.baby_info VALUES ('${baby}', '${owner}', 'Test baby'), ('${otherBaby}', '${stranger}', 'Other baby');
  CREATE TABLE public.baby_members (baby_id uuid, user_id uuid, role text);
  CREATE TABLE public.sleep_entries (id uuid primary key default gen_random_uuid(), baby_id uuid, user_id uuid, created_by uuid NOT NULL DEFAULT auth.uid(),
    start_time timestamptz, end_time timestamptz, duration_minutes int, quality text, notes text, updated_at timestamptz);
  CREATE TABLE public.baby_care_entries (id uuid primary key default gen_random_uuid(), baby_id uuid, user_id uuid,
    entry_type text, start_time timestamptz, end_time timestamptz, notes text, feeding_type text, feeding_volume_ml int, diaper_type text,
    custom_activity_type_id uuid, custom_color text, custom_tracking_mode text, custom_name text, custom_emoji text, custom_quantity numeric, custom_unit text);
  ALTER TABLE public.baby_info ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.sleep_entries ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.baby_care_entries ENABLE ROW LEVEL SECURITY;
  CREATE POLICY own_sleep ON public.sleep_entries TO authenticated USING (user_id = auth.uid());
  CREATE POLICY own_care ON public.baby_care_entries TO authenticated USING (user_id = auth.uid());
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.sleep_entries, public.baby_care_entries TO authenticated;
`);
const migrationName = readdirSync(new URL('../../supabase/migrations/', import.meta.url)).find(n => n.endsWith('_caretaker_access.sql'));
await db.exec(readFileSync(new URL(`../../supabase/migrations/${migrationName}`, import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../../supabase/migrations/20260909191149_caretaker_guest_access.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../../supabase/migrations/20260909200824_caretaker_shared_tracking_inputs.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../../supabase/migrations/20260909204107_caretaker_entry_editing.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../../supabase/migrations/20260910045915_caretaker_premium_custom_activities.sql', import.meta.url), 'utf8'));
let count = 0;
const token = 'a'.repeat(64);
const otherToken = 'b'.repeat(64);
async function asUser(id) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id || '']);
  await db.exec(id ? 'SET ROLE authenticated' : 'SET ROLE anon');
}
async function rpc(action, payload = {}) {
  const { rows } = await db.query('SELECT public.caretaker_access($1, $2::jsonb) AS result', [action, JSON.stringify(payload)]);
  return rows[0].result;
}
async function guest(action, payload = {}, credential = token) {
  await asUser(null);
  const { rows } = await db.query('SELECT public.caretaker_guest($1, $2::jsonb, $3) AS result', [action, JSON.stringify(payload), credential]);
  return rows[0].result;
}
async function test(name, fn) { await fn(); count++; console.log(`PASS ${name}`); }
const now = Date.now();
const input = { baby_id: baby, label: 'Grandma', starts_at: new Date(now - 3600_000).toISOString(), ends_at: new Date(now + 3600_000).toISOString(), history_days: 2, allow_entries: true };
async function createGrant(overrides = {}) { await asUser(owner); return rpc('create', { ...input, ...overrides }); }
let grant;
await test('anonymous caller cannot manage invitations', async () => {
  await asUser(null); await assert.rejects(() => rpc('list'), /permission denied/);
  await assert.rejects(() => guest('create', input), /invalid_action/);
});
await test('stranger cannot invite themselves to another baby', async () => {
  await asUser(stranger); await assert.rejects(() => rpc('create', input), /not_allowed/);
});
await test('owner can create finite, baby-specific invitation without revealing session hashes', async () => {
  grant = await createGrant(); assert.match(grant.invitation_code, /^[a-f0-9]{32}$/);
  assert.equal(grant.guest_token_hash, undefined);
});
await test('invalid dates and history bounds are rejected', async () => {
  await assert.rejects(() => createGrant({ history_days: 3 }));
  await assert.rejects(() => createGrant({ ends_at: input.starts_at }));
  await assert.rejects(() => createGrant({ ends_at: 'infinity' }));
});
await test('unclaimed token and invitation code alone cannot read data', async () => {
  await assert.rejects(() => guest('read', { grant_id: grant.id }), /invalid_guest_session/);
  await assert.rejects(() => guest('read', {}, grant.invitation_code), /invalid_guest_session/);
  await assert.rejects(() => guest('read', {}, null), /invalid_guest_session/);
});
await test('guest claims code without an auth account and can recover a lost response', async () => {
  assert.equal((await guest('accept', { code: grant.invitation_code.toUpperCase().match(/.{4}/g).join(' - ') })).id, grant.id);
  assert.equal((await guest('accept', { code: grant.invitation_code })).id, grant.id);
  await assert.rejects(() => guest('accept', { code: grant.invitation_code }, otherToken), /invalid_invitation/);
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM auth.users')).rows[0].n, 3);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.baby_members')).rows[0].n, 0);
  const stored = (await db.query('SELECT * FROM caretaker_private.grants WHERE id = $1', [grant.id])).rows[0];
  assert.ok(stored.accepted_at); assert.equal(stored.caregiver_id, null);
  assert.notEqual(stored.guest_token_hash, token);
});
await test('accepted invitation is hidden from parent list and old account accept is disabled', async () => {
  await asUser(owner); const items = await rpc('list');
  assert.equal(items[0].invitation_code, null); assert.equal(items[0].guest_token_hash, undefined);
  await asUser(grandma);
  assert.deepEqual(await rpc('list'), []);
  await assert.rejects(() => rpc('accept', { code: grant.invitation_code }), /invalid_action/);
  await assert.rejects(() => rpc('read', { grant_id: grant.id }), /invalid_action/);
});
await test('guest cannot read source tables or grants directly, or revoke access', async () => {
  await asUser(null);
  for (const table of ['caretaker_private.grants', 'public.sleep_entries', 'public.baby_care_entries', 'public.baby_info', 'public.custom_activity_types']) {
    await assert.rejects(() => db.query(`SELECT * FROM ${table}`), /permission denied/);
  }
  await assert.rejects(() => db.query('SELECT caretaker_private.has_premium($1)', [owner]), /permission denied/);
  await assert.rejects(() => guest('revoke', { grant_id: grant.id }), /invalid_action/);
});
await db.exec('RESET ROLE');
const start = Date.parse(input.starts_at);
for (const [babyId, timestamp, label] of [
  [baby, start - 2 * 86400_000 - 1, 'outside history'],
  [baby, start - 2 * 86400_000, 'history boundary'],
  [baby, start + 1, 'inside'],
  [baby, Date.parse(input.ends_at), 'end boundary'],
  [otherBaby, start + 1, 'other baby'],
]) {
  await db.query('INSERT INTO public.sleep_entries (baby_id,user_id,created_by,start_time,end_time,notes) VALUES ($1,$2,$2,$3,$3,$4)', [babyId, owner, new Date(timestamp).toISOString(), label]);
  await db.query("INSERT INTO public.baby_care_entries (baby_id,user_id,entry_type,start_time,notes) VALUES ($1,$2,'diaper',$3,$4)", [babyId, owner, new Date(timestamp).toISOString(), label]);
}
await test('only allowed baby and exact history window are returned', async () => {
  const data = await guest('read', { grant_id: grant.id, baby_id: otherBaby, history_days: 999 });
  assert.deepEqual(data.sleep.map(x => x.notes).sort(), ['history boundary', 'inside']);
  assert.deepEqual(data.daily.map(x => x.notes).sort(), ['history boundary', 'inside']);
  assert.equal(data.sleep[0].user_id, undefined); assert.equal(data.sleep[0].baby_id, undefined);
  assert.equal(data.invitation_code, undefined); assert.equal(data.guest_token_hash, undefined);
  await assert.rejects(() => guest('read', { grant_id: otherBaby }), /invalid_guest_session/);
});
await test('guest can write without auth.uid and cannot choose another baby or account', async () => {
  const entry = await guest('write', { grant_id: grant.id, command: 'bottle', volume_ml: 120, notes: 'Test', baby_id: otherBaby, user_id: stranger });
  assert.equal((await guest('read')).daily[0].feeding_volume_ml, 120);
  await db.exec('RESET ROLE');
  const row = (await db.query('SELECT * FROM public.baby_care_entries WHERE id = $1', [entry.id])).rows[0];
  assert.equal(row.user_id, owner); assert.equal(row.baby_id, baby);
  await assert.rejects(() => guest('write', { command: 'bottle' }), /invalid_volume/);
  await assert.rejects(() => guest('write', { command: 'bottle', volume_ml: -1 }), /invalid_volume/);
  await assert.rejects(() => guest('write', { command: 'delete' }), /invalid_command/);
});
await test('sleep start/stop works without an auth account; duplicate starts rejected', async () => {
  const sleep = await guest('write', { command: 'sleep_start' });
  await assert.rejects(() => guest('write', { command: 'sleep_start' }), /sleep_already_running/);
  await guest('write', { command: 'sleep_stop', entry_id: sleep.id });
  const row = (await guest('read')).sleep.find(e => e.id === sleep.id);
  assert.ok(row.end_time);
});
await test('manual input saves exact in-period times and rejects history or future writes', async () => {
  const entryStart = new Date(now - 120000).toISOString();
  const entryEnd = new Date(now - 60000).toISOString();
  const entry = await guest('write', { command: 'sleep_add', start_time: entryStart, end_time: entryEnd, quality: 'good', notes: 'manual sleep' });
  const row = (await guest('read')).sleep.find(x => x.id === entry.id);
  assert.equal(Date.parse(row.start_time), Date.parse(entryStart));
  assert.equal(Date.parse(row.end_time), Date.parse(entryEnd));
  const feeding = await guest('write', { command: 'bottle', volume_ml: 150, start_time: entryStart, end_time: entryEnd });
  assert.equal(Date.parse((await guest('read')).daily.find(x => x.id === feeding.id).start_time), Date.parse(entryStart));
  for (const command of ['sleep_add', 'diaper_wet']) {
    await assert.rejects(() => guest('write', { command, start_time: new Date(start - 1).toISOString() }), /invalid_entry_period/);
    await assert.rejects(() => guest('write', { command, start_time: new Date(now + 600000).toISOString() }), /invalid_entry_period/);
    await assert.rejects(() => guest('write', { command, start_time: entryStart, end_time: new Date(now - 180000).toISOString() }), /invalid_entry_period/);
  }
});
await test('sleep works on deployed schema without created_by as well as the legacy schema', async () => {
  await db.exec('RESET ROLE; ALTER TABLE public.sleep_entries DROP COLUMN created_by;');
  const entry = await guest('write', { command: 'sleep_start' });
  await guest('write', { command: 'sleep_stop', entry_id: entry.id });
  assert.ok((await guest('read')).sleep.find(x => x.id === entry.id).end_time);
});
await test('history cannot be edited', async () => {
  const row = (await guest('read')).sleep.find(e => e.notes === 'history boundary');
  await assert.rejects(() => guest('write', { command: 'sleep_stop', entry_id: row.id }), /entry_not_editable/);
});
await test('own entries expose edit permission and retain their IDs when corrected', async () => {
  const startTime = new Date(now - 180000).toISOString();
  const endTime = new Date(now - 60000).toISOString();
  const sleep = await guest('write', { command: 'sleep_add', start_time: startTime, end_time: endTime, quality: 'good' });
  const bottle = await guest('write', { command: 'bottle', volume_ml: 120, start_time: startTime });
  let data = await guest('read');
  assert.equal(data.sleep.find(e => e.id === sleep.id).can_edit, true);
  assert.equal(data.daily.find(e => e.id === bottle.id).can_edit, true);
  assert.equal(data.sleep.find(e => e.notes === 'inside').can_edit, false);
  await guest('write', { command: 'sleep_update', entry_id: sleep.id, start_time: startTime, end_time: endTime, quality: 'medium', notes: 'corrected sleep' });
  await guest('write', { command: 'daily_update', entry_id: bottle.id, entry_type: 'feeding', feeding_type: 'BOTTLE', volume_ml: 150, start_time: startTime, notes: 'corrected bottle' });
  data = await guest('read');
  assert.equal(data.sleep.find(e => e.id === sleep.id).quality, 'medium');
  assert.equal(data.daily.find(e => e.id === bottle.id).feeding_volume_ml, 150);
  assert.equal(data.daily.find(e => e.id === bottle.id).notes, 'corrected bottle');
  await guest('write', { command: 'sleep_delete', entry_id: sleep.id });
  await guest('write', { command: 'daily_delete', entry_id: bottle.id });
  data = await guest('read');
  assert.ok(!data.sleep.some(e => e.id === sleep.id)); assert.ok(!data.daily.some(e => e.id === bottle.id));
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM caretaker_private.entry_authors WHERE sleep_entry_id=$1 OR daily_entry_id=$2', [sleep.id, bottle.id])).rows[0].n, 0);
});
await test('parent and other guest entries cannot be changed or deleted even with forged payloads', async () => {
  const other = await createGrant(); const anotherToken = 'f'.repeat(64);
  await guest('accept', { code: other.invitation_code }, anotherToken);
  const foreign = await guest('write', { command: 'diaper_wet' }, anotherToken);
  const parentSleep = (await guest('read')).sleep.find(e => e.notes === 'inside');
  const parentDaily = (await guest('read')).daily.find(e => e.notes === 'inside');
  for (const [command, id] of [['sleep_delete', parentSleep.id], ['sleep_update', parentSleep.id], ['daily_delete', parentDaily.id], ['daily_update', parentDaily.id], ['daily_delete', foreign.id], ['daily_update', foreign.id]]) {
    await assert.rejects(() => guest('write', { command, entry_id: id, can_edit: true, author_grant_id: grant.id }), /entry_not_editable/);
  }
  assert.equal((await guest('read')).daily.find(e => e.id === foreign.id).can_edit, false);
  await asUser(null); await assert.rejects(() => db.query('SELECT * FROM caretaker_private.entry_authors'), /permission denied/);
});
await test('corrections cannot move entries into the read-only history or create invalid running timers', async () => {
  const ended = await guest('write', { command: 'sleep_add', start_time: new Date(now - 120000).toISOString(), end_time: new Date(now - 60000).toISOString() });
  await assert.rejects(() => guest('write', { command: 'sleep_update', entry_id: ended.id, start_time: new Date(start - 1).toISOString() }), /invalid_entry_period/);
  const running = await guest('write', { command: 'sleep_start' });
  await assert.rejects(() => guest('write', { command: 'sleep_update', entry_id: ended.id, start_time: new Date(now - 60000).toISOString(), end_time: null }), /sleep_already_running/);
  await guest('write', { command: 'sleep_delete', entry_id: running.id });
});
await test('read-only grant blocks writes', async () => {
  const readOnly = await createGrant({ allow_entries: false });
  await guest('accept', { code: readOnly.invitation_code }, otherToken);
  await guest('read', {}, otherToken);
  await assert.rejects(() => guest('write', { command: 'diaper_wet' }, otherToken), /read_only/);
  await assert.rejects(() => guest('write', { command: 'daily_delete', entry_id: grant.id }, otherToken), /read_only/);
});
await test('future care can be accepted but cannot be read or written early', async () => {
  const future = await createGrant({ starts_at: new Date(now + 1800_000).toISOString() });
  const futureToken = 'c'.repeat(64);
  await guest('accept', { code: future.invitation_code }, futureToken);
  await assert.rejects(() => guest('read', {}, futureToken), /access_inactive/);
  await assert.rejects(() => guest('write', { command: 'diaper_wet' }, futureToken), /access_inactive/);
});
await test('removing the inviting parent also invalidates guest access', async () => {
  await db.exec('RESET ROLE');
  await db.query("INSERT INTO public.baby_members VALUES ($1, $2, 'parent')", [otherBaby, owner]);
  const delegated = await createGrant({ baby_id: otherBaby });
  const delegatedToken = 'd'.repeat(64);
  await guest('accept', { code: delegated.invitation_code }, delegatedToken);
  await guest('read', {}, delegatedToken);
  await db.exec('RESET ROLE'); await db.query('DELETE FROM public.baby_members WHERE baby_id = $1 AND user_id = $2', [otherBaby, owner]);
  await assert.rejects(() => guest('read', {}, delegatedToken), /access_inactive/);
});
await test('custom event, quantity and duration definitions stay scoped to the invited baby', async () => {
  await db.exec('RESET ROLE');
  const definitions = (await db.query(`INSERT INTO public.custom_activity_types (baby_id, name, emoji, color, tracking_mode, unit, default_quantity, is_archived)
    VALUES ($1,'Baden','🛁','#123456','event',null,null,false),
      ($1,'Spielezeit','🧸','#654321','duration',null,null,false),
      ($1,'Trinken','🥤','#123456','quantity','ml',100,false),
      ($1,'Archiv','✨','#123456','event',null,null,true),
      ($2,'Fremdes Baby','✨','#123456','event',null,null,false) RETURNING *`, [baby, otherBaby])).rows;
  const data = await guest('read');
  assert.deepEqual(data.custom_activities.map(a => a.name).sort(), ['Baden', 'Spielezeit', 'Trinken']);
  assert.equal(data.custom_activities[0].baby_id, undefined);
  for (const definition of definitions.slice(0, 3)) {
    const entry = await guest('write', { command: 'custom', custom_activity_type_id: definition.id,
      start_time: new Date(now - 60000).toISOString(), custom_quantity: 125, custom_name: 'forged', baby_id: otherBaby });
    const row = (await guest('read')).daily.find(e => e.id === entry.id);
    assert.equal(row.custom_name, definition.name);
    assert.equal(row.custom_color, definition.color);
    assert.equal(row.custom_tracking_mode, definition.tracking_mode);
    assert.equal(row.can_edit, true);
    assert.equal(row.custom_quantity, definition.tracking_mode === 'quantity' ? '125' : null);
    assert.equal(row.end_time === null, definition.tracking_mode === 'duration');
    await guest('write', { command: 'custom_update', entry_id: entry.id, start_time: row.start_time,
      end_time: new Date(now - 1000).toISOString(), custom_quantity: 150, notes: 'updated' });
    assert.equal((await guest('read')).daily.find(e => e.id === entry.id).notes, 'updated');
    await guest('write', { command: 'daily_delete', entry_id: entry.id });
    assert.ok(!(await guest('read')).daily.some(e => e.id === entry.id));
  }
  const readonly = await createGrant({ allow_entries: false });
  const readonlyToken = '8'.repeat(64);
  await guest('accept', { code: readonly.invitation_code }, readonlyToken);
  assert.equal((await guest('read', {}, readonlyToken)).custom_activities.length, 3);
  await assert.rejects(() => guest('write', { command: 'custom', custom_activity_type_id: definitions[0].id }, readonlyToken), /read_only/);
  await assert.rejects(() => guest('write', { command: 'custom', custom_activity_type_id: definitions[0].id, start_time: new Date(start - 1).toISOString() }), /invalid_entry_period/);
  for (const definition of definitions.slice(3)) {
    await assert.rejects(() => guest('write', { command: 'custom', custom_activity_type_id: definition.id }), /activity_not_available/);
  }
  for (const quantity of [null, 0, -1, 'NaN', 'Infinity', 1000000000]) {
    await assert.rejects(() => guest('write', { command: 'custom', custom_activity_type_id: definitions[2].id, custom_quantity: quantity }), /invalid_quantity/);
  }
  const own = await guest('write', { command: 'custom', custom_activity_type_id: definitions[0].id });
  await db.exec('RESET ROLE');
  await db.query('UPDATE public.custom_activity_types SET is_archived = true WHERE id = $1', [definitions[0].id]);
  const row = (await guest('read')).daily.find(e => e.id === own.id);
  await guest('write', { command: 'custom_update', entry_id: own.id, start_time: row.start_time, notes: 'archived correction' });
  const other = await createGrant(); const foreignToken = '9'.repeat(64);
  await guest('accept', { code: other.invitation_code }, foreignToken);
  await assert.rejects(() => guest('write', { command: 'custom_update', entry_id: own.id, start_time: row.start_time }, foreignToken), /entry_not_editable/);
});
await test('Premium belongs to the inviting parent; trials and standard cannot create care', async () => {
  for (const tier of [null, 'lite', 'standard']) {
    await db.exec('RESET ROLE');
    await db.query('UPDATE public.lotti_subscription_entitlements SET tier=$1, is_premium=false WHERE user_id=$2', [tier, owner]);
    await assert.rejects(() => createGrant(), /premium_required/);
    await assert.rejects(() => guest('read'), /access_inactive/);
    await assert.rejects(() => guest('write', { command: 'diaper_wet' }), /access_inactive/);
  }
  await db.exec('RESET ROLE');
  await db.query("UPDATE public.lotti_subscription_entitlements SET tier='premium', is_premium=true, expires_at=now() - interval '1 second' WHERE user_id=$1", [owner]);
  await assert.rejects(() => createGrant(), /premium_required/);
  await db.exec('RESET ROLE');
  await db.query("UPDATE public.profiles SET paywall_access_role='premium_tester' WHERE id=$1", [owner]);
  const special = await createGrant();
  assert.ok(special.id);
  await db.exec('RESET ROLE');
  await db.query("UPDATE public.profiles SET paywall_access_role=null WHERE id=$1", [owner]);
  await db.query("UPDATE public.lotti_subscription_entitlements SET expires_at=now() + interval '1 day' WHERE user_id=$1", [owner]);
  await guest('read');
});
await test('revocation immediately blocks reads, writes and code reuse', async () => {
  await asUser(owner); await rpc('revoke', { grant_id: grant.id });
  await assert.rejects(() => guest('read'), /access_inactive/);
  await assert.rejects(() => guest('write', { command: 'diaper_wet' }), /access_inactive/);
  await assert.rejects(() => guest('write', { command: 'sleep_update', entry_id: grant.id }), /access_inactive/);
  await assert.rejects(() => guest('write', { command: 'daily_delete', entry_id: grant.id }), /access_inactive/);
  await assert.rejects(() => guest('accept', { code: grant.invitation_code }), /invalid_invitation/);
});
await test('expiry blocks access without a cron job', async () => {
  const expired = await createGrant(); const expiredToken = 'e'.repeat(64);
  await guest('accept', { code: expired.invitation_code }, expiredToken);
  await db.exec('RESET ROLE'); await db.query("UPDATE caretaker_private.grants SET ends_at = clock_timestamp() - interval '1 second' WHERE id = $1", [expired.id]);
  await assert.rejects(() => guest('read', {}, expiredToken), /access_inactive/);
  await assert.rejects(() => guest('write', { command: 'sleep_start' }, expiredToken), /access_inactive/);
});
console.log(`${count} PostgreSQL integration checks passed.`);
await db.close();
