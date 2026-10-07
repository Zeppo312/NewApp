import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeSleepDb,asUser,a,baby,shareQuery,directQuery,candidate,correctedPolicies,rollbackPolicies,addShares} from './tests/helpers/sleep-access-fixture.mjs';
const dir=process.env.BENCHMARK_OUTPUT||`output/sleep-access-benchmark-${Date.now()}`;
fs.mkdirSync(dir,{recursive:true});
const db=await makeSleepDb(Number(process.env.SLEEP_ROWS||65000));
const report={engine:'PGlite, synthetic data only; authenticated role',rows:Number(process.env.SLEEP_ROWS||65000),results:[],correctedResultParity:false,comparisons:0};
try {
 for(const populated of [false,true]) {
  if(populated) await addShares(db);
  const expected={};
  for(const stage of ['original','corrected','optimized']) {
   await db.exec('RESET ROLE; SET statement_timeout=0; DROP INDEX IF EXISTS sleep_entries_partner_read_idx; DROP INDEX IF EXISTS sleep_entries_legacy_share_read_idx;');
   await db.exec(rollbackPolicies);
   if(stage==='corrected')await db.exec(correctedPolicies);
   if(stage==='optimized')await db.exec(candidate());
   await asUser(db,a);
   await db.exec("SET statement_timeout='12s'");
   assert.equal((await db.query('SELECT current_user u')).rows[0].u,'authenticated');
   for(const [name,q,params] of [
    ['share-all',shareQuery,[a,null,1000,0,1000,0]],['share-baby',shareQuery,[a,baby,1000,0,1000,0]],
    ['direct-all',directQuery,[a,null,1000,0]],['direct-baby',directQuery,[a,baby,1000,0]]
   ]) {
    const key=`${populated?'populated':'empty'}-${name}`;
    let rows;
    try{rows=(await db.query(q,params)).rows;}catch(error){report.results.push({stage,key,error:error.code});console.log(JSON.stringify(report.results.at(-1)));if(stage!=='original')throw error;continue;}
    if(stage==='corrected')expected[key]=rows;
    if(stage==='optimized'){assert.deepEqual(rows,expected[key],`corrected semantic parity ${key}`);report.comparisons++;}
    const repetitions=stage==='original'?1:Number(process.env.BENCHMARK_REPETITIONS||5);
    for(let sample=0;sample<repetitions;sample++) {
     try {
      const plan=(await db.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+q,params)).rows[0]['QUERY PLAN'][0];
      fs.writeFileSync(`${dir}/${stage}-${key}-${sample}.json`,JSON.stringify(plan,null,2));
      const r={stage,key,sample,ms:plan['Execution Time'],rows:rows.length};report.results.push(r);console.log(JSON.stringify(r));
     } catch(error){report.results.push({stage,key,sample,error:error.code});console.log(JSON.stringify(report.results.at(-1)));if(stage!=='original')throw error;break;}
    }
   }
  }
 }
 assert.equal(report.comparisons,8);report.correctedResultParity=true;
} finally {fs.writeFileSync(dir+'/benchmark.json',JSON.stringify(report,null,2));await db.close();}
