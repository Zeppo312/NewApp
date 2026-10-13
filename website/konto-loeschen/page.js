'use strict';
const english = {
 eyebrow:'YOUR ACCOUNT · YOUR CHOICE',title:'Delete account and data',intro:'You can request deletion of your Lotti Baby account and its associated data here. You do not need to install the app.',requestTitle:'Request deletion',requestBody:'Email support@lottibaby.de with the subject “Lotti Baby – Delete account”. If possible, use the email address linked to your account. Do not send passwords or health information.',mail:'Request deletion by email',fallback:'No email app configured? Copy support@lottibaby.de into your email service. If you no longer have access to your account address or use Sign in with Apple, please mention this. We will help establish an appropriate way to verify your identity.',scopeTitle:'What does the request cover?',scope:'Your account and profile, personal settings, your tracking and health data, images, voice messages and other associated app content. We also include data processed by service providers for Lotti Baby.',family:'Shared baby data and content belonging to other people require separate assessment. We check which data is covered by your request and which data other authorized people may continue to use.',nextTitle:'What happens next',step1:'We identify the account associated with your request and verify your identity where necessary.',step2:'You receive a response about processing, scope and the timeframes applicable to your case.',step3:'We check removal from our systems and the relevant service providers. If data must be retained for a justified reason, we explain the categories, reasons and retention periods.',retention:'Legally required records, security logs and backups may have separate retention periods. Removal of app access does not necessarily mean that every backup has already expired.',subscriptionTitle:'Subscriptions and external copies',subscription:'Deleting an account does not automatically cancel an Apple or Google subscription. Check your subscription in the store where you purchased it.',copies:'Previously exported files, copies saved by recipients and entries in external calendars cannot all be removed remotely. If your request also concerns a shop order, please include its order number.',controller:'Controller: Laura-Michelle Zeppenfeld · Lotti Baby · support@lottibaby.de',privacy:'Privacy',imprint:'Legal notice',onlineTitle:'Confirm in your browser',email:'Account email address',send:'Request verification code',code:'Code from your email',confirm:'I request permanent deletion of my account and associated data. I have read the information below.',submit:'Submit deletion request'
};
const german = Object.fromEntries([...document.querySelectorAll('[data-copy]')].map((el) => [el.dataset.copy,el.textContent]));
let language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'de';
function translate(lang) {
 language=lang;document.documentElement.lang=lang;
 for(const el of document.querySelectorAll('[data-copy]')) el.textContent=(lang==='en'?english:german)[el.dataset.copy];
 for(const id of ['de','en']) document.getElementById(id).setAttribute('aria-pressed',String(id===lang));
 document.title=`${lang==='en'?english.title:german.title} · Lotti Baby`;
 document.getElementById('mail').href=`mailto:support@lottibaby.de?subject=${encodeURIComponent(lang==='en'?'Lotti Baby – Delete account':'Lotti Baby – Konto löschen')}`;
}
document.getElementById('de').onclick=()=>translate('de');document.getElementById('en').onclick=()=>translate('en');translate(language);
const config=window.LOTTI_DELETION_CONFIG;
const status=document.getElementById('status');
function message(de,en){status.textContent=language==='en'?en:de;}
if(config?.enabled===true&&/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl)&&config.publishableKey){
 document.getElementById('online').hidden=false;
 let email=''; let submitting=false;
 async function post(path,body,token){
  const response=await fetch(config.supabaseUrl+path,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),credentials:'omit',cache:'no-store'});
  if(!response.ok)throw new Error('request_failed');return response.json();
 }
 document.getElementById('email-form').onsubmit=async(event)=>{
  event.preventDefault();if(submitting)return;submitting=true;
  const button=event.target.querySelector('button');button.disabled=true;
  email=document.getElementById('email').value.trim();
  try{await post('/auth/v1/otp',{email,create_user:false});}catch{/* Neutral response avoids account enumeration. */}
  finally{submitting=false;button.disabled=false;}
  document.getElementById('code-form').hidden=false;
  message('Falls ein passendes Konto besteht, erhältst du eine E-Mail. Nutze bei Problemen den Supportweg oben.','If a matching account exists, you will receive an email. If you have difficulty, use the support option above.');
 };
 document.getElementById('code-form').onsubmit=async(event)=>{
  event.preventDefault();if(submitting||!document.getElementById('confirmation').checked)return;
  submitting=true;const button=event.target.querySelector('button');button.disabled=true;
  try{
   const session=await post('/auth/v1/verify',{email,token:document.getElementById('code').value.trim(),type:'email'});
   if(!session.access_token)throw new Error('verification_failed');
   const receipt=await post('/functions/v1/request-account-deletion',{scope:'account',source:'web',confirm:true,policyVersion:'2026-09-11'},session.access_token);
   if(!/^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(receipt.requestId)||!['queued','processing','retry_wait','needs_attention','retention_pending','completed'].includes(receipt.status)||receipt.scope!=='account')throw new Error('invalid_response');
   event.target.hidden=true;document.getElementById('email-form').hidden=true;
   message(`Löschung beauftragt. Bewahre diese Referenz für Rückfragen auf: ${receipt.requestId}. Der Abschluss wird gesondert geprüft.`,`Deletion requested. Keep this reference for support: ${receipt.requestId}. Completion is verified separately.`);
   document.getElementById('code').value='';document.getElementById('email').value='';email='';
  }catch{message('Die Anfrage konnte nicht bestätigt werden. Bitte versuche es erneut oder schreibe dem Support.','The request could not be confirmed. Please try again or contact support.');}
  finally{submitting=false;button.disabled=false;}
 };
}
