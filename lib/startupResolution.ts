export const getActiveBabyResolutionScope = (
  userId: string | null | undefined,
): string => (userId ? `user:${userId}` : 'anonymous');

export const getBabyStatusResolutionScope = (
  userId: string | null | undefined,
  activeBabyId: string | null | undefined,
): string => (
  userId
    ? `user:${userId}:baby:${activeBabyId ?? 'none'}`
    : 'anonymous'
);

export const isResolutionCurrent = (
  resolvedScope: string | null,
  currentScope: string,
): boolean => resolvedScope === currentScope;
