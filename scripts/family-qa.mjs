// Local setup helper. Never accepts the production project; no build/deploy command.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { resolveBackendEnvironment } from '../lib/backendEnvironment.js';

const directory = fileURLToPath(new URL('../.family-qa/',import.meta.url));
const targetPath = `${directory}/target.local.json`;
const accountsPath = `${directory}/accounts.local.json`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const save = (path,data) => writeFile(path,typeof data==='string'?data:JSON.stringify(data,null,2)+'\n',{mode:0o600});
const exists = path => access(path).then(()=>true,()=>false);

export function validateTarget(target, requireService = false) {
  const result = resolveBackendEnvironment('family-qa',`https://${target.projectRef}.supabase.co`,target.publicKey,target.projectRef);
  if (requireService && !target.serviceKey) throw new Error('Test project serviceKey missing');
  return result;
}

export async function seedTestAccounts(target, accounts, request = fetch, persist = async () => {}) {
  const {url} = validateTarget(target,true);
  const api = async (path,body,method='POST') => {
    const response = await request(`${url}${path}`,{
      method,headers:{Authorization:`Bearer ${target.serviceKey}`,apikey:target.serviceKey,'Content-Type':'application/json'},
      ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    });
    if (!response.ok) throw new Error(`QA API request failed (${response.status}); details omitted to protect credentials`);
    return response.json();
  };
  for (const account of accounts) {
    if (!account.userId) {
      // Recover if a prior run created the user but stopped before saving its ID.
      const loginResponse = await request(`${url}/auth/v1/token?grant_type=password`,{
        method:'POST',headers:{apikey:target.publicKey,'Content-Type':'application/json'},
        body:JSON.stringify({email:account.email,password:account.password}),
      });
      if (loginResponse.ok) {
        const login = await loginResponse.json();
        account.userId = login.user?.id;
      } else {
        if (loginResponse.status !== 400) throw new Error(`QA login check failed (${loginResponse.status})`);
        const created = await api('/auth/v1/admin/users',{
          email:account.email,password:account.password,email_confirm:true,
          user_metadata:{first_name:account.label},
        });
        account.userId = created.id;
      }
      if (!uuid.test(account.userId ?? '')) throw new Error('Invalid QA account response');
      await persist(accounts);
    }
    if (!uuid.test(account.userId)) throw new Error('Invalid saved QA user ID');
    const profiles = await api(`/rest/v1/profiles?id=eq.${account.userId}&select=is_admin,paywall_access_role`,undefined,'GET');
    if (!Array.isArray(profiles) || profiles.length!==1 || profiles[0].is_admin === true ||
        (profiles[0].paywall_access_role != null && !['user','normal','default'].includes(profiles[0].paywall_access_role))) {
      throw new Error('QA account needs a normal profile without a special access role');
    }
  }
  return accounts;
}

async function main(command) {
  await mkdir(directory,{recursive:true,mode:0o700});
  if (command==='init') {
    if (!(await exists(targetPath))) await save(targetPath,{
      projectRef:'',publicKey:'',serviceKey:'',revenueCatProjectId:'',revenueCatSecretKey:'',
      premiumEntitlementId:'',standardEntitlementId:'',liteEntitlementId:'',
    });
    if (!(await exists(accountsPath))) {
      const run = randomBytes(5).toString('hex');
      await save(accountsPath,['Apple Käufer A','Apple Familienmitglied B','Android Partner C','Unbeteiligtes Konto D'].map((label,i)=>({
        label,email:`family-qa-${run}-${i+1}@example.invalid`,password:randomBytes(24).toString('base64url'),
      })));
    }
    console.log('Private setup files prepared in .family-qa/. No accounts created remotely.');
    return;
  }
  const target=JSON.parse(await readFile(targetPath,'utf8'));
  const {url}=validateTarget(target,command==='seed');
  if (command==='check') {
    console.log(JSON.stringify({projectRef:target.projectRef,publicConfigValid:true,hasServiceKey:!!target.serviceKey,
      hasRevenueCatKey:!!target.revenueCatSecretKey,hasRevenueCatProject:!!target.revenueCatProjectId}));
    return;
  }
  if (command!=='seed' && command!=='configure') throw new Error('Usage: node scripts/family-qa.mjs init|check|seed|configure');
  let accounts = JSON.parse(await readFile(accountsPath,'utf8'));
  if (command==='seed') {
    accounts = await seedTestAccounts(target,accounts,fetch,rows=>save(accountsPath,rows));
    console.log('Four ordinary QA app accounts verified; credentials saved privately. Store accounts are separate.');
    return;
  }
  if (accounts.length!==4 || accounts.some(account=>!uuid.test(account.userId ?? ''))) throw new Error('Seed four test app accounts first');
  if (!target.revenueCatSecretKey || !target.revenueCatProjectId) throw new Error('RevenueCat test backend credentials missing');
  const app = {EXPO_PUBLIC_BACKEND_ENV:'family-qa',EXPO_PUBLIC_QA_PROJECT_REF:target.projectRef,
    EXPO_PUBLIC_QA_SUPABASE_URL:url,EXPO_PUBLIC_QA_SUPABASE_KEY:target.publicKey};
  const backend = {FAMILY_QA_MODE:'sandbox',FAMILY_QA_PROJECT_REF:target.projectRef,FAMILY_QA_USER_IDS:accounts.map(a=>a.userId).join(','),
    REVENUECAT_PROJECT_ID:target.revenueCatProjectId,REVENUECAT_SECRET_API_KEY:target.revenueCatSecretKey,
    REVENUECAT_PREMIUM_ENTITLEMENT_ID:target.premiumEntitlementId,REVENUECAT_STANDARD_ENTITLEMENT_ID:target.standardEntitlementId,
    REVENUECAT_LITE_ENTITLEMENT_ID:target.liteEntitlementId};
  const secretPath=`${directory}/generated-secrets.local.json`;
  const secrets=await exists(secretPath)?JSON.parse(await readFile(secretPath,'utf8')):{
    SUBSCRIPTION_RECONCILE_SECRET:randomBytes(32).toString('hex'),
    REVENUECAT_WEBHOOK_AUTHORIZATION:`Bearer ${randomBytes(32).toString('hex')}`,
    REVENUECAT_WEBHOOK_SIGNING_SECRET:'', // Must be the actual RevenueCat webhook signing secret.
  };
  await save(secretPath,secrets);
  const envFile = values => Object.entries(values).map(([k,v])=>`${k}=${JSON.stringify(v ?? '')}`).join('\n')+'\n';
  await save(`${directory}/app.env.local`,envFile(app));
  await save(`${directory}/functions.env.local`,envFile({...backend,...secrets}));
  const easPath = fileURLToPath(new URL('../eas.json',import.meta.url));
  const eas = JSON.parse(await readFile(easPath,'utf8'));
  for (const profile of ['family-qa-ios','family-qa-android']) {
    if (!eas.build[profile]) throw new Error(`Missing ${profile} build profile`);
    eas.build[profile].env={...eas.build[profile].env,...app};
  }
  await writeFile(easPath,JSON.stringify(eas,null,2)+'\n');
  console.log('QA build profiles and private function env file configured. No deployment or build started.');
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});
}
