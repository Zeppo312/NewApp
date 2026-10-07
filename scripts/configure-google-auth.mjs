import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const NATIVE_GOOGLE_REDIRECT = 'com.lottibaby.app://auth/google-callback?attempt=*';

export function readGoogleWebClient(value, projectRef, callbackVerification) {
  const client = value?.web;
  if (!client?.client_id?.endsWith('.apps.googleusercontent.com') ||
      typeof client.client_secret !== 'string' || !client.client_secret) {
    throw new Error('A downloaded Google OAuth JSON file for a Web application is required.');
  }
  const callback = `https://${projectRef}.supabase.co/auth/v1/callback`;
  // Google no longer re-downloads existing secrets. An unchanged original
  // download may be paired with a recent, separately recorded Console check.
  const verifiedAt = Date.parse(callbackVerification?.verifiedAt ?? '');
  const age = Date.now() - verifiedAt;
  const consoleVerified = callbackVerification?.method === 'google-cloud-console'
    && callbackVerification.projectRef === projectRef
    && callbackVerification.clientId === client.client_id
    && callbackVerification.callback === callback
    && Number.isFinite(age) && age >= 0 && age <= 24 * 60 * 60 * 1000;
  if (!client.redirect_uris?.includes(callback) && !consoleVerified) {
    throw new Error(`Add this authorized redirect URI to the Google Web client and download its JSON again: ${callback}`);
  }
  return { clientId: client.client_id, clientSecret: client.client_secret };
}

export function googleAuthPatch(current, credentials, webOrigin) {
  const redirects = new Set(String(current.uri_allow_list ?? '').split(',').map(x => x.trim()).filter(Boolean));
  redirects.add(NATIVE_GOOGLE_REDIRECT);
  if (webOrigin) {
    const origin = new URL(webOrigin);
    if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))) {
      throw new Error('Web origin must use HTTPS, or HTTP on localhost for development.');
    }
    redirects.add(`${origin.origin}/auth/google-callback?attempt=*`);
  }
  return {
    external_google_enabled: true,
    external_google_client_id: credentials.clientId,
    external_google_secret: credentials.clientSecret,
    uri_allow_list: [...redirects].join(','),
  };
}

async function getManagementToken() {
  let token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token && process.platform === 'darwin') {
    for (const account of ['access-token', 'supabase']) {
      try {
        token = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-a', account, '-w'],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (token) break;
      } catch { /* Try the documented legacy CLI account next. */ }
    }
  }
  if (!token) token = await readFile(join(homedir(), '.supabase', 'access-token'), 'utf8').catch(() => '');
  if (token?.startsWith('go-keyring-base64:')) token = Buffer.from(token.slice('go-keyring-base64:'.length), 'base64').toString('utf8');
  if (!token?.trim()) throw new Error('Log in with supabase login, or supply SUPABASE_ACCESS_TOKEN.');
  return token.trim();
}

async function main(args) {
  const allowed = new Set(['--check', '--apply', '--project-ref', '--credentials-file', '--web-origin', '--callback-verification-file']);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!allowed.has(arg)) throw new Error(`Unknown option: ${arg}`);
    if (arg === '--apply' || arg === '--check') options[arg] = true;
    else {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[arg] = args[++i];
    }
  }
  const ref = options['--project-ref'];
  if (!/^[a-z]{20}$/.test(ref ?? '')) throw new Error('Supply --project-ref with the intended Supabase project reference.');
  if (options['--check'] && options['--apply']) throw new Error('Choose --check or --apply.');
  let credentials;
  if (options['--apply']) {
    if (!options['--credentials-file']) throw new Error('--apply requires --credentials-file; never pass a secret as a command argument.');
    // The secret is read from the existing download and never printed or copied into the repository.
    const verification = options['--callback-verification-file']
      ? JSON.parse(await readFile(options['--callback-verification-file'], 'utf8')) : undefined;
    credentials = readGoogleWebClient(JSON.parse(await readFile(options['--credentials-file'], 'utf8')), ref, verification);
  }
  const token = await getManagementToken();
  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const request = async (method = 'GET', body) => {
    const response = await fetch(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20_000) });
    // Never print a backend response that might contain credentials.
    if (!response.ok) throw new Error(`Supabase Auth configuration request failed (HTTP ${response.status}).`);
    return response.json();
  };
  let config = await request();
  if (credentials) {
    await request('PATCH', googleAuthPatch(config, credentials, options['--web-origin']));
    config = await request();
    if (config.external_google_client_id !== credentials.clientId) throw new Error('Google client ID verification failed.');
  }
  const summary = {
    projectRef: ref,
    googleEnabled: config.external_google_enabled === true,
    clientIdPresent: Boolean(config.external_google_client_id),
    clientSecretPresent: Boolean(config.external_google_secret),
    nativeCallbackConfigured: String(config.uri_allow_list ?? '').split(',').includes(NATIVE_GOOGLE_REDIRECT),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.googleEnabled || !summary.clientIdPresent || !summary.clientSecretPresent || !summary.nativeCallbackConfigured) {
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(() => {
    // Avoid echoing parse errors or paths that might include confidential input.
    console.error('Google Auth setup failed. Check the project reference, Supabase login, and Web OAuth JSON with the correct redirect URI. No credentials were printed.');
    process.exitCode = 1;
  });
}
