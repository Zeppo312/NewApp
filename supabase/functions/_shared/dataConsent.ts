/** Always consult the database: the deployment itself never activates consent.
 * No body, user metadata, premium role or cached JWT can supply a grant. */
export async function dataProcessingAllowed(admin: any, userId: string, scope: 'health' | 'ai' = 'health'): Promise<boolean> {
  const { data, error } = await admin.rpc('check_data_processing_consent', { p_user_id: userId, p_scope: scope });
  if (error || typeof data !== 'boolean') throw new Error('consent_check_unavailable');
  return data;
}
export async function assertDataProcessingAllowed(admin: any, userId: string, scope: 'health' | 'ai' = 'health'): Promise<void> {
  if (!await dataProcessingAllowed(admin, userId, scope)) throw new Error(`${scope}_consent_required`);
}
