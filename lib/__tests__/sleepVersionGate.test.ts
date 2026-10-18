import { SleepEntriesService } from '../services/SleepEntriesService';
import { readSleepCapability } from '../sleepSyncContract';
const mockFrom = jest.fn();
jest.mock('../supabase', () => ({ supabase: { from: (...args: any[]) => mockFrom(...args) } }));
jest.mock('../sleepSyncContract', () => ({ SLEEP_OFFLINE_ENABLED: true, readSleepCapability: jest.fn() }));
jest.mock('../lottiMomentEvents', () => ({ emitLottiMoment: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); jest.mocked(readSleepCapability).mockResolvedValue(false); });
it('rejects every S service write without server capability instead of dispatching legacy DML', async () => {
  const service = new SleepEntriesService('actor');
  const results = await Promise.all([
    service.createEntry({ user_id: 'actor', baby_id: 'baby', start_time: new Date().toISOString() }),
    service.updateEntry('original', { end_time: new Date().toISOString() }),
    service.deleteEntry('original'),
  ]);
  expect(results.every(result => !result.success && result.primary.error)).toBe(true);
  expect(mockFrom).not.toHaveBeenCalled();
});
it('does not run legacy read-side auto-closing or an unscoped create in the S client', async () => {
  const service = new SleepEntriesService('actor');
  expect((await service.getEntries('baby')).error).toBeTruthy();
  jest.mocked(readSleepCapability).mockResolvedValue(true);
  expect((await service.createEntry({ user_id: 'actor', start_time: new Date().toISOString() })).success).toBe(false);
  expect(mockFrom).not.toHaveBeenCalled();
});
