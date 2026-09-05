import { resolveVoiceLogEnd } from '../voiceLog/timer';

describe('resolveVoiceLogEnd', () => {
  const start = new Date('2026-07-21T12:00:00.000Z');

  it('closes an entry immediately when no timer was requested', () => {
    expect(resolveVoiceLogEnd(start, null, false)).toEqual(start);
  });

  it('keeps an entry open only when a timer was explicitly requested', () => {
    expect(resolveVoiceLogEnd(start, null, true)).toBeNull();
  });

  it('keeps a valid explicit end for a completed entry', () => {
    const end = new Date('2026-07-21T12:20:00.000Z');
    expect(resolveVoiceLogEnd(start, end, false)).toEqual(end);
  });

  it('does not turn an invalid end into an open timer', () => {
    const invalidEnd = new Date('2026-07-21T11:50:00.000Z');
    expect(resolveVoiceLogEnd(start, invalidEnd, false)).toEqual(start);
  });
});
