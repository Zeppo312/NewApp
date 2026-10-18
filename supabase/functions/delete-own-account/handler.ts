import { DeletionError, publicResponse, readSmallBody } from '../_shared/accountDeletion/contracts.ts';
import { deleteRevenueCatCustomer } from '../_shared/accountDeletion/revenuecat.ts';

type Dependencies = { env: (key: string) => string | undefined; createAdmin: (url: string, key: string) => any; fetcher?: typeof fetch };
type StoredObject = { bucket: string; path: string };

// Self-service deletion for standalone accounts. Shared accounts (partner link,
// shared baby, caretaker access, shared media) stay on the reviewed job path.
// begin waits for in-flight writes and persists the barrier + file inventory;
// verify re-checks sharing on a fresh snapshot; erase deletes rows and the
// auth user atomically. A failure after begin keeps the barrier and the request
// resumable: every step is idempotent and a retry continues.
const knownCodes = ['standalone_check_failed', 'direct_scope_conflict', 'direct_request_missing', 'residual_storage_objects',
  'residual_database_rows', 'unresolved_foreign_key', 'deletion_dependency_limit', 'auth_still_exists', 'direct_review_required',
  'direct_not_verified', 'invalid_request'];
async function directRpc(admin: any, action: string, payload: Record<string, unknown>) {
  const { data, error } = await admin.rpc('account_deletion_direct', { action, payload });
  if (error) {
    const message = String(error.message ?? '');
    const code = knownCodes.find((c) => message.includes(c)) ?? 'deletion_database_failed';
    throw new DeletionError(code === 'standalone_check_failed' ? 'shared_account' : code);
  }
  return data;
}

export const createDirectDeletionHandler = ({ env, createAdmin, fetcher }: Dependencies) => async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'GET' && req.method !== 'POST') return publicResponse({ error: 'method_not_allowed' }, 405);
  const url = env('SUPABASE_URL'); const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key || env('ACCOUNT_DELETION_DIRECT_DISABLED') === 'true') {
    return req.method === 'GET' ? publicResponse({ available: false, reason: 'disabled', pending: null }) : publicResponse({ error: 'deletion_unavailable' }, 503);
  }
  const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return publicResponse({ error: 'unauthorized' }, 401);
  let admin: any = null; let userId: string | null = null; let started = false;
  try {
    admin = createAdmin(url, key);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user?.id) return publicResponse({ error: 'unauthorized' }, 401);
    userId = data.user.id as string;
    if (req.method === 'GET') {
      const check = await directRpc(admin, 'check', { userId });
      return publicResponse({ available: check?.available === true, reason: check?.reason ?? null, pending: check?.pending ?? null });
    }

    const body = await readSmallBody(req);
    if (body.confirm !== true || !['account', 'data'].includes(String(body.scope)) ||
      Object.keys(body).some((k) => !['confirm', 'scope'].includes(k))) {
      return publicResponse({ error: 'invalid_request' }, 400);
    }
    const scope = body.scope as 'account' | 'data';

    await directRpc(admin, 'begin', { userId, scope });
    started = true;
    const verified = await directRpc(admin, 'verify', { userId, scope });
    if (verified?.cancelled === true) {
      // Shared on a fresh look; the request was withdrawn before any removal.
      started = false;
      return publicResponse({ error: 'shared_account', reason: verified.reason ?? null, resumable: false }, 409);
    }
    const objects: StoredObject[] = Array.isArray(verified?.objects) ? verified.objects : [];
    for (const bucket of [...new Set(objects.map((o) => o.bucket))]) {
      const paths = objects.filter((o) => o.bucket === bucket).map((o) => o.path);
      for (let i = 0; i < paths.length; i += 100) {
        const { error: removeError } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
        if (removeError) throw new DeletionError('storage_delete_failed');
      }
    }
    // Verifies that no object remains, then rows + auth user in one transaction.
    await directRpc(admin, 'erase', { userId, scope });

    if (scope === 'account') {
      // RevenueCat keeps purchase history per app user id. Best effort: the
      // store subscription itself is managed and cancelled by the user.
      try { await deleteRevenueCatCustomer(userId, env, fetcher); }
      catch (e) { console.warn('direct_deletion_revenuecat_pending', e instanceof DeletionError ? e.code : 'unknown'); }
    }
    console.log('direct_deletion_completed', scope);
    return publicResponse({ deleted: true, scope });
  } catch (e) {
    const code = e instanceof DeletionError ? e.code : 'temporary_failure';
    if (started && admin && userId) {
      // The barrier stays in place; the user resumes from the deletion screen.
      try { await directRpc(admin, 'fail', { userId, code }); } catch { /* status stays in_progress, still blocked */ }
    }
    if (code !== 'shared_account') console.error('direct_deletion_failed', code);
    const status = code === 'shared_account' || code === 'direct_scope_conflict' ? 409 : code === 'invalid_request' ? 400 : code === 'request_too_large' ? 413 : 503;
    return publicResponse({ error: code, resumable: started }, status);
  }
};
