import { isBlockedCommunityPath } from '../communityAccess';

describe('retired community links', () => {
  it.each([
    '/community',
    '/groups',
    '/groups/old-group',
    '/group-chat/old-group',
    '/chat/old-user',
    '/profile/old-user',
    '/blocked-users',
    '/notifications',
    '/community/?post=old-post',
  ])('redirects the old destination %s', (pathname) => {
    expect(isBlockedCommunityPath(pathname)).toBe(true);
  });

  it.each([
    '/blog',
    '/profil',
    '/account-linking',
    '/invite',
    '/planner',
    '/frag-lotti',
    '/debug-notifications',
    '/chatbot',
    '/profiles-settings',
  ])('keeps the independent destination %s available', (pathname) => {
    expect(isBlockedCommunityPath(pathname)).toBe(false);
  });

  it('allows unresolved paths', () => {
    expect(isBlockedCommunityPath(null)).toBe(false);
    expect(isBlockedCommunityPath(undefined)).toBe(false);
  });
});
