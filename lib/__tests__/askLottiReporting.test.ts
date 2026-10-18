import { supabase } from '../supabase';
import { canReportLottiMessage, reportLottiAnswer } from '../askLotti/reporting';

jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn() } }));
const rpc = supabase.rpc as jest.Mock;
const message = { id: 'lotti-old-local-id', role: 'lotti' as const, text: 'Selected answer', disclaimer: 'General guidance', evidence: [{ id: 'private', title: 'Baby data', detail: 'Not sent' }] };
const params = { message, conversationId: 'chat-old-local-id', reason: 'misinformation' as const, details: '  Incorrect advice  ' };

beforeEach(() => rpc.mockReset());

it('reports both saved answers and refusals without requiring a disclaimer or premium check', () => {
  expect(canReportLottiMessage(message)).toBe(true);
  expect(canReportLottiMessage({ ...message, disclaimer: undefined })).toBe(true);
});

it.each([
  { ...message, id: 'intro' },
  { ...message, role: 'user' as const },
  { ...message, isError: true },
  { ...message, text: '   ' },
])('does not report intro, user, empty or error messages', async (invalid) => {
  expect(canReportLottiMessage(invalid)).toBe(false);
  expect(await reportLottiAnswer({ ...params, message: invalid })).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});

it('sends only the selected answer, disclaimer and explicit report fields', async () => {
  rpc.mockResolvedValue({ data: 'report-id', error: null });
  expect(await reportLottiAnswer(params)).toBe(true);
  expect(rpc).toHaveBeenCalledWith('report_lotti_answer', {
    conversation_id_param: 'chat-old-local-id', message_id_param: 'lotti-old-local-id',
    answer_param: 'Selected answer\n\nGeneral guidance', reason_param: 'misinformation', details_param: 'Incorrect advice',
  });
});

it('allows an empty optional comment', async () => {
  rpc.mockResolvedValue({ data: 'report-id', error: null });
  expect(await reportLottiAnswer({ ...params, details: ' ' })).toBe(true);
  expect(rpc.mock.calls[0][1].details_param).toBeNull();
});

it('rejects oversized comments before sending', async () => {
  expect(await reportLottiAnswer({ ...params, details: 'a'.repeat(1001) })).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});

it.each([{ data: null, error: null }, { data: null, error: { message: 'unauthorized' } }])('does not claim success without an acknowledged report', async (result) => {
  rpc.mockResolvedValue(result);
  expect(await reportLottiAnswer(params)).toBe(false);
});

it('handles network failures so the dialog can retry', async () => {
  rpc.mockRejectedValue(new Error('offline'));
  expect(await reportLottiAnswer(params)).toBe(false);
});
