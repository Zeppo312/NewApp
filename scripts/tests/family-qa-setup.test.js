const {test}=require('node:test');
const assert=require('node:assert/strict');
const target={projectRef:'abcdefghijklmnopqrst',publicKey:'sb_publishable_fixture',serviceKey:'test-server-key'};
const uid='11111111-1111-4111-8111-111111111111';
test('QA seeding rejects production before any request',async()=>{
  const {seedTestAccounts}=await import('../family-qa.mjs');
  let calls=0;
  await assert.rejects(seedTestAccounts({...target,projectRef:'kwniiyayhzgjfqjsjcfu'},[],()=>{calls++;}));
  assert.equal(calls,0);
});
test('QA seeding creates ordinary confirmed app users without sending mail',async()=>{
  const {seedTestAccounts}=await import('../family-qa.mjs');
  const calls=[]; const saved=[];
  const request=async(url,options)=>{
    calls.push({url,...options});
    if(url.includes('/token?')) return Response.json({error:'invalid_credentials'},{status:400});
    if(url.endsWith('/admin/users')) return Response.json({id:uid});
    return Response.json([{is_admin:false,paywall_access_role:null}]);
  };
  const accounts=await seedTestAccounts(target,[{label:'A',email:'qa@example.invalid',password:'fixture-password'}],request,rows=>saved.push(rows[0].userId));
  assert.equal(accounts[0].userId,uid);
  assert.deepEqual(saved,[uid]);
  const created=JSON.parse(calls[1].body);
  assert.equal(created.email_confirm,true);
  assert.equal(created.app_metadata,undefined);
  assert.equal(created.user_metadata.paywall_access_role,undefined);
  assert(calls.every(call=>call.url.startsWith('https://abcdefghijklmnopqrst.supabase.co/')));
  assert(!calls.some(call=>call.url.includes('/invite')));
});
test('QA setup rejects special access and recovers previously created users',async()=>{
  const {seedTestAccounts}=await import('../family-qa.mjs');
  let creates=0;
  const request=async(url)=>{
    if(url.includes('/token?')) return Response.json({user:{id:uid}});
    if(url.endsWith('/admin/users')) creates++;
    return Response.json([{is_admin:false,paywall_access_role:'premium_tester'}]);
  };
  await assert.rejects(seedTestAccounts(target,[{email:'qa@example.invalid',password:'fixture-password'}],request),/normal profile/);
  assert.equal(creates,0);
});
