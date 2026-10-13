import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeBabyDb,asUser,a,memberQuery,ownerQuery} from './tests/helpers/baby-membership-fixture.mjs';
const dir=process.env.BENCHMARK_OUTPUT || `output/baby-membership-recheck-${Date.now()}`;
fs.mkdirSync(dir,{recursive:true});
const db=await makeBabyDb();
const candidate=fs.readFileSync(process.env.CANDIDATE_SQL || 'supabase/migrations/20261006043754_optimize_baby_membership_private_read_policy.sql','utf8');
const output={engine:'PGlite; synthetic data, not production latency',babies:3839,results:[]};
const before={};
try {
 for(const stage of ['before','after']) {
  if(stage==='after') { await db.exec('RESET ROLE'); await db.exec(candidate); }
  await asUser(db,a);
  for(const [name,q] of Object.entries({member:memberQuery,owner:ownerQuery})) {
   const rows=(await db.query(q,[a])).rows;
   if(stage==='before')before[name]=rows;else assert.deepEqual(rows,before[name]);
   for(let sample=0;sample<3;sample++) {
    const plan=(await db.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+q,[a])).rows[0]['QUERY PLAN'][0];
    fs.writeFileSync(`${dir}/plan-${stage}-${name}-${sample}.json`,JSON.stringify(plan,null,2));
    const result={stage,query:name,sample,ms:plan['Execution Time'],rows:rows.length};
    output.results.push(result);console.log(JSON.stringify(result));
   }
  }
 }
 output.resultsIdentical=true;
 fs.writeFileSync(dir+'/benchmark.json',JSON.stringify(output,null,2));
} finally {await db.close();}
