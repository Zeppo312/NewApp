import { DeletionError } from './contracts.ts';
export async function deleteRevenueCatCustomer(
  userId: string, env: (key: string) => string | undefined, fetcher: typeof fetch = fetch,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<string> {
  const project = env('REVENUECAT_PROJECT_ID'); const key = env('REVENUECAT_DELETION_API_KEY');
  if (!project || !key) throw new DeletionError('revenuecat_not_configured', true);
  const base = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(project)}/customers/${encodeURIComponent(userId)}`;
  const call = (url: string, method = 'GET') => fetcher(url, { method, headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
  const before = await call(base);
  if (before.status === 404) {
    // A wrong project or missing customer identity can also yield 404. Require
    // operator evidence; never infer complete GDPR erasure from this alone.
    throw new DeletionError('revenuecat_identity_review_required', true);
  }
  if (!before.ok) throw new DeletionError('revenuecat_lookup_failed', [401,403].includes(before.status));
  const customer = await before.json();
  if (customer.id !== userId) throw new DeletionError('revenuecat_identity_review_required', true);
  let page: string | null = `${base}/aliases`;
  while (page) {
    const aliases = await call(page);
    if (!aliases.ok) throw new DeletionError('revenuecat_alias_lookup_failed');
    const data = await aliases.json();
    if (!Array.isArray(data.items)) throw new DeletionError('revenuecat_invalid_response', true);
    if (data.items.some((a: any) => a.id !== userId && !String(a.id).startsWith('$RCAnonymousID:'))) throw new DeletionError('revenuecat_shared_identity', true);
    // Ambiguous pagination is a manual case, never follow an untrusted URL
    // with an Authorization header or silently truncate the alias inventory.
    if (data.next_page) throw new DeletionError('revenuecat_alias_review_required', true);
    page = null;
  }
  const deleted = await call(base, 'DELETE');
  if (!deleted.ok) throw new DeletionError('revenuecat_delete_failed', [401,403].includes(deleted.status));
  // RevenueCat queues DELETE asynchronously. Verify absence with bounded
  // polling; a 200 response to DELETE alone is not proof of erasure.
  let removed = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await pause(1000 * 2 ** (attempt - 1));
    const after = await call(base);
    if (after.status === 404) { removed = true; break; }
    if (!after.ok) throw new DeletionError('revenuecat_verification_failed');
  }
  if (!removed) throw new DeletionError('revenuecat_verification_pending');
  return `RevenueCat API DELETE acknowledged; subsequent GET returned 404; project ${project}; ${new Date().toISOString()}`;
}
