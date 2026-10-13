// Execute the actual migration against native PostgreSQL with synthetic data.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import EmbeddedPostgres from '../../.family-qa/postgres-tools/node_modules/embedded-postgres/dist/index.js';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',c='10000000-0000-4000-8000-000000000003';
const baby='30000000-0000-4000-8000-000000000001',stock='40000000-0000-4000-8000-000000000001';
const uuid=n=>`50000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let pg,tmp,index=0;
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lottibaby-tracking-'));
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 pg=new EmbeddedPostgres({databaseDir:path.join(tmp,'db'),user:'postgres',password:'synthetic-only',port,persistent:true,onLog:()=>{},onError:()=>{}});
 await pg.initialise();await pg.start();const db=pg.getPgClient();await db.connect();await db.query('CREATE ROLE anon;CREATE ROLE authenticated;');await db.end();
});
after(async()=>{if(pg)await pg.stop();if(tmp)fs.rmSync(tmp,{recursive:true,force:true});});
async function actor(db,user){await db.query('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);await db.query('SET ROLE authenticated');}
async function setup(){
 const name=`tracking_${++index}`;await pg.createDatabase(name);const db=pg.getPgClient(name);await db.connect();
 await db.query(`CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE SCHEMA consent_private;CREATE TABLE consent_private.decisions(user_id uuid,scope text,decision text);
 CREATE FUNCTION consent_private.family_allowed(uid uuid,scope text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT NOT EXISTS(SELECT 1 FROM consent_private.decisions d WHERE d.user_id=uid AND d.scope=scope AND decision<>'granted')$$;
 CREATE SCHEMA deletion_private;CREATE TABLE deletion_private.rules(schema_name text,table_name text,column_name text,action text);
 CREATE FUNCTION deletion_private.guard_write() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW;END$$;
 CREATE TABLE baby_info(id uuid PRIMARY KEY,user_id uuid);CREATE TABLE baby_members(baby_id uuid,user_id uuid);
 CREATE TABLE account_links(creator_id uuid,invited_id uuid,status text,relationship_type text);
 CREATE TABLE baby_care_entries(id uuid PRIMARY KEY,user_id uuid NOT NULL,baby_id uuid NOT NULL,entry_type text NOT NULL CHECK(entry_type IN('feeding','diaper','custom')),start_time timestamptz NOT NULL,end_time timestamptz,notes text,feeding_type text,feeding_volume_ml integer,feeding_side text,diaper_type text,diaper_fever_measured boolean,diaper_temperature_c numeric,diaper_suppository_given boolean,diaper_suppository_dose_mg integer,custom_activity_type_id uuid,custom_name text,custom_emoji text,custom_color text,custom_tracking_mode text,custom_quantity numeric,custom_unit text,created_at timestamptz,updated_at timestamptz);
 CREATE TABLE sleep_entries(id uuid PRIMARY KEY,user_id uuid NOT NULL,baby_id uuid NOT NULL,start_time timestamptz NOT NULL,end_time timestamptz,duration_minutes integer,quality text,notes text,partner_id uuid,shared_with_user_id uuid,updated_by uuid,created_at timestamptz,updated_at timestamptz);
 CREATE TABLE inventory_items(id uuid PRIMARY KEY,created_by uuid,category text,current_quantity numeric,packages_sealed integer,package_quantity numeric,dosage_grams_per_100ml numeric,created_at timestamptz DEFAULT now());
 CREATE TABLE inventory_transactions(id uuid PRIMARY KEY,inventory_item_id uuid,baby_id uuid,created_by uuid,transaction_type text,quantity_change numeric,quantity_after numeric,note text);
 CREATE TABLE baby_daily_habit_checks(baby_id uuid,habit_key text,day date,checked_at timestamptz,checked_by uuid,PRIMARY KEY(baby_id,habit_key,day));
 CREATE FUNCTION public.fixture_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.updated_at:=clock_timestamp();RETURN NEW;END$$;
 CREATE TRIGGER care_update BEFORE UPDATE ON baby_care_entries FOR EACH ROW EXECUTE FUNCTION fixture_updated_at();
 CREATE TRIGGER sleep_update BEFORE UPDATE ON sleep_entries FOR EACH ROW EXECUTE FUNCTION fixture_updated_at();
 GRANT USAGE ON SCHEMA auth,consent_private TO authenticated;GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth,consent_private TO authenticated;
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
 ALTER TABLE baby_info ENABLE ROW LEVEL SECURITY;CREATE POLICY baby_access ON baby_info TO authenticated USING(user_id=auth.uid() OR EXISTS(SELECT 1 FROM baby_members WHERE baby_id=id AND user_id=auth.uid()));
 ALTER TABLE baby_care_entries ENABLE ROW LEVEL SECURITY;CREATE POLICY care_access ON baby_care_entries TO authenticated USING(EXISTS(SELECT 1 FROM baby_members WHERE baby_id=baby_care_entries.baby_id AND user_id=auth.uid())) WITH CHECK(user_id=auth.uid() OR EXISTS(SELECT 1 FROM baby_members WHERE baby_id=baby_care_entries.baby_id AND user_id=auth.uid()));
 ALTER TABLE sleep_entries ENABLE ROW LEVEL SECURITY;CREATE POLICY sleep_access ON sleep_entries TO authenticated USING(user_id=auth.uid() OR partner_id=auth.uid()) WITH CHECK(user_id=auth.uid() OR partner_id=auth.uid());
 ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;CREATE POLICY stock_access ON inventory_items TO authenticated USING(created_by=auth.uid() OR EXISTS(SELECT 1 FROM account_links WHERE status='accepted' AND auth.uid() IN(creator_id,invited_id) AND created_by IN(creator_id,invited_id)));
 INSERT INTO auth.users VALUES('${a}'),('${b}'),('${c}');INSERT INTO baby_info VALUES('${baby}','${a}');INSERT INTO baby_members VALUES('${baby}','${a}'),('${baby}','${b}');INSERT INTO account_links VALUES('${a}','${b}','accepted','partner');
 INSERT INTO inventory_items(id,created_by,category,current_quantity,packages_sealed,package_quantity,dosage_grams_per_100ml) VALUES('${stock}','${a}','formula',10,2,100,15);`);
 await db.query(fs.readFileSync(new URL('../../supabase/migrations/20261008183517_tracking_offline_outbox.sql',import.meta.url),'utf8'));
 await actor(db,a);return {db,name};
}
async function send(db,{op=1,id=10,kind='care',action='create',fields={entry_type:'feeding',feeding_type:'BOTTLE',feeding_volume_ml:120,start_time:new Date().toISOString(),end_time:new Date().toISOString()},expected=null,inventory=stock,user=a}={}){
 return (await db.query('SELECT public.tracking_sync_operation($1,$2,$3,$4,$5,$6,$7,$8,$9) s',[user,uuid(op),baby,kind,action,kind==='vitamin'?null:uuid(id),fields,expected,inventory])).rows[0].s;
}
test('lost reply retry creates one entry and debits powder once, including opening a sealed package',async()=>{
 const {db}=await setup();try{const fields={entry_type:'feeding',feeding_type:'BOTTLE',feeding_volume_ml:120,start_time:new Date().toISOString(),end_time:new Date().toISOString()};
 const first=await send(db,{fields});const again=await send(db,{fields});assert.equal(first.status,'applied');assert.equal(again.status,'already_applied');
 assert.equal((await db.query('SELECT count(*) n FROM baby_care_entries')).rows[0].n,'1');const row=(await db.query('SELECT * FROM inventory_items')).rows[0];assert.equal(Number(row.current_quantity),92);assert.equal(row.packages_sealed,1);
 assert.equal((await db.query('SELECT count(*) n FROM inventory_transactions')).rows[0].n,'1');
 await assert.rejects(send(db,{fields:{...fields,feeding_volume_ml:240}}),/payload changed/);
 }finally{await db.end();}
});
test('all care types, custom snapshots and one diaper debit commit through existing RLS',async()=>{
 const {db}=await setup();try{
 await db.query('RESET ROLE');await db.query("UPDATE inventory_items SET category='diapers',current_quantity=1,packages_sealed=1,package_quantity=50 WHERE id=$1",[stock]);await actor(db,a);
 const time=new Date().toISOString();let n=20;
 for(const fields of [{entry_type:'feeding',feeding_type:'BREAST'},{entry_type:'feeding',feeding_type:'SOLIDS'},{entry_type:'feeding',feeding_type:'PUMP',feeding_volume_ml:60},{entry_type:'feeding',feeding_type:'WATER',feeding_volume_ml:20},{entry_type:'custom',custom_name:'Walk',custom_tracking_mode:'duration',custom_emoji:'🚶'},{entry_type:'diaper',diaper_type:'BOTH',diaper_temperature_c:37.2,diaper_fever_measured:true}]){n++;assert.equal((await send(db,{op:n,id:n,fields:{...fields,start_time:time,end_time:time}})).status,'applied');}
 assert.equal((await db.query('SELECT count(*) n FROM baby_care_entries')).rows[0].n,'6');assert.equal((await db.query('SELECT count(*) n FROM inventory_transactions')).rows[0].n,'1');
 await actor(db,c);assert.equal((await send(db,{op:40,id:40,user:c})).status,'forbidden');assert.equal((await db.query('SELECT count(*) n FROM tracking_sync_receipts')).rows[0].n,'0');
 }finally{await db.end();}
});
test('sleep start resolves partner sharing on the server; simultaneous start conflicts and never replaces it',async()=>{
 const {db,name}=await setup();const other=pg.getPgClient(name);await other.connect();try{await actor(other,b);
 const fields={start_time:new Date().toISOString(),end_time:null};
 const replies=await Promise.all([send(db,{op:50,id:50,kind:'sleep',fields}),send(other,{op:51,id:51,kind:'sleep',fields,user:b})]);
 assert.equal(replies.filter(v=>v.status==='applied').length,1);assert.equal(replies.filter(v=>v.status==='conflict'&&v.reason==='active_sleep').length,1);
 const row=(await db.query('SELECT * FROM sleep_entries')).rows[0];assert.equal(row.partner_id,row.user_id===a?b:a);
 }finally{await db.end();await other.end();}
});
test('offline stop uses the creation receipt version after a lost reply and detects later partner edits',async()=>{
 const {db}=await setup();try{const fields={start_time:new Date(Date.now()-600000).toISOString(),end_time:null};
 const first=await send(db,{op:60,id:60,kind:'sleep',fields});await actor(db,b);await db.query("UPDATE sleep_entries SET notes='partner edit' WHERE id=$1",[uuid(60)]);await actor(db,a);
 const retry=await send(db,{op:60,id:60,kind:'sleep',fields});assert.equal(retry.status,'already_applied');assert.equal(retry.row.notes,'partner edit');assert.equal(retry.appliedUpdatedAt,first.appliedUpdatedAt);
 const stop=await send(db,{op:61,id:60,kind:'sleep',action:'update',fields:{end_time:new Date().toISOString(),quality:'good'},expected:retry.appliedUpdatedAt});assert.equal(stop.status,'conflict');
 assert.equal((await db.query('SELECT end_time FROM sleep_entries')).rows[0].end_time,null);
 }finally{await db.end();}
});
test('a partner-started sleep stops for both accounts when the offline stop is delivered; a lost reply is idempotent',async()=>{
 const {db}=await setup();try{
 const fields={start_time:new Date(Date.now()-600000).toISOString(),end_time:null};
 const started=await send(db,{op:62,id:62,kind:'sleep',fields});assert.equal(started.status,'applied');
 await actor(db,b);
 const observed=(await db.query('SELECT to_jsonb(e) row FROM sleep_entries e WHERE id=$1',[uuid(62)])).rows[0].row;
 assert.equal(observed.user_id,a);assert.equal(observed.partner_id,b);assert.equal(observed.end_time,null);
 const stoppedAt=new Date().toISOString();
 const request={op:63,id:62,kind:'sleep',action:'update',fields:{end_time:stoppedAt,quality:'good'},expected:observed.updated_at,user:b};
 const stopped=await send(db,request);assert.equal(stopped.status,'applied');
 assert.equal(Date.parse(stopped.row.end_time),Date.parse(stoppedAt));
 assert.equal((await send(db,request)).status,'already_applied');
 await actor(db,a);
 const partnerView=(await db.query('SELECT end_time,updated_by FROM sleep_entries WHERE id=$1',[uuid(62)])).rows[0];
 assert.equal(partnerView.end_time.toISOString(),stoppedAt);assert.equal(partnerView.updated_by,b);
 assert.equal((await db.query('SELECT count(*) n FROM sleep_entries WHERE baby_id=$1 AND end_time IS NULL',[baby])).rows[0].n,'0');
 }finally{await db.end();}
});
test('receipt prevents resurrection after a partner deletes a confirmed entry',async()=>{
 const {db}=await setup();try{const fields={entry_type:'feeding',feeding_type:'BREAST',start_time:new Date().toISOString(),end_time:null};await send(db,{op:70,id:70,fields});
 await actor(db,b);await db.query('DELETE FROM baby_care_entries WHERE id=$1',[uuid(70)]);await actor(db,a);
 const retry=await send(db,{op:70,id:70,fields});assert.equal(retry.status,'already_applied');assert.equal(retry.row,null);assert.equal((await db.query('SELECT count(*) n FROM baby_care_entries')).rows[0].n,'0');
 }finally{await db.end();}
});
test('vitamin retry does not restore a check after a newer uncheck; health withdrawal erases receipts',async()=>{
 const {db}=await setup();try{const fields={day:'2026-10-08',completed:true,checked_at:new Date().toISOString()};await send(db,{op:80,kind:'vitamin',action:'check',fields});
 await send(db,{op:81,kind:'vitamin',action:'check',fields:{...fields,completed:false}});assert.equal((await send(db,{op:80,kind:'vitamin',action:'check',fields})).status,'already_applied');assert.equal((await db.query('SELECT count(*) n FROM baby_daily_habit_checks')).rows[0].n,'0');
 await db.query('RESET ROLE');await db.query("INSERT INTO consent_private.decisions VALUES($1,'health','revoked')",[a]);assert.equal((await db.query('SELECT count(*) n FROM tracking_sync_receipts')).rows[0].n,'0');await actor(db,a);await assert.rejects(send(db,{op:82}),/consent required/);
 }finally{await db.end();}
});
test('inventory permission failure rolls the entry, stock and receipt back together; an actor swap is rejected',async()=>{
 const {db}=await setup();try{
 await assert.rejects(send(db,{user:b}),/actor changed/);
 await db.query('RESET ROLE');await db.query('ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY');await actor(db,a);
 await assert.rejects(send(db,{op:90,id:90}),/row-level security/);
 assert.equal((await db.query('SELECT count(*) n FROM baby_care_entries')).rows[0].n,'0');assert.equal((await db.query('SELECT count(*) n FROM tracking_sync_receipts')).rows[0].n,'0');
 const item=(await db.query('SELECT * FROM inventory_items')).rows[0];assert.equal(Number(item.current_quantity),10);assert.equal(item.packages_sealed,2);
 }finally{await db.end();}
});
