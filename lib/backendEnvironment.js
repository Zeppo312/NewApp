// Shared by Expo build configuration and the runtime client.
const PRODUCTION_REF = 'kwniiyayhzgjfqjsjcfu';
function resolveBackendEnvironment(mode, url, key, expectedRef) {
  if (!mode || mode === 'production') {
    if (url || key || expectedRef) throw new Error('QA backend values require explicit family-qa mode');
    return null; // Preserve the existing production configuration.
  }
  if (mode !== 'family-qa') throw new Error('Unknown backend environment');
  if (!expectedRef || !/^[a-z]{20}$/.test(expectedRef) || expectedRef === PRODUCTION_REF) {
    throw new Error('A separate family QA project is required');
  }
  if (url !== `https://${expectedRef}.supabase.co` || !key || key.startsWith('sb_secret_')) {
    throw new Error('Family QA needs its own HTTPS URL and public API key');
  }
  // Modern publishable keys or a legacy anon JWT; never ship a service-role key.
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon' || payload.ref !== expectedRef) throw new Error('mismatch');
    } catch { throw new Error('Family QA API key must be a matching public anon key'); }
  }
  return { url, key, projectRef: expectedRef };
}
module.exports = { resolveBackendEnvironment };
