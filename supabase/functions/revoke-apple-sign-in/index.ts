// Revokes Sign in with Apple access before a user account is deleted.
// Required env vars: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, APPLE_PRIVATE_KEY.

// @ts-ignore - Deno edge function import.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno edge function import.
import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore - Deno edge function import.
import { SignJWT, importPKCS8 } from 'https://esm.sh/jose@5.9.6';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const APPLE_PROVIDER = 'apple';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RevokeAppleSignInBody = {
  authorizationCode?: string;
  appleUser?: string | null;
};

type AppleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const getRequiredEnv = (key: string) => {
  const value = Deno.env.get(key)?.trim();
  if (!value) {
    throw new HttpError(500, `Missing environment variable: ${key}`);
  }
  return value;
};

const normalizePrivateKey = (value: string) => {
  const normalized = value.replace(/\\n/g, '\n').trim();
  if (normalized.includes('BEGIN PRIVATE KEY')) {
    return normalized;
  }

  return `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----`;
};

const decodeBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const extractJwtSubject = (jwt: string | undefined) => {
  if (!jwt) return null;

  const [, payload] = jwt.split('.');
  if (!payload) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(payload));
    return typeof parsed.sub === 'string' ? parsed.sub : null;
  } catch (error) {
    console.warn('Could not decode Apple id_token subject:', error);
    return null;
  }
};

const isAppleLinkedUser = (user: User | null) => {
  if (!user) return false;

  const primaryProvider = String(user.app_metadata?.provider ?? '').toLowerCase();
  const linkedProviders = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.map((provider) => String(provider).toLowerCase())
    : [];

  if (primaryProvider === APPLE_PROVIDER) {
    return true;
  }

  if (linkedProviders.includes(APPLE_PROVIDER)) {
    return true;
  }

  return user.identities?.some(
    (identity) => String(identity.provider ?? '').toLowerCase() === APPLE_PROVIDER,
  ) ?? false;
};

const getAppleIdentitySubject = (user: User | null) => {
  const appleIdentity = user?.identities?.find(
    (identity) => String(identity.provider ?? '').toLowerCase() === APPLE_PROVIDER,
  );

  return typeof appleIdentity?.identity_data?.sub === 'string'
    ? appleIdentity.identity_data.sub
    : null;
};

const createAuthenticatedClient = (req: Request) => {
  const supabaseUrl = getRequiredEnv('SUPABASE_URL');
  const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');
  const authorization = req.headers.get('Authorization');

  if (!authorization) {
    throw new HttpError(401, 'Not authenticated');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const createAppleClientSecret = async () => {
  const teamId = getRequiredEnv('APPLE_TEAM_ID');
  const keyId = getRequiredEnv('APPLE_KEY_ID');
  const clientId = getRequiredEnv('APPLE_CLIENT_ID');
  const privateKeyPem = normalizePrivateKey(getRequiredEnv('APPLE_PRIVATE_KEY'));
  const privateKey = await importPKCS8(privateKeyPem, 'ES256');

  const clientSecret = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
    .setIssuer(teamId)
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  return { clientId, clientSecret };
};

const exchangeAppleAuthorizationCode = async (
  authorizationCode: string,
  clientId: string,
  clientSecret: string,
) => {
  const response = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorizationCode,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const payload = (await response.json().catch(() => null)) as AppleTokenResponse | null;

  if (!response.ok || payload?.error) {
    const appleError = payload?.error_description || payload?.error || 'Apple token exchange failed.';
    const status = payload?.error === 'invalid_grant' ? 400 : 502;
    throw new HttpError(status, `Apple-Bestätigung konnte nicht verarbeitet werden: ${appleError}`);
  }

  if (!payload) {
    throw new HttpError(502, 'Apple hat keine gültige Antwort für den Token-Tausch geliefert.');
  }

  return payload;
};

const revokeAppleToken = async (
  token: string,
  tokenTypeHint: 'access_token' | 'refresh_token',
  clientId: string,
  clientSecret: string,
) => {
  const response = await fetch(APPLE_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokenTypeHint,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as AppleTokenResponse | null;
    const appleError = payload?.error_description || payload?.error || 'Apple token revoke failed.';
    throw new HttpError(502, `Apple-Zugriff konnte nicht widerrufen werden: ${appleError}`);
  }
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed');
    }

    const body = (await req.json()) as RevokeAppleSignInBody;
    const authorizationCode = body.authorizationCode?.trim();

    if (!authorizationCode) {
      throw new HttpError(400, 'Ein Apple-Bestätigungscode fehlt.');
    }

    const supabase = createAuthenticatedClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new HttpError(401, 'Not authenticated');
    }

    if (!isAppleLinkedUser(user)) {
      throw new HttpError(400, 'Das aktuelle Konto ist nicht mit Apple verknüpft.');
    }

    const expectedAppleSubject = getAppleIdentitySubject(user);
    const { clientId, clientSecret } = await createAppleClientSecret();
    const appleTokens = await exchangeAppleAuthorizationCode(authorizationCode, clientId, clientSecret);
    const returnedAppleSubject = extractJwtSubject(appleTokens.id_token);

    if (expectedAppleSubject && returnedAppleSubject && expectedAppleSubject !== returnedAppleSubject) {
      throw new HttpError(400, 'Die Apple-Bestätigung passt nicht zum aktuell angemeldeten Konto.');
    }

    if (
      expectedAppleSubject &&
      !returnedAppleSubject &&
      typeof body.appleUser === 'string' &&
      body.appleUser.trim() &&
      expectedAppleSubject !== body.appleUser.trim()
    ) {
      throw new HttpError(400, 'Die Apple-Bestätigung passt nicht zum aktuell angemeldeten Konto.');
    }

    const tokenToRevoke = appleTokens.refresh_token ?? appleTokens.access_token;
    if (!tokenToRevoke) {
      throw new HttpError(502, 'Apple hat kein widerrufbares Token zurückgegeben.');
    }

    await revokeAppleToken(
      tokenToRevoke,
      appleTokens.refresh_token ? 'refresh_token' : 'access_token',
      clientId,
      clientSecret,
    );

    return jsonResponse({ success: true });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ revoke-apple-sign-in failed:', message);
    return jsonResponse({ success: false, error: message }, status);
  }
});
