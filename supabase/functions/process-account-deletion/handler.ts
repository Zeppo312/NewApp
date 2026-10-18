import { DeletionError, type Job, type StoredObject, type ProviderTask, publicResponse, secureEqual, workerRpc } from '../_shared/accountDeletion/contracts.ts';
import { deleteRevenueCatCustomer } from '../_shared/accountDeletion/revenuecat.ts';
import { purgeDeletedObjectCache } from '../_shared/accountDeletion/storageCache.ts';

type Dependencies = { env: (key: string) => string | undefined; createAdmin: (url: string, key: string) => any; fetcher?: typeof fetch };
export const createProcessHandler = ({ env, createAdmin, fetcher }: Dependencies) => async (req: Request) => {
  if (req.method !== 'POST') return publicResponse({ error: 'method_not_allowed' }, 405);
  const secret = env('ACCOUNT_DELETION_CRON_SECRET');
  if (!secret || secret.length < 32 || !secureEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return publicResponse({ error: 'unauthorized' }, 401);
  const url = env('SUPABASE_URL'); const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key || env('ACCOUNT_DELETION_ENABLED') !== 'true') return publicResponse({ error: 'deletion_unavailable' }, 503);
  const admin = createAdmin(url, key); let job: Job | null = null;
  try {
    await workerRpc(admin, 'purge_receipts');
    job = await workerRpc(admin, 'claim');
    if (!job) return publicResponse({ processed: false });
    const identity = { requestId: job.id, lease: job.lease };
    // One bounded phase per invocation. No fire-and-forget work after response.
    switch (job.phase) {
      case 'inventory': {
        if (job.scope === 'account') {
          const ban = await admin.auth.admin.updateUserById(job.user_id, { ban_duration: '876000h' });
          if (ban.error) throw new DeletionError('auth_suspend_failed');
        }
        await workerRpc(admin, 'inventory', identity);
        break;
      }
      case 'storage': {
        const objects: StoredObject[] = (await workerRpc(admin, 'objects', identity)).slice(0,3);
        if (!objects.length) { await workerRpc(admin, 'storage_done', identity); break; }
        for (const bucket of [...new Set(objects.map((o) => o.bucket))]) {
          const group = objects.filter((o) => o.bucket === bucket);
          const { error } = await admin.storage.from(bucket).remove(group.map((o) => o.path));
          if (error) throw new DeletionError('storage_delete_failed');
          // Check object metadata independently after successful binary deletion.
          // download() is not used: it would fetch private media into the worker.
          for (const object of group) {
            const slash = object.path.lastIndexOf('/');
            const folder = slash < 0 ? '' : object.path.slice(0, slash);
            const name = object.path.slice(slash + 1);
            const { data, error: listError } = await admin.storage.from(bucket).list(folder, { search: name, limit: 100 });
            if (listError || !Array.isArray(data)) throw new DeletionError('storage_verification_failed');
            if (data.some((entry: any) => entry.name === name)) throw new DeletionError('storage_object_remains');
            await purgeDeletedObjectCache(url,key,object,fetcher);
          }
          await workerRpc(admin, 'objects_removed', { ...identity, objects: group });
        }
        break;
      }
      case 'database': await workerRpc(admin, 'database', identity); break;
      case 'auth': {
        if (job.scope === 'account') {
          const { data, error } = await admin.auth.admin.getUserById(job.user_id);
          if (error && error.status !== 404 && error.code !== 'user_not_found') throw new DeletionError('auth_lookup_failed');
          if (data?.user) {
            const deleted = await admin.auth.admin.deleteUser(job.user_id, false);
            if (deleted.error) throw new DeletionError('auth_delete_failed');
          }
        }
        await workerRpc(admin, 'auth_done', identity);
        break;
      }
      case 'providers':
      case 'verify': {
        const providers: ProviderTask[] = await workerRpc(admin, 'providers', identity);
        if (providers.some((p) => p.provider === 'revenuecat' && p.status === 'pending') && job.scope === 'account') {
          try {
            const evidence = await deleteRevenueCatCustomer(job.user_id, env, fetcher);
            await workerRpc(admin, 'resolve_provider', { requestId: job.id, provider: 'revenuecat', status: 'completed', evidence, operator: 'deletion-worker' });
          } catch (error) {
            if (!(error instanceof DeletionError && error.manual)) throw error;
            // Other local work is done; the pending provider remains visible.
          }
        }
        await workerRpc(admin, 'verify', identity);
        return publicResponse({ processed: true });
      }
      default: throw new DeletionError('unknown_phase', true);
    }
    await workerRpc(admin, 'release', identity);
    return publicResponse({ processed: true });
  } catch (error) {
    const failure = error instanceof DeletionError ? error : new DeletionError('temporary_failure');
    if (job && failure.code !== 'lease_lost') {
      try { await workerRpc(admin, 'fail', { requestId: job.id, lease: job.lease, code: failure.code, manual: failure.manual }); } catch { /* Lease expiry resumes the durable job. */ }
    }
    return publicResponse({ error: failure.code }, 503);
  }
};
