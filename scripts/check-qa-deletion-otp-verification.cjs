// Verify the actually received code against the already marked disposable QA identity.
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
async function main() {
  const root = '.family-qa/deletion-completion-20260930/';
  const target = JSON.parse(fs.readFileSync('.family-qa/target.local.json','utf8'));
  if (target.projectRef !== 'ggyonianphloycmqrwvj') throw new Error('Wrong QA target.');
  const account = JSON.parse(fs.readFileSync(root+'otp-account.json','utf8'));
  if (account.email !== 'support@lottibaby.de') throw new Error('Unexpected fixture recipient.');
  const admin = createClient(`https://${target.projectRef}.supabase.co`,target.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const checked = await admin.auth.admin.getUserById(account.userId);
  if (checked.error || checked.data.user?.email !== account.email || checked.data.user?.user_metadata?.qa_disposable !== 'deletion-completion-20260930') throw new Error('Disposable identity could not be verified.');
  const code = fs.readFileSync(root+'otp-code.local.txt','utf8').trim();
  if (!/^\d{6}$/.test(code)) throw new Error('Expected the actually received six-digit code.');
  const client = createClient(`https://${target.projectRef}.supabase.co`,target.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const result = await client.auth.verifyOtp({email:account.email,token:code,type:'email'});
  const token = result.data.session?.access_token;
  const claims = token ? JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()) : {};
  const passed = !result.error && result.data.user?.id === account.userId && claims.sub === account.userId && claims.amr?.some(entry=>entry.method==='otp' && Math.abs(Date.now()/1000-entry.timestamp)<600);
  const report = {checkedAt:new Date().toISOString(),qaProject:target.projectRef,recipient:account.email,actualDeliveryVerified:true,
    exactDisposableIdentityVerified:passed,recentOtpAmrVerified:passed,status:result.error?.status??200,errorCode:result.error?.code??null,
    nativeDeletionVerified:false,workerEnablementChanged:false};
  if (passed) fs.writeFileSync(root+'verified-session.json',JSON.stringify(result.data.session),{mode:0o600});
  fs.writeFileSync('output/deletion-completion-20260930/otp-verification.json',JSON.stringify(report,null,2)+'\n');
  fs.rmSync(root+'otp-code.local.txt');
  console.log(JSON.stringify(report,null,2));
  if (!passed) process.exitCode=2;
}
main().catch(()=>{console.error('QA OTP verification could not complete. No code or credentials logged.');process.exitCode=1});
