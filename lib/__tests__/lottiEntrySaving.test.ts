const mockSaveDoctorQuestion = jest.fn();
const mockInvoke = jest.fn();
const mockReadAudio = jest.fn();

jest.mock('@/lib/supabase', () => ({
  saveDoctorQuestion: (...args: unknown[]) => mockSaveDoctorQuestion(...args),
  addBabyCareEntry: jest.fn(),
  supabase: { from: jest.fn(), functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: (...args: unknown[]) => mockReadAudio(...args) }));
jest.mock('@/lib/customActivities', () => ({ createCustomActivityType: jest.fn(), getCustomActivityTypes: jest.fn() }));
jest.mock('@/lib/shopping', () => ({ upsertShoppingItem: jest.fn() }));
jest.mock('@/lib/shoppingWidget', () => ({ refreshShoppingWidget: jest.fn() }));
jest.mock('@/lib/lottiMomentEvents', () => ({ emitLottiMoment: jest.fn() }));

// eslint-disable-next-line import/first
import { describeVoiceLogEntry, parseLottiEntries, parseVoiceRecording, saveVoiceLogEntries } from '../voiceLog/api';
// eslint-disable-next-line import/first
import type { VoiceLogParsedEntry } from '../voiceLog/types';

// Parser output for a question deliberately carries no date or activity fields.
const question = (note: string): VoiceLogParsedEntry => ({
  type: 'doctor_question', note, start_local: '', end_local: null,
  feeding_type: null, feeding_type_needs_confirmation: false, timer_requested: false,
  feeding_volume_ml: null, feeding_side: null, diaper_type: null,
  custom_activity_type_id: null, custom_name: null, custom_emoji: null, custom_color: null,
  custom_tracking_mode: null, custom_quantity: null, custom_unit: null,
  custom_create_type: false, custom_log_entry: false,
  shopping_title: null, shopping_quantity_value: null, shopping_quantity_unit: null,
  shopping_category: null, planner_kind: null, planner_title: null,
  planner_location: null, planner_all_day: false,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSaveDoctorQuestion.mockResolvedValue({ data: { id: 'saved' }, error: null });
});

it('saves a reviewed doctor question through the existing questions path without requiring a baby or date', async () => {
  const result = await saveVoiceLogEntries([question('  Was soll ich beim Ultraschall fragen?  ')], 'user', null);
  expect(mockSaveDoctorQuestion).toHaveBeenCalledWith('Was soll ich beim Ultraschall fragen?');
  expect(result).toEqual({ savedCount: 1, failedCount: 0, failedEntries: [] });
});

it('retains only failed questions for retry, without duplicating successful saves', async () => {
  const first = question('Erste Frage?');
  const second = question('Zweite Frage?');
  mockSaveDoctorQuestion.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('offline') });
  const result = await saveVoiceLogEntries([first, second], 'user');
  expect(result).toEqual({ savedCount: 1, failedCount: 1, failedEntries: [second] });
  await saveVoiceLogEntries(result.failedEntries, 'user');
  expect(mockSaveDoctorQuestion.mock.calls).toEqual([['Erste Frage?'], ['Zweite Frage?'], ['Zweite Frage?']]);
});

it('rejects empty and oversized questions without writing', async () => {
  const entries = [question('   '), question('a'.repeat(2001))];
  expect(await saveVoiceLogEntries(entries, 'user')).toEqual({ savedCount: 0, failedCount: 2, failedEntries: entries });
  expect(mockSaveDoctorQuestion).not.toHaveBeenCalled();
});

it('shows the doctor question destination and no invented time', () => {
  expect(describeVoiceLogEntry(question('Welche Untersuchungen stehen an?'))).toEqual({ emoji: '🩺', title: 'Arztfrage', timeText: '' });
});

it('extracts chat suggestions without recording audio or writing entries', async () => {
  const result = { transcript: 'Fragen zum Ultraschall notieren.', entries: [question('Wie läuft der Ultraschall ab?')] };
  mockInvoke.mockResolvedValue({ data: result, error: null });
  expect(await parseLottiEntries(result.transcript, null, null, 'de', 'pregnancy')).toEqual(result);
  expect(mockInvoke).toHaveBeenCalledWith('voice-log-parse', { body: expect.objectContaining({ text: result.transcript, mode: 'pregnancy', locale: 'de' }) });
  expect(mockReadAudio).not.toHaveBeenCalled();
  expect(mockSaveDoctorQuestion).not.toHaveBeenCalled();
});

it('preserves audio parsing and allows doctor questions before birth', async () => {
  mockReadAudio.mockResolvedValue('audio-data');
  mockInvoke.mockResolvedValue({ data: { transcript: 'Arzt fragen', entries: [question('Was muss ich beachten?')] }, error: null });
  const result = await parseVoiceRecording('file.m4a', 'audio/mp4', null, null, 'de', 'pregnancy');
  expect(result.entries[0].type).toBe('doctor_question');
  expect(mockInvoke).toHaveBeenCalledWith('voice-log-parse', { body: expect.objectContaining({ audioBase64: 'audio-data', mimeType: 'audio/mp4', mode: 'pregnancy' }) });
  expect(mockSaveDoctorQuestion).not.toHaveBeenCalled();
});

it('reports parsing failure without writes', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: new Error('offline') });
  await expect(parseLottiEntries('Text', null, null, 'de', 'pregnancy')).rejects.toThrow();
  expect(mockSaveDoctorQuestion).not.toHaveBeenCalled();
});
