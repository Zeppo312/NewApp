jest.mock('../supabase',()=>({supabase:{functions:{invoke:jest.fn()},auth:{getUser:jest.fn(),signInWithOtp:jest.fn(),verifyOtp:jest.fn()}}}));
import { getDeletionAvailability, parseDeletionReceipt, requestAccountDeletion, sendDeletionVerification, verifyDeletionCode } from '../accountDeletion';
import { supabase } from '../supabase';
const receipt={requestId:'11111111-1111-4111-8111-111111111111',scope:'account',status:'queued'};
beforeEach(() => jest.clearAllMocks());
it.each([null,undefined,{},true,{success:true},{...receipt,requestId:'guess'},{...receipt,status:'deleted'},{...receipt,scope:'unknown'}])('rejects incomplete deletion response %j',(value)=>{expect(()=>parseDeletionReceipt(value)).toThrow();});
it('accepts a valid queued response without claiming deletion completed',()=>{expect(parseDeletionReceipt(receipt)).toEqual(receipt);});
it('never falls back to the old destructive RPC on server failure',async()=>{
 (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({data:null,error:new Error('timeout')});await expect(requestAccountDeletion()).rejects.toThrow('deletion_request_failed');
 expect(supabase.functions.invoke).toHaveBeenCalledWith('request-account-deletion',{body:{confirm:true,scope:'account',source:'app',policyVersion:'2026-09-11'}});
});
it.each([
 [{data:{available:true},error:null}, 'available'],
 [{data:{available:false},error:null}, 'support'],
 [{data:null,error:{context:{status:404}}}, 'support'],
 [{data:null,error:new Error('offline')}, 'unavailable'],
 [{data:{available:'true'},error:null}, 'unavailable'],
])('checks availability conservatively: %j',async(result,expected)=>{
 (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce(result);
 expect(await getDeletionAvailability()).toBe(expected);
});
it('does not send OTP when the server cannot accept requests',async()=>{
 (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({data:{available:false},error:null});
 await expect(sendDeletionVerification()).rejects.toThrow('deletion_unavailable');
 expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
});
it('bounds a hung availability check and aborts the request',async()=>{
 jest.useFakeTimers();
 try {
  (supabase.functions.invoke as jest.Mock).mockReturnValueOnce(new Promise(()=>{}));
  const pending=getDeletionAvailability();
  await jest.advanceTimersByTimeAsync(8_000);
  expect(await pending).toBe('unavailable');
  const options=(supabase.functions.invoke as jest.Mock).mock.calls.at(-1)[1];
  expect(options.signal.aborted).toBe(true);
 } finally { jest.useRealTimers(); }
});
it('binds the request to the freshly verified token rather than a later session',async()=>{
 (supabase.auth.verifyOtp as jest.Mock).mockResolvedValueOnce({data:{user:{id:'expected'},session:{access_token:'verified-only-token'}},error:null});
 const token=await verifyDeletionCode('test@example.invalid','123456','expected');
 (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({data:receipt,error:null});await requestAccountDeletion('account',token);
 expect(supabase.functions.invoke).toHaveBeenLastCalledWith('request-account-deletion',{body:{confirm:true,scope:'account',source:'app',policyVersion:'2026-09-11'},headers:{Authorization:'Bearer verified-only-token'}});
});
it.each([{user:{id:'other'},session:{access_token:'other-token'}},{user:{id:'expected'},session:null},{user:{id:'expected'},session:{}}])('rejects an unexpected identity or missing verified token',async(data)=>{
 (supabase.auth.verifyOtp as jest.Mock).mockResolvedValueOnce({data,error:null});await expect(verifyDeletionCode('test@example.invalid','123456','expected')).rejects.toThrow('deletion_verification_failed');
});
it('sends a code only to the authenticated address and never creates an account', async () => {
 (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({data:{available:true},error:null});
 (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({data:{user:{id:'expected',email:'owner@example.invalid'}},error:null});
 (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValueOnce({error:null});
 expect(await sendDeletionVerification()).toBe('owner@example.invalid');
 expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({email:'owner@example.invalid',options:{shouldCreateUser:false}});
});
