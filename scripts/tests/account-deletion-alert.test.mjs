import test from 'node:test';
import assert from 'node:assert/strict';
import { composeDeletionAlarm } from '../account-deletion-alert.mjs';
test('idle health and normal pending provider work do not send an alarm',()=>{
 assert.equal(composeDeletionAlarm({environment:'qa',alerts:{needs_attention:0},pendingProviderEvidence:3}),null);
});
test('positive counters produce one aggregate alarm without source account data',()=>{
 const mail=composeDeletionAlarm({environment:'qa',checkedAt:'synthetic-time',alerts:{needs_attention:2},userId:'private-account-id',evidence:'private-case-content'});
 assert.equal(mail.to,'support@lottibaby.de');assert.match(mail.text,/needs_attention: 2/);assert.doesNotMatch(JSON.stringify(mail),/private-account-id|private-case-content/);
});
test('synthetic tests and failed checks are explicitly identified',()=>{
 assert.match(composeDeletionAlarm({environment:'qa',alerts:{needs_attention:1}},true).subject,/\[TEST\]/);
 assert.match(composeDeletionAlarm({environment:'production',checkFailed:true}).text,/nicht verlässlich/);
});
test('unknown health is a status failure alarm, never a silent zero',()=>{
 assert.match(composeDeletionAlarm({environment:'qa',alerts:null}).subject,/Statusprüfung fehlgeschlagen/);
});
