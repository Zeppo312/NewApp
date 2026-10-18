import { meteringToLevel } from '../voiceLog/metering';

describe('meteringToLevel', () => {
  it('treats silence and missing metering as zero', () => {
    expect(meteringToLevel(undefined)).toBe(0);
    expect(meteringToLevel(null)).toBe(0);
    expect(meteringToLevel(-160)).toBe(0);
    expect(meteringToLevel(-48)).toBe(0);
  });

  it('maps normal speech into the middle of the range and clamps at full scale', () => {
    const speech = meteringToLevel(-25);
    expect(speech).toBeGreaterThan(0.4);
    expect(speech).toBeLessThan(0.7);
    expect(meteringToLevel(0)).toBe(1);
    expect(meteringToLevel(10)).toBe(1);
  });
});
