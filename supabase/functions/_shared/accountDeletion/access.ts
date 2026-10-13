import { workerRpc } from './contracts.ts';
/** Required before service-role reads, AI calls and notifications. Fail closed. */
export async function assertAccountActive(admin: any, userId: string): Promise<void> {
  if (await workerRpc(admin, 'blocked', { userId })) throw new Error('account_deletion_pending');
}
