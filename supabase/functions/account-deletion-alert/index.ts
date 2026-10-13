import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import nodemailer from 'npm:nodemailer@9.0.1';
import { createAlertHandler } from './handler.ts';

Deno.serve(createAlertHandler({
 env:key=>Deno.env.get(key),
 createAdmin:(url,key)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}}),
 send:async message=>{
  const transport=nodemailer.createTransport({host:'smtp.hostinger.com',port:465,secure:true,
   auth:{user:'support@lottibaby.de',pass:Deno.env.get('DELETION_ALARM_SMTP_PASSWORD')},
   connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,tls:{rejectUnauthorized:true},logger:false,debug:false});
  try {
   const result=await transport.sendMail({from:'LottiBaby Löschbetrieb <support@lottibaby.de>',to:'support@lottibaby.de',...message});
   if(!result.accepted?.includes('support@lottibaby.de')) throw new Error('recipient_not_accepted');
  } catch (error) {
   console.error('deletion_alarm_smtp_failed',{code:typeof error?.code==='string'?error.code:'unknown',command:typeof error?.command==='string'?error.command:'unknown',responseCode:Number.isInteger(error?.responseCode)?error.responseCode:null});
   throw new Error('smtp_delivery_failed');
  } finally {transport.close();}
 }
}));
