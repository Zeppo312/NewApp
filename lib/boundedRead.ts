import { localHealthGeneration } from './localHealthStorage';
const running = new Map<string, Promise<any>>();
export function transientReadError(error: any) {
  if (error?.name === 'DataConsentRequiredError' || [401,403].includes(Number(error?.status)) || error?.code === '42501' || error?.code?.startsWith('22')) return false;
  return error?.name === 'AbortError' || /network|fetch|timeout|timed out|connection|abort/i.test(String(error?.message ?? error)) || Number(error?.status) >= 500;
}
/** Adapters must honor the signal. Keep the flight registered until they settle. */
export function boundedRead<T>(key: string, read: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const current = running.get(key); if (current) return current;
  const generation = localHealthGeneration();
  const task = (async () => {
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const result = await read(controller.signal);
        if (generation !== localHealthGeneration() || controller.signal.aborted) throw new Error('Read cancelled');
        return result;
      } catch (error) {
        if (attempt >= 2 || generation !== localHealthGeneration() || !transientReadError(error)) throw error;
        await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 500 : 1500));
      } finally { clearTimeout(timeout); }
    }
  })();
  running.set(key, task);
  void task.finally(() => { if (running.get(key) === task) running.delete(key); }).catch(() => {});
  return task;
}
