import {
  getActiveBabyResolutionScope,
  getBabyStatusResolutionScope,
  isResolutionCurrent,
} from '../startupResolution';

describe('startup resolution scopes', () => {
  it('does not reuse anonymous active-baby readiness after login', () => {
    const anonymousScope = getActiveBabyResolutionScope(null);
    const signedInScope = getActiveBabyResolutionScope('user-1');

    expect(isResolutionCurrent(anonymousScope, signedInScope)).toBe(false);
  });

  it('invalidates baby status when the active baby changes', () => {
    const firstBaby = getBabyStatusResolutionScope('user-1', 'baby-1');
    const secondBaby = getBabyStatusResolutionScope('user-1', 'baby-2');

    expect(isResolutionCurrent(firstBaby, secondBaby)).toBe(false);
  });

  it('keeps the resolved status for the same user and baby', () => {
    const scope = getBabyStatusResolutionScope('user-1', 'baby-1');

    expect(isResolutionCurrent(scope, scope)).toBe(true);
  });
});
