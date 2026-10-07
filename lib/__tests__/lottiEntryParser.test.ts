let mockHandler: (request: Request) => Promise<Response>;
const mockFeatureAccess = jest.fn();
const mockGetUser = jest.fn();
const mockFetch = jest.fn();
const mockInsert = jest.fn();
const mockGte = jest.fn();
const mockRpc = jest.fn();

jest.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({
  serve: (handler: typeof mockHandler) => { mockHandler = handler; },
}), { virtual: true });
jest.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({ eq: () => ({ gte: (...args: unknown[]) => mockGte(...args) }) }),
      insert: (...args: unknown[]) => mockInsert(...args),
    }),
  }),
}), { virtual: true });
jest.mock('../../supabase/functions/_shared/premiumAccess', () => ({
  verifySubscriptionFeatureAccess: (...args: unknown[]) => mockFeatureAccess(...args),
}));

// Register the edge handler with mocked runtime dependencies.
jest.requireActual('../../supabase/functions/voice-log-parse/index');

const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(global, { Deno: { env: { get: () => 'test-key' } }, fetch: mockFetch });
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-id' } } });
  mockFeatureAccess.mockResolvedValue({ allowed: true });
  mockRpc.mockResolvedValue({ data: true, error: null });
  mockGte.mockResolvedValue({ data: [], error: null });
  mockInsert.mockResolvedValue({ error: null });
});
afterAll(() => { global.fetch = originalFetch; });

const request = (body: object) => new Request('https://example.test/voice-log-parse', {
  method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
  body: JSON.stringify({ deviceNow: '2026-09-06T12:00', locale: 'de', mode: 'pregnancy', ...body }),
});
const modelResponse = (entries: unknown[]) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ entries }) } }] }) });

it('extracts and sanitizes doctor questions from chat in pregnancy mode without transcribing', async () => {
  mockFetch.mockResolvedValue(modelResponse([
    { type: 'doctor_question', note: '  Welche Untersuchungen stehen an?  ', timer_requested: true },
    { type: 'doctor_question', note: '  ' },
    { type: 'sleep', start_local: '2026-09-06T12:00' },
  ]));
  const response = await mockHandler(request({ text: 'Fragen zu Untersuchungen notieren.' }));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.entries).toHaveLength(1);
  expect(result.entries[0]).toMatchObject({ type: 'doctor_question', note: 'Welche Untersuchungen stehen an?', timer_requested: false, feeding_type: null });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFeatureAccess.mock.calls[0][2]).toBe('fragLotti');
});

it('filters baby tracking from chat answers even after birth', async () => {
  mockFetch.mockResolvedValue(modelResponse([{ type: 'sleep', start_local: '2026-09-06T12:00' }]));
  const result = await (await mockHandler(request({ text: 'Beispiel: eine Stunde schlafen.', mode: 'baby' }))).json();
  expect(result.entries).toEqual([]);
});

it('keeps voice doctor questions and uses voice access', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'Arzt fragen, welche Untersuchungen anstehen.' }) });
  mockFetch.mockResolvedValueOnce(modelResponse([{ type: 'doctor_question', note: 'Welche Untersuchungen stehen an?' }]));
  const response = await mockHandler(request({ audioBase64: 'YQ==', mimeType: 'audio/mp4' }));
  expect(response.status).toBe(200);
  expect((await response.json()).entries[0].type).toBe('doctor_question');
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockFeatureAccess.mock.calls[0][2]).toBe('voiceLog');
});

it.each(['', 'a'.repeat(12001)])('rejects invalid text before model calls', async (text) => {
  expect((await mockHandler(request({ text }))).status).toBe(400);
  expect(mockFetch).not.toHaveBeenCalled();
});

it('requires authentication and feature access before extraction', async () => {
  mockGetUser.mockResolvedValueOnce({ data: { user: null } });
  expect((await mockHandler(request({ text: 'Arztfrage' }))).status).toBe(401);
  mockFeatureAccess.mockResolvedValueOnce({ allowed: false });
  expect((await mockHandler(request({ text: 'Arztfrage' }))).status).toBe(403);
  expect(mockFetch).not.toHaveBeenCalled();
});
