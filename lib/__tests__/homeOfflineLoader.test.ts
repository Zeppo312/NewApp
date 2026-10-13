import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const path=join(__dirname,'../../app/(tabs)/home.tsx');const source=readFileSync(path,'utf8');const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let node:ts.FunctionDeclaration|undefined;
function visit(n:ts.Node){if(ts.isFunctionDeclaration(n)&&n.name?.text==='loadData')node=n;ts.forEachChild(n,visit);}visit(ast);
if(!node)throw new Error('Missing Home loader');
const js=ts.transpileModule(node.getText(ast)+'\nloadData;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function setup(){
  const state:{care:any[];sleep:number;timer:any;reads:Record<string,any>}={care:[{id:'kept'}],sleep:72,timer:{entryId:'active'},reads:{care:{verifiedAt:'old'},sleep:{verifiedAt:'old'},timer:{verifiedAt:'old'}}};
  const scopeRef={current:'a:baby:today'};let revision=0;
  const get=jest.fn(async()=>({data:[{id:'fresh'}],error:null}));const sleep=jest.fn(async()=>({totalMinutes:90,activeSleepTimer:{entryId:'sleep'}}));const timer=jest.fn(async()=>null);
  const write=jest.fn(async()=>{});const flight={current:null};
  const context={homeScopeKey:scopeRef.current,homeScopeRef:scopeRef,homeFlight:flight,homeDateKey:'today',user:{id:'a'},activeBabyId:'baby',localHealthGeneration:()=>1,localHealthAllowed:()=>true,readSnapshotRevision:()=>revision,backendHost:()=> 'fixture',readSnapshot:async()=>null,validRows:()=>true,validHomeSleepRows:()=>true,setHomeSleepRows:jest.fn(),localScopeKey:()=> 'scope',boundedRead:async(_k:string,run:any)=>run(new AbortController().signal),getBabyCareEntriesForDate:get,fetchTodaySleepMinutes:sleep,loadActiveDailyTimer:timer,timerParts:{current:{sleep:null,care:null}},pickLatestHomeTimer:(a:any,b:any)=>b??a,writeSnapshot:write,setDailyEntries:(v:any)=>{state.care=v;},setTodaySleepMinutes:(v:any)=>{state.sleep=v;},setActiveHomeTimer:(v:any)=>{state.timer=v;},setReadStates:(v:any)=>{state.reads=typeof v==='function'?v(state.reads):v;},setIsLoading:()=>{},Date,AbortController,Promise};
  return {state,context,get,sleep,timer,write,scopeRef,setRevision:(v:number)=>{revision=v;},load:runInNewContext(js,context) as ()=>Promise<void>};
}
it('failed care/sleep/timer reads keep each last confirmed value and do not cache invented zero',async()=>{const h=setup();h.get.mockRejectedValue(new Error('offline'));h.sleep.mockRejectedValue(new Error('offline'));h.timer.mockRejectedValue(new Error('offline'));await h.load();expect(h.state.care).toEqual([{id:'kept'}]);expect(h.state.sleep).toBe(72);expect(h.state.timer.entryId).toBe('active');expect(h.write).not.toHaveBeenCalled();expect(h.state.reads.sleep.failed).toBe(true);});
it('one failed dataset does not discard a successful one; confirmed empty clears care and timer',async()=>{const h=setup();h.get.mockResolvedValue({data:[],error:null});h.sleep.mockResolvedValue({totalMinutes:0,activeSleepTimer:null as any});await h.load();expect(h.state.care).toEqual([]);expect(h.state.sleep).toBe(0);expect(h.state.timer).toBeNull();expect(h.write).toHaveBeenCalledTimes(2);});
it('deduplicates overlapping loads and rejects a delayed response for another account/child/day',async()=>{const h=setup();let resolve!:(v:any)=>void;let enter!:()=>void;const started=new Promise<void>(r=>{enter=r;});h.get.mockImplementation(()=>new Promise(r=>{resolve=r;enter();}));const a=h.load(),b=h.load();expect(a).toBe(b);await started;h.scopeRef.current='b:other:tomorrow';resolve({data:[{id:'late'}],error:null});await a;expect(h.state.care).toEqual([{id:'kept'}]);expect(h.write.mock.calls.some((args:any[]) => args[1] === 'home-care')).toBe(false);});
