// Routes needed before purchase, including both invitation entry paths.
const excludedPaths = new Set([
  '/',
  '/paywall',
  '/account-linking',
  '/invite',
  '/datenschutz',
  '/impressum',
  '/nutzungsbedingungen',
  '/dsgvo',
  '/account-deletion',
  '/app-settings',
  '/data-consents',
  '/support',
  '/subscription',
  '/caregiver',
  '/caregiver-join',
]);

export const isPaywallExcludedPath = (pathname: string): boolean => excludedPaths.has(pathname);
