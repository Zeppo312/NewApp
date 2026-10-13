// One explicitly approved SMTP transport test. No deletion or worker enablement.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
async function main() {
  if (process.argv.slice(2).join(' ') !== '--send-approved') throw new Error('Explicit --send-approved required after operator authorization.');
  const target = JSON.parse(fs.readFileSync('.family-qa/target.local.json', 'utf8'));
  if (target.projectRef !== 'ggyonianphloycmqrwvj') throw new Error('Wrong QA target.');
  const email = 'support@lottibaby.de'; const privateFile = '.family-qa/deletion-completion-20260930/otp-account.json';
  const admin = createClient(`https://${target.projectRef}.supabase.co`, target.serviceKey, {auth:{persistSession:false,autoRefreshToken:false}});
  const client = createClient(`https://${target.projectRef}.supabase.co`, target.publicKey, {auth:{persistSession:false,autoRefreshToken:false}});
  let account;
  if (fs.existsSync(privateFile)) {
    account = JSON.parse(fs.readFileSync(privateFile,'utf8'));
    const checked = await admin.auth.admin.getUserById(account.userId);
    if (checked.error || checked.data.user?.email !== email || checked.data.user?.user_metadata?.qa_disposable !== 'deletion-completion-20260930') throw new Error('Existing fixture could not be verified.');
  } else {
    // Refuse to take over any pre-existing support identity.
    let page = 1;
    while (true) {
      const listed = await admin.auth.admin.listUsers({page,perPage:1000});
      if (listed.error) throw new Error('Account collision check failed.');
      if (listed.data.users.some(user => user.email?.toLowerCase() === email)) throw new Error('Support address already belongs to another QA identity. Use a separately approved test recipient.');
      if (listed.data.users.length < 1000) break; page++;
    }
    const created = await admin.auth.admin.createUser({email,password:crypto.randomBytes(32).toString('base64url'),email_confirm:true,user_metadata:{qa_disposable:'deletion-completion-20260930'}});
    if (created.error || !created.data.user) throw new Error('Disposable fixture could not be created.');
    account = {userId:created.data.user.id,email};
    fs.mkdirSync('.family-qa/deletion-completion-20260930',{recursive:true});fs.writeFileSync(privateFile,JSON.stringify(account),{mode:0o600});
  }
  const result = await client.auth.signInWithOtp({email,options:{shouldCreateUser:false}});
  const report = {checkedAt:new Date().toISOString(),qaProject:target.projectRef,recipient:'support@lottibaby.de',disposableFixtureVerified:true,
    smtpRequestAccepted:!result.error,status:result.error?.status??200,errorCode:result.error?.code??null,
    actualDeliveryVerified:false,workerEnablementChanged:false,nativeDeletionVerified:false};
  fs.writeFileSync('output/deletion-completion-20260930/otp-transport.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  if(result.error) process.exitCode=2;
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
