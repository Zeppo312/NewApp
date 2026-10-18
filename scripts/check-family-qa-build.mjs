import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBackendEnvironment } from '../lib/backendEnvironment.js';

export async function verifyFamilyQaBuild(env = process.env, root = process.cwd()) {
  const qa = resolveBackendEnvironment(env.EXPO_PUBLIC_BACKEND_ENV,
    env.EXPO_PUBLIC_QA_SUPABASE_URL, env.EXPO_PUBLIC_QA_SUPABASE_KEY, env.EXPO_PUBLIC_QA_PROJECT_REF);
  const qaProfile = env.EAS_BUILD_PROFILE?.startsWith('family-qa');
  if (qaProfile && !qa) throw new Error('QA build profile requires an isolated backend');
  if (!qa) return { qa: false };
  if (!qaProfile) throw new Error('QA backend requires an explicit QA build profile');
  const platform = env.EAS_BUILD_PLATFORM;
  if (!['ios', 'android'].includes(platform)) throw new Error('QA build platform missing');
  const sdkKey = platform === 'ios' ? env.EXPO_PUBLIC_RC_IOS_KEY : env.EXPO_PUBLIC_RC_ANDROID_KEY;
  if (!(platform === 'ios' ? /^appl_/ : /^goog_/).test(sdkKey ?? '')) throw new Error('Actual store SDK key required');
  const { expo } = JSON.parse(await readFile(resolve(root, 'app.json'), 'utf8'));
  const runtime = `family-qa-${expo.version}`;
  if (platform === 'ios') {
    const plist = await readFile(resolve(root, 'ios/LottiBaby/Supporting/Expo.plist'), 'utf8');
    if ((plist.match(/<key>EXUpdatesEnabled<\/key>/g) ?? []).length !== 1 ||
      !/<key>EXUpdatesEnabled<\/key>\s*<false\s*\/>/.test(plist) ||
      plist.match(/<key>EXUpdatesRuntimeVersion<\/key>\s*<string>([^<]*)<\/string>/)?.[1] !== runtime) throw new Error('Native iOS QA update isolation missing');
  } else {
    const manifest = await readFile(resolve(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
    const entries = (manifest.match(/<meta-data\b[^>]*>/g) ?? [])
      .filter(tag => tag.includes('android:name="expo.modules.updates.ENABLED"'));
    const strings = await readFile(resolve(root, 'android/app/src/main/res/values/strings.xml'), 'utf8');
    const runtimeEntries = (manifest.match(/<meta-data\b[^>]*>/g) ?? [])
      .filter(tag => tag.includes('android:name="expo.modules.updates.EXPO_RUNTIME_VERSION"'));
    if (entries.length !== 1 || !entries[0].includes('android:value="false"') ||
      runtimeEntries.length !== 1 || !runtimeEntries[0].includes('android:value="@string/expo_runtime_version"') ||
      !strings.includes(`<string name="expo_runtime_version">${runtime}</string>`)) throw new Error('Native Android QA update isolation missing');
  }
  return { qa: true, platform, runtime, projectRef: qa.projectRef };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyFamilyQaBuild().then(result => console.log('Family QA build isolation:', JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
