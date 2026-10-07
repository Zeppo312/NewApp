// Explicit, bounded provider test using only fresh synthetic identities.
// Run with Node 24 --experimental-transform-types to execute the actual TS helper.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { deleteRevenueCatCustomer } from '../supabase/functions/_shared/accountDeletion/revenuecat.ts';

const mode = process.argv.slice(2).join(' ');
if (!['--approved-synthetic-test','--recheck-synthetic-cleanup'].includes(mode)) throw new Error('Explicit synthetic-test authorization required.');
const target = JSON.parse(fs.readFileSync('.family-qa/target.local.json', 'utf8'));
if (target.projectRef !== 'ggyonianphloycmqrwvj') throw new Error('Wrong QA target.');
const secret = fs.readFileSync('.family-qa/deletion-completion-20260930/revenuecat.local.env', 'utf8').trim();
const match = secret.match(/^REVENUECAT_DELETION_API_KEY=(sk_[A-Za-z0-9_-]+)$/);
if (!match) throw new Error('Expected the protected dedicated QA key.');
const key = match[1]; const project = 'proj46375297';
const base = `https://api.revenuecat.com/v2/projects/${project}/customers`;
if (mode === '--recheck-synthetic-cleanup') {
  const path = 'output/deletion-completion-20260930/revenuecat-provider.json';
  const old = JSON.parse(fs.readFileSync(path,'utf8'));
  if (old.project !== project || !old.freshFixtureCreated || !old.controlPreserved ||
      !/^qa_delete_20260930_[a-f0-9-]{36}$/.test(old.fixture) || !/^qa_control_20260930_[a-f0-9-]{36}$/.test(old.control) ||
      !old.calls.some(c=>c.target==='control'&&c.method==='DELETE'&&c.status===200)) throw new Error('Expected the already acknowledged synthetic cleanup.');
  const checks = [];
  for (const [label,id] of [['fixture',old.fixture],['control',old.control]]) {
    const response = await fetch(`${base}/${id}`,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});
    checks.push({target:label,method:'GET',status:response.status,at:new Date().toISOString()});
  }
  old.cleanupRecheck = checks;
  old.controlCleanupVerified = checks[1].status === 404;
  old.deletedCustomerAbsent = checks[0].status === 404;
  old.passed = old.deletedCustomerAbsent && old.controlCleanupVerified && old.aliasesVerified && old.controlPreserved;
  old.workerPollingLimitObserved = old.errorCode === 'revenuecat_verification_pending';
  fs.writeFileSync(path,JSON.stringify(old,null,2)+'\n');
  console.log(JSON.stringify({passed:old.passed,deletedCustomerAbsent:old.deletedCustomerAbsent,controlCleanupVerified:old.controlCleanupVerified,workerPollingLimitObserved:old.workerPollingLimitObserved,checks},null,2));
  process.exit(old.passed ? 0 : 2);
}
const fixture = `qa_delete_20260930_${crypto.randomUUID()}`;
const control = `qa_control_20260930_${crypto.randomUUID()}`;
const allowed = new Set([fixture, control]); const calls = [];
const report = { checkedAt:new Date().toISOString(), project, supabaseSecretDestination:target.projectRef, fixture, control,
  freshFixtureCreated:false, aliasesVerified:false, deletedCustomerAbsent:false, controlPreserved:false, controlCleanupVerified:false,
  passed:false, limitation:'Provider API test with empty synthetic customers; no Store receipt, native app, or Supabase worker acceptance is proven.' };
const call = async (url, init = {}) => {
  if (url !== base && ![...allowed].some(id => url === `${base}/${id}` || url === `${base}/${id}/aliases`)) throw new Error('Non-fixture target refused.');
  const response = await fetch(url, {...init,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
  calls.push({target:url===base?'create':url.includes(control)?'control':'fixture',method:init.method??'GET',aliases:url.endsWith('/aliases'),status:response.status,at:new Date().toISOString()});
  return response;
};
const env = name => ({REVENUECAT_PROJECT_ID:project,REVENUECAT_DELETION_API_KEY:key}[name]);
try {
  for (const id of [fixture,control]) {
    const before = await call(`${base}/${id}`);
    if (before.status !== 404) throw new Error('Fresh identity absence could not be verified.');
    const created = await call(base,{method:'POST',body:JSON.stringify({id,attributes:[{name:'qa_fixture',value:'deletion-completion-20260930'}]})});
    if (created.status !== 201 || (await created.json()).id !== id) throw new Error(`Synthetic customer creation failed (${created.status}).`);
  }
  report.freshFixtureCreated = true;
  report.providerEvidence = await deleteRevenueCatCustomer(fixture,env,call);
  report.aliasesVerified = calls.some(c=>c.target==='fixture'&&c.aliases&&c.status===200);
  report.deletedCustomerAbsent = (await call(`${base}/${fixture}`)).status === 404;
  const kept = await call(`${base}/${control}`);
  report.controlPreserved = kept.status === 200 && (await kept.json()).id === control;
  if (!report.controlPreserved) throw new Error('Control customer preservation failed.');
  await deleteRevenueCatCustomer(control,env,call);
  report.controlCleanupVerified = (await call(`${base}/${control}`)).status === 404;
  report.passed = report.freshFixtureCreated && report.aliasesVerified && report.deletedCustomerAbsent && report.controlPreserved && report.controlCleanupVerified;
} catch (error) {
  report.errorCode = /^[a-z_]+$/.test(error.code??'') ? error.code : error.message;
  process.exitCode = 2;
} finally {
  report.calls = calls;
  fs.writeFileSync('output/deletion-completion-20260930/revenuecat-provider.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
