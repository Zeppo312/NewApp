/** @jest-environment node */
import { createDirectDeletionHandler } from '../../supabase/functions/delete-own-account/handler';
const userId = '11111111-1111-4111-8111-111111111111';
const env: Record<string, string> = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only' };
type Rpc = { data: unknown; error: { message: string } | null };
function setup(overrides: Record<string, Rpc> = {}) {
  const remove = jest.fn().mockResolvedValue({ error: null });
  const defaults: Record<string, Rpc> = {
    check: { data: { available: true, reason: null, pending: null }, error: null },
    begin: { data: { requestId: 'r', attempts: 1 }, error: null },
    verify: { data: { cancelled: false, objects: [{ bucket: 'baby-profile-images', path: `${userId}/a.jpg` }, { bucket: 'chat-audio', path: `x/${userId}/b.m4a` }] }, error: null },
    erase: { data: { status: 'completed' }, error: null },
    fail: { data: { recorded: true }, error: null },
  };
  const rpc = jest.fn(async (_name: string, { action }: { action: string }) => (overrides[action] ?? defaults[action]));
  const admin = { rpc, storage: { from: jest.fn(() => ({ remove })) }, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }), admin: { deleteUser: jest.fn() } } };
  const fetcher = jest.fn().mockResolvedValue(new Response('{}', { status: 500 }));
  return { admin, remove, handle: createDirectDeletionHandler({ env: k => env[k], createAdmin: () => admin, fetcher }) };
}
const post = (body: unknown = { confirm: true, scope: 'account' }, headers: Record<string, string> = { Authorization: 'Bearer token' }) =>
  new Request('https://example.test/delete', { method: 'POST', headers, body: JSON.stringify(body) });
const actions = (admin: any) => admin.rpc.mock.calls.map((call: any[]) => call[1].action);
beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => undefined); jest.spyOn(console, 'warn').mockImplementation(() => undefined); jest.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => jest.restoreAllMocks());

it('reports standalone and pending status for the signed-in user only', async () => {
  const { handle, admin } = setup({ check: { data: { available: true, reason: null, pending: 'account' }, error: null } });
  const response = await handle(new Request('https://example.test/delete', { headers: { Authorization: 'Bearer token' } }));
  expect(await response.json()).toEqual({ available: true, reason: null, pending: 'account' });
  expect(admin.rpc).toHaveBeenCalledWith('account_deletion_direct', { action: 'check', payload: { userId } });
});
it('sets the barrier before removing binaries, then erases rows and login atomically', async () => {
  const { handle, admin, remove } = setup();
  const response = await handle(post());
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ deleted: true, scope: 'account' });
  expect(actions(admin)).toEqual(['begin', 'verify', 'erase']);
  expect(admin.rpc.mock.invocationCallOrder[1]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  expect(remove.mock.invocationCallOrder[1]).toBeLessThan(admin.rpc.mock.invocationCallOrder[2]);
  expect(admin.rpc).toHaveBeenLastCalledWith('account_deletion_direct', { action: 'erase', payload: { userId, scope: 'account' } });
  // Auth deletion runs inside the erase transaction, never as a separate API step.
  expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
});
it('passes the data scope through', async () => {
  const { handle, admin } = setup();
  expect((await handle(post({ confirm: true, scope: 'data' }))).status).toBe(200);
  expect(admin.rpc).toHaveBeenCalledWith('account_deletion_direct', { action: 'begin', payload: { userId, scope: 'data' } });
});
it('refuses shared accounts before touching any data', async () => {
  const { handle, admin, remove } = setup({ begin: { data: null, error: { message: 'standalone_check_failed:shared_media' } } });
  const response = await handle(post());
  expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'shared_account', resumable: false });
  expect(actions(admin)).toEqual(['begin']); expect(remove).not.toHaveBeenCalled();
});
it('withdraws without removing anything when verify finds sharing on a fresh snapshot', async () => {
  const { handle, admin, remove } = setup({ verify: { data: { cancelled: true, reason: 'shared_media' }, error: null } });
  const response = await handle(post());
  expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'shared_account', reason: 'shared_media', resumable: false });
  expect(actions(admin)).toEqual(['begin', 'verify']); expect(remove).not.toHaveBeenCalled();
});
it('records a storage failure, keeps the barrier and never erases rows', async () => {
  const { handle, admin, remove } = setup(); remove.mockResolvedValueOnce({ error: { message: 'boom' } });
  const response = await handle(post());
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'storage_delete_failed', resumable: true });
  expect(actions(admin)).toEqual(['begin', 'verify', 'fail']);
  expect(admin.rpc).toHaveBeenLastCalledWith('account_deletion_direct', { action: 'fail', payload: { userId, code: 'storage_delete_failed' } });
});
it('records a rolled-back database step as resumable', async () => {
  const { handle, admin } = setup({ erase: { data: null, error: { message: 'unresolved_foreign_key' } } });
  const response = await handle(post());
  expect(await response.json()).toEqual({ error: 'unresolved_foreign_key', resumable: true });
  expect(actions(admin)).toEqual(['begin', 'verify', 'erase', 'fail']);
});
it.each([{}, { confirm: false, scope: 'account' }, { confirm: true, scope: 'everything' }, { confirm: true, scope: 'account', userId: 'victim' }])('rejects malformed requests %j', async (body) => {
  const { handle, admin } = setup();
  expect((await handle(post(body))).status).toBe(400); expect(admin.rpc).not.toHaveBeenCalled();
});
it('requires a valid user token', async () => {
  const { handle, admin } = setup();
  expect((await handle(post(undefined, {}))).status).toBe(401);
  admin.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await handle(post())).status).toBe(401); expect(admin.rpc).not.toHaveBeenCalled();
});
it('can be switched off without a privileged client', async () => {
  const createAdmin = jest.fn();
  const handle = createDirectDeletionHandler({ env: k => k === 'ACCOUNT_DELETION_DIRECT_DISABLED' ? 'true' : env[k], createAdmin });
  expect((await handle(post())).status).toBe(503); expect(createAdmin).not.toHaveBeenCalled();
});
