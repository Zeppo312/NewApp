// Live checks against the isolated QA project. Creates disposable invitations,
// never subscription evidence or real store purchases. Credentials stay local.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { validateTarget } from '../family-qa.mjs';

const directory = new URL('../../.family-qa/', import.meta.url);
const target = JSON.parse(await readFile(new URL('target.local.json', directory)));
const accounts = JSON.parse(await readFile(new URL('accounts.local.json', directory)));
const { url } = validateTarget(target);
const tokens = [];
let passed = 0;
function check(name, condition) { assert.ok(condition, name); passed++; console.log(`PASS ${name}`); }
async function request(path, user, body, method = 'POST') {
  const response = await fetch(`${url}${path}`, {
    method, headers: { apikey: target.publicKey, 'Content-Type': 'application/json',
      ...(user == null ? {} : { Authorization: `Bearer ${tokens[user]}` }), Prefer: 'return=representation' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
for (const account of accounts) {
  const session = await request('/auth/v1/token?grant_type=password', null, { email: account.email, password: account.password });
  assert.equal(session.status, 200, 'QA login'); tokens.push(session.data.access_token);
}
const secrets = JSON.parse(await readFile(new URL('generated-secrets.local.json', directory)));
assert.ok(secrets.REVENUECAT_WEBHOOK_SIGNING_SECRET, 'Configure the actual QA webhook signing secret first');
const eventBody = JSON.stringify({ event: { id: `family-qa-${randomUUID()}`, type: 'TEST' } });
const now = Math.floor(Date.now() / 1000);
function signature(timestamp, body) {
  return `t=${timestamp},v1=${createHmac('sha256', secrets.REVENUECAT_WEBHOOK_SIGNING_SECRET).update(`${timestamp}.${body}`).digest('hex')}`;
}
async function webhook(authorization, signed, body = eventBody) {
  return fetch(`${url}/functions/v1/revenuecat-webhook`, {
    method: 'POST', headers: { Authorization: authorization, 'X-RevenueCat-Webhook-Signature': signed, 'Content-Type': 'application/json' }, body,
  });
}
check('webhook rejects wrong authorization', (await webhook('Bearer invalid', signature(now, eventBody))).status === 401);
check('webhook rejects changed payload', (await webhook(secrets.REVENUECAT_WEBHOOK_AUTHORIZATION, signature(now, eventBody), eventBody + ' ')).status === 401);
check('webhook rejects expired signature', (await webhook(secrets.REVENUECAT_WEBHOOK_AUTHORIZATION, signature(now - 600, eventBody))).status === 401);
check('webhook accepts valid signed test', (await webhook(secrets.REVENUECAT_WEBHOOK_AUTHORIZATION, signature(now, eventBody))).status === 200);
const duplicate = await webhook(secrets.REVENUECAT_WEBHOOK_AUTHORIZATION, signature(now, eventBody));
check('webhook identifies duplicate delivery', duplicate.status === 200 && (await duplicate.json()).duplicate === true);
const links = [];
try {
  const anonymous = await request('/functions/v1/family-subscription-access', null, {});
  check('anonymous family access denied', anonymous.status === 401);
  const repair = await request('/functions/v1/reconcile-family-subscriptions', 0, {});
  check('ordinary account cannot run reconciliation', repair.status === 401);
  const advisor = await request('/functions/v1/advisor-generate', 0, { mode: 'pregnancy', localDate: new Date().toISOString().slice(0, 10), signals: {} });
  check('actual advisor endpoint denies an unpaid account', advisor.status === 403 && advisor.data.error === 'Feature not unlocked');
  for (let i = 0; i < accounts.length; i++) {
    const own = await request('/functions/v1/family-subscription-access', i, { userId: accounts[(i + 1) % 4].userId });
    check(`account ${i + 1}: caller identity and no unearned access`, own.status === 200 && own.data.userId === accounts[i].userId && own.data.status === 'none');
  }
  const cache = await request('/rest/v1/lotti_subscription_entitlements?select=user_id', 0, undefined, 'GET');
  check('private subscription evidence cannot be read by clients', cache.status === 403);
  const forged = await request('/rest/v1/lotti_subscription_entitlements', 0, { user_id: accounts[0].userId, tier: 'premium' });
  check('client cannot forge premium evidence', forged.status === 403);
  const ownerLinks = await request('/rest/v1/account_links?status=eq.accepted&select=id', 0, undefined, 'GET');
  const recipientLinks = await request('/rest/v1/account_links?status=eq.accepted&select=id', 2, undefined, 'GET');
  assert.equal(ownerLinks.status, 200, 'read existing owner links');
  assert.equal(recipientLinks.status, 200, 'read existing recipient links');
  if (ownerLinks.data.length || recipientLinks.data.length) {
    console.log('SKIP invitation lifecycle: QA accounts already have accepted partner links.');
  } else {
    const invite = await request('/rest/v1/account_links', 0, { creator_id: accounts[0].userId, relationship_type: 'partner', invitation_code: 'client-chosen' });
    assert.equal(invite.status, 201, 'create invitation'); links.push({ id: invite.data[0].id, owner: 0 });
    check('server generates unpredictable invitation code', /^[0-9a-f]{32}$/.test(invite.data[0].invitation_code));
    const hidden = await request(`/rest/v1/account_links?id=eq.${links[0].id}`, 3, undefined, 'GET');
    check('unrelated account cannot enumerate invitation', hidden.status === 200 && hidden.data.length === 0);
    const mismatch = await request('/rest/v1/rpc/accept_invitation', 3, { invitation_id: links[0].id, user_id: accounts[2].userId });
    check('acceptance cannot impersonate another account', mismatch.status === 403);
    const accepted = await request('/rest/v1/rpc/accept_invitation_and_sync_due_date', 2, { invitation_id: links[0].id, p_user_id: accounts[2].userId });
    check('real acceptance wrapper succeeds', accepted.status === 200 && accepted.data.success === true);
    const family = await request('/functions/v1/family-subscription-access', 2, {});
    check('linked partner without a purchase remains unentitled', family.status === 200 && family.data.status === 'none');
    const second = await request('/rest/v1/account_links', 3, { creator_id: accounts[3].userId, relationship_type: 'partner', invitation_code: 'client-chosen' });
    assert.equal(second.status, 201); links.push({ id: second.data[0].id, owner: 3 });
    const chain = await request('/rest/v1/rpc/accept_invitation', 2, { invitation_id: links[1].id, user_id: accounts[2].userId });
    check('second simultaneous partner is denied', chain.status === 409 || chain.status === 403);
  }
} finally {
  for (const link of links.reverse()) {
    const cleanup = await request(`/rest/v1/account_links?id=eq.${link.id}`, link.owner, undefined, 'DELETE');
    assert.equal(cleanup.status, 200, 'disposable QA invitation cleanup');
  }
}
console.log(`${passed} live QA checks passed. No store purchases or paid evidence created.`);
