import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=new URL('../supabase/hotfixes/subscription-tier/',import.meta.url);
const text=async path=>readFile(path,'utf8');
assert.equal(await text(new URL('supabase/functions/_shared/revenuecatState.ts',base)),await text(new URL('../supabase/functions/_shared/revenuecatState.ts',import.meta.url)),'Hotfix must share canonical product resolver and legacy-cache guard');
const baseline=JSON.parse(await text(new URL('baseline-sha256.json',base)));
for(const [name,files] of Object.entries(baseline))for(const [path,hash] of Object.entries(files)){
  if(path==='_shared/premiumAccess.ts'||name==='revenuecat-webhook')continue;
  assert.equal(createHash('sha256').update(await readFile(new URL(`supabase/functions/${path}`,base))).digest('hex'),hash,`Unexpected live feature change: ${path}`);
}
const adapter=await text(new URL('supabase/functions/_shared/premiumAccess.ts',base));
assert.doesNotMatch(adapter,/paid_[a-z]|accountDeletion|familySharingEnvironment|\.rpc\(/);
assert.match(adapter,/cachedSubscriptionTier\(cached\)/);
assert.match(adapter,/\.eq\('checked_at', previous.checked_at\)/);
const settings=await text(new URL('supabase/config.toml',base));
for(const metadata of JSON.parse(await text(new URL('deployments-before.json',base)))){
  assert.ok(settings.includes(`[functions.${metadata.slug}]\nverify_jwt = ${metadata.verify_jwt}`));
}
console.log('Hotfix provenance, canonical resolver, old-schema isolation and JWT settings verified.');
