import {
  buildPlannerPersonColorMap,
  getPlannerPersonKey,
  PLANNER_PARTNER_COLOR,
  PLANNER_SELF_COLOR,
  resolvePlannerItemColor,
} from '../plannerPersonColors';

describe('planner person colors', () => {
  const colorMap = buildPlannerPersonColorMap({
    userId: 'self',
    linkedUserIds: ['partner'],
    babies: [
      { id: 'daughter', baby_gender: 'female' },
      { id: 'son', baby_gender: 'male' },
    ],
    accentColor: '#5E3DB3',
  });

  it('assigns automatic colors to every supported person and family', () => {
    expect(colorMap['user:self']).toBe(PLANNER_SELF_COLOR);
    expect(colorMap['user:partner']).toBe(PLANNER_PARTNER_COLOR);
    expect(colorMap['baby:daughter']).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colorMap['baby:son']).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colorMap.family).toBe('#5E3DB3');
  });

  it.each([
    [{ assignee: 'me', ownerId: 'self' }, 'user:self'],
    [{ assignee: 'partner' }, 'user:partner'],
    [{ assignee: 'family' }, 'family'],
    [{ assignee: 'child', babyId: 'daughter' }, 'baby:daughter'],
  ] as const)('resolves %o to %s', (item, key) => {
    expect(getPlannerPersonKey(item, { userId: 'self', partnerUserId: 'partner' })).toBe(key);
  });

  it('uses a manually selected color before the automatic person color', () => {
    expect(
      resolvePlannerItemColor(
        { assignee: 'child', babyId: 'daughter', ownerId: 'self', color: '#3E7BC4' },
        colorMap,
        { userId: 'self', partnerUserId: 'partner', fallback: '#000000' },
      ),
    ).toBe('#3e7bc4');
  });

  it('falls back to the automatic person color when no custom color is set', () => {
    expect(
      resolvePlannerItemColor(
        { assignee: 'family', ownerId: 'self' },
        colorMap,
        { userId: 'self', partnerUserId: 'partner', fallback: '#000000' },
      ),
    ).toBe(colorMap.family);
  });
});
