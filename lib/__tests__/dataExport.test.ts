import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { exportUserData } from '../dataExport';
import { getCachedUser, supabase } from '../supabase';
import { readTrackingOutbox } from '../trackingOutbox';

jest.mock('../supabase', () => ({ getCachedUser: jest.fn(), supabase: { from: jest.fn() } }));
jest.mock('../sleepSyncContract', () => ({ SLEEP_OFFLINE_ENABLED: false }));
jest.mock('../trackingOutbox', () => ({ readTrackingOutbox: jest.fn().mockResolvedValue([]) }));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///test/', EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 100 }),
}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn().mockResolvedValue({ uri: 'file:///test/export.pdf' }) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(false) }));

let babies: { id: string; name: string }[];
let babyError: { code: string; message: string } | null;
let allQueriesFail = false;
let queriesThrow = false;
const filters: Record<string, jest.Mock> = {};

beforeEach(() => {
  jest.clearAllMocks();
  babies = []; babyError = null; allQueriesFail = false; queriesThrow = false;
  jest.mocked(readTrackingOutbox).mockResolvedValue([]);
  jest.mocked(getCachedUser).mockResolvedValue({ data: { user: { id: 'qa-owner' } }, error: null } as any);
  jest.mocked(supabase.from).mockImplementation((table: string) => {
    if (queriesThrow) throw new Error('Synthetic connection failure');
    const rows = table === 'baby_info' ? babies : [];
    const error = allQueriesFail
      ? { code: 'NETWORK', message: 'Synthetic connection failure' }
      : table === 'baby_info' ? babyError : null;
    const eq = jest.fn(() => query); filters[table] = eq;
    const query: any = {
      select: () => query, eq, order: () => query, or: () => query,
      maybeSingle: async () => rows.length > 1
        ? { data: null, error: { code: 'PGRST116', message: 'Multiple rows' } }
        : { data: rows[0] ?? null, error },
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: rows, error }).then(resolve),
    };
    return query;
  });
});

const exportedPayload = (format: 'json' | 'pdf') => {
  if (format === 'json') return JSON.parse(jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][1]);
  const html = jest.mocked(Print.printToFileAsync).mock.calls[0][0]!.html!;
  const encoded = html.match(/<pre>([\s\S]*?)<\/pre>/)![1];
  return JSON.parse(encoded.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
};

describe.each(['json', 'pdf'] as const)('%s child profile export', (format) => {
  it.each([0, 1, 2])('exports all %i own children', async (count) => {
    babies = Array.from({ length: count }, (_, i) => ({ id: `qa-child-${i}`, name: `QA Child ${i}` }));
    const result = await exportUserData(format);
    expect(result.success).toBe(true);
    const payload = exportedPayload(format);
    expect(payload.data.baby_info).toEqual(babies);
    expect(result.summary?.baby_info).toBe(count);
    expect(payload.warnings).toEqual([]);
    expect(filters.baby_info).toHaveBeenCalledWith('user_id', 'qa-owner');
  });

  it('reports a failed child query instead of silently treating it as no children', async () => {
    babyError = { code: 'PGRST116', message: 'Synthetic child query error' };
    const result = await exportUserData(format);
    expect(result.success).toBe(true);
    expect(result.warnings).toContain('baby_info: Synthetic child query error');
    expect(exportedPayload(format).warnings).toContain('baby_info: Synthetic child query error');
  });

  it.each(['response', 'throw'] as const)('does not create or share an export when every query fails (%s)', async (failure) => {
    allQueriesFail = failure === 'response';
    queriesThrow = failure === 'throw';
    const result = await exportUserData(format);
    expect(result.success).toBe(false);
    expect(result.warnings).toHaveLength(jest.mocked(supabase.from).mock.calls.length);
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
    expect(Sharing.isAvailableAsync).not.toHaveBeenCalled();
  });

  it('does not present pending local records as a successful server export while offline', async () => {
    allQueriesFail = true;
    jest.mocked(readTrackingOutbox).mockResolvedValue([{ state: 'pending' }] as any);
    const result = await exportUserData(format);
    expect(result.success).toBe(false);
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
  });

  it('can export normally after a failed attempt and reconnection', async () => {
    allQueriesFail = true;
    expect((await exportUserData(format)).success).toBe(false);
    allQueriesFail = false;
    babies = [{ id: 'qa-child', name: 'QA Child' }];
    const result = await exportUserData(format);
    expect(result.success).toBe(true);
    expect(exportedPayload(format).data.baby_info).toEqual(babies);
  });
});
