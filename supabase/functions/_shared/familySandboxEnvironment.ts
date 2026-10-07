const PRODUCTION_REF = 'kwniiyayhzgjfqjsjcfu';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Env = (key: string) => string | undefined;
declare const Deno: { env: { get: Env } };

// Only server-owned environment values can select sandbox sponsorship.
// SUPABASE_URL is supplied by the platform and cannot be set by an app caller.
export function familySharingEnvironment(userId: string, env: Env = key =>
  typeof Deno === 'undefined' ? undefined : Deno.env.get(key)): 'production' | 'sandbox' {
  const mode = env('FAMILY_QA_MODE');
  if (!mode) return 'production';
  const ref = env('FAMILY_QA_PROJECT_REF');
  if (mode !== 'sandbox' || !ref || !/^[a-z]{20}$/.test(ref) || ref === PRODUCTION_REF ||
      env('SUPABASE_URL') !== `https://${ref}.supabase.co`) {
    throw new Error('family_qa_environment_invalid');
  }
  const users = (env('FAMILY_QA_USER_IDS') ?? '').split(',').map(id => id.trim());
  if (users.length > 8 || users.some(id => !UUID.test(id)) || !users.includes(userId)) {
    throw new Error('family_qa_account_not_allowed');
  }
  return 'sandbox';
}
