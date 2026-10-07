export const POLICY_VERSION = '2026-09-11';
export type Scope = 'account' | 'data';
export type Job = {
  id: string; user_id: string; scope: Scope; phase: string; lease: string; attempts: number;
};
export type StoredObject = { bucket: string; path: string };
export type ProviderTask = { provider: string; status: string };
export class DeletionError extends Error {
  constructor(public code: string, public manual = false) { super(code); }
}
export const publicResponse = (body: unknown, status = 200, origin?: string) => new Response(JSON.stringify(body), {
  status, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  },
});
export const secureEqual = (a: string, b: string) => {
  const left = new TextEncoder().encode(a); const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return difference === 0;
};
export async function readSmallBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new DeletionError('invalid_request');
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 4096) { await reader.cancel(); throw new DeletionError('request_too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new DeletionError('invalid_request'); }
}
export async function workerRpc(admin: any, action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await admin.rpc('account_deletion_worker', { action, payload });
  if (error) {
    const safeCodes = ['active_deletion_scope_conflict','deletion_retention_not_configured','deletion_inventory_not_approved','deletion_access_guard_not_installed','shared_media_review_required','recent_authentication_required','shared_baby_content_review_required','shared_baby_review_required',
      'shared_group_review_required','unresolved_foreign_key','residual_database_rows','residual_storage_objects',
      'late_storage_objects','lease_lost','previous_reset_requires_archival'];
    const code = safeCodes.find((c) => String(error.message).includes(c)) ?? 'deletion_database_failed';
    throw new DeletionError(code, code !== 'deletion_database_failed' && code !== 'lease_lost');
  }
  return data;
}
