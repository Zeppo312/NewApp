const listeners = new Set<() => void>();
export const onServerContact = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const notifyServerContact = () => { for (const listener of listeners) { try { listener(); } catch { /* Recovery signals cannot change a successful API result. */ } } };
