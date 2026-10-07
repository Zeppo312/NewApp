// Apply only the required QA native settings to an isolated build copy.
// Existing Apple extension targets are retained; no full prebuild is needed.
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateTarget } from './family-qa.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = await realpath(`${root}.family-qa/build-native`);
if (destination !== `${await realpath(root)}/.family-qa/build-native`) throw new Error('Isolated QA copy required');
const target = JSON.parse(await readFile(`${root}.family-qa/target.local.json`));
validateTarget(target);
const config = JSON.parse(await readFile(`${destination}/app.json`)).expo;
const result = spawnSync('python3', ['-c', `
import json,sys,pathlib,plistlib,re,xml.etree.ElementTree as ET
s=json.load(sys.stdin); root=pathlib.Path(s['directory'])
runtime='family-qa-'+s['version']
p=root/'ios/LottiBaby/Supporting/Expo.plist'
data=plistlib.loads(p.read_bytes()); data['EXUpdatesEnabled']=False; data['EXUpdatesRuntimeVersion']=runtime
p.write_bytes(plistlib.dumps(data,sort_keys=False))
p=root/'ios/LottiBaby/Info.plist'
data=plistlib.loads(p.read_bytes()); data['CFBundleDisplayName']='Lotti Baby QA'
p.write_bytes(plistlib.dumps(data,sort_keys=False))
p=root/'android/app/src/main/AndroidManifest.xml'
text=p.read_text(); text,count=re.subn(r'(<meta-data android:name="expo.modules.updates.ENABLED" android:value=")[^"]+("/>)',r'\\g<1>false\\2',text)
assert count==1,'Android updates flag missing'
p.write_text(text)
p=root/'android/app/src/main/res/values/strings.xml'; text=p.read_text()
for key,value in [('app_name','Lotti Baby QA'),('expo_runtime_version',runtime)]:
 text,count=re.subn(r'(<string name="'+key+r'">)[^<]*(</string>)',lambda m:m[1]+value+m[2],text)
 assert count==1,key+' missing'
p.write_text(text)
assert plistlib.loads((root/'ios/LottiBaby/Supporting/Expo.plist').read_bytes())['EXUpdatesEnabled'] is False
ns='{http://schemas.android.com/apk/res/android}'
app=ET.parse(root/'android/app/src/main/AndroidManifest.xml').find('application')
assert next(e for e in app.findall('meta-data') if e.get(ns+'name')=='expo.modules.updates.ENABLED').get(ns+'value')=='false'
print(json.dumps({'iosUpdates':False,'androidUpdates':False,'runtimeVersion':runtime,'name':'Lotti Baby QA'}))
`], { input: JSON.stringify({ directory: destination, version: config.version }), encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr || 'Native QA configuration failed');
console.log(result.stdout.trim());
