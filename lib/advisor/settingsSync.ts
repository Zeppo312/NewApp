import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { supabase, supabaseUrl } from '@/lib/supabase';
import { ALL_ADVISOR_THEMES, fetchAdvisorSettings, saveAdvisorSettings, type AdvisorSettings } from './advisorStorage';

export interface AdvisorSettingsState {
  settings: AdvisorSettings | null;
  status: 'idle' | 'saving' | 'retrying' | 'load-error';
}

const controllers = new Map<string, AdvisorSettingsSync>();
const liveControllers = new Set<AdvisorSettingsSync>();

function readDraft(raw: string | null): AdvisorSettings | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as AdvisorSettings;
  if (typeof value.enabled !== 'boolean' || !['daily', 'critical_only', 'off'].includes(value.frequency)
    || !Array.isArray(value.themes) || !value.themes.every(theme => ALL_ADVISOR_THEMES.includes(theme))
    || !Number.isInteger(value.quietHoursStart) || !Number.isInteger(value.quietHoursEnd)
    || typeof value.pushEnabled !== 'boolean') return null;
  return value;
}

/** One ordered writer per account. Pending preferences survive navigation and restart. */
export class AdvisorSettingsSync {
  private state: AdvisorSettingsState = { settings: null, status: 'idle' };
  private listeners = new Set<() => void>();
  private pending: AdvisorSettings | null = null;
  private revision = 0;
  private failures = 0;
  private running = false;
  private stopped = false;
  private hydration: Promise<void> | null = null;
  private loading: Promise<void> | null = null;
  private localWrites: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request: AbortController | null = null;
  private appSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private authSubscription: { unsubscribe: () => void } | null = null;
  private readonly key: string;

  constructor(private readonly userId: string) {
    this.key = `advisor_settings_pending_v1:${encodeURIComponent(supabaseUrl)}:${encodeURIComponent(userId)}`;
    liveControllers.add(this);
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(next: AdvisorSettingsState) {
    if (this.stopped) return;
    this.state = next;
    this.listeners.forEach(listener => listener());
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private persistPending() {
    const raw = this.pending ? JSON.stringify(this.pending) : null;
    this.localWrites = this.localWrites.catch(() => {}).then(async () => {
      if (raw) await AsyncStorage.setItem(this.key, raw);
      else await AsyncStorage.removeItem(this.key);
    });
    // Edits enqueue persistence immediately, even while another save is running.
    void this.localWrites.catch(() => {});
    return this.localWrites;
  }

  private hydrate() {
    if (!this.hydration) {
      this.hydration = (async () => {
        const draft = readDraft(await AsyncStorage.getItem(this.key));
        if (this.stopped || !draft) return;
        this.pending = draft;
        this.revision += 1;
        this.publish({ settings: draft, status: 'saving' });
      })().catch(() => {});
    }
    return this.hydration;
  }

  start() {
    if (this.stopped || this.appSubscription) return;
    this.appSubscription = AppState.addEventListener('change', state => {
      this.clearTimer();
      if (state === 'active') {
        if (this.pending) this.retry();
        else void this.reload();
      } else {
        this.request?.abort();
      }
    });
    this.authSubscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session && session.user.id !== this.userId)) {
        if (controllers.get(this.userId) === this) controllers.delete(this.userId);
        void this.stop();
      }
    }).data.subscription;
    void this.reload();
  }

  reload = (): Promise<void> => {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      await this.hydrate();
      if (this.stopped || AppState.currentState !== 'active') return;
      if (this.pending) {
        this.retry();
        return;
      }
      const revision = this.revision;
      try {
        const settings = await fetchAdvisorSettings(this.userId);
        // A read started before an edit must never overwrite that edit, even after its save.
        if (!this.stopped && revision === this.revision && !this.pending) {
          this.publish({ settings, status: 'idle' });
        }
      } catch {
        // Retain the confirmed or pending selection during a failed refresh.
        if (!this.state.settings) this.publish({ settings: null, status: 'load-error' });
      }
    })().finally(() => { this.loading = null; });
    return this.loading;
  };

  update = (update: (current: AdvisorSettings) => AdvisorSettings) => {
    if (this.stopped || !this.state.settings) return;
    const next = update(this.state.settings);
    this.pending = { ...next, themes: [...next.themes] };
    this.revision += 1;
    this.publish({ settings: this.pending, status: this.failures ? 'retrying' : 'saving' });
    void this.persistPending();
    this.retry();
  };

  retry = () => {
    this.clearTimer();
    if (this.pending) void this.flush();
    else void this.reload();
  };

  private scheduleRetry() {
    if (this.stopped || !this.pending || AppState.currentState !== 'active') return;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(this.failures - 1, 5));
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, delay);
  }

  private async flush() {
    if (this.stopped || this.running || !this.pending || AppState.currentState !== 'active') return;
    this.running = true;
    let attempt = this.pending;
    const request = new AbortController();
    this.request = request;
    const timeout = setTimeout(() => request.abort(), 15_000);
    let failed = false;
    try {
      await this.persistPending();
      if (this.stopped) return;
      if (request.signal.aborted) throw new Error('Advisor settings save timed out');
      attempt = this.pending!;
      const saved = await saveAdvisorSettings(attempt, { expectedUserId: this.userId, signal: request.signal });
      if (this.stopped) return;
      if (!saved) throw new Error('Advisor settings save was not confirmed');
      this.failures = 0;
      if (this.pending === attempt) {
        this.pending = null;
        await this.persistPending();
        if (!this.pending) this.publish({ settings: attempt, status: 'idle' });
      }
    } catch {
      if (this.stopped) return;
      failed = true;
      // Also retain the draft if clearing its local receipt failed.
      this.pending ??= attempt;
      this.failures += 1;
      this.publish({ settings: this.pending, status: 'retrying' });
    } finally {
      clearTimeout(timeout);
      this.request = null;
      this.running = false;
      if (!this.stopped && this.pending) {
        if (failed) this.scheduleRetry();
        else void this.flush();
      }
    }
  }

  /** Invalidate before draining writes so logout cleanup cannot be repopulated. */
  async stop() {
    this.stopped = true;
    this.clearTimer();
    this.request?.abort();
    this.appSubscription?.remove();
    this.authSubscription?.unsubscribe();
    this.listeners.clear();
    await this.localWrites.catch(() => {});
    liveControllers.delete(this);
  }
}

export function getAdvisorSettingsSync(userId: string) {
  let controller = controllers.get(userId);
  if (!controller) {
    controller = new AdvisorSettingsSync(userId);
    controllers.set(userId, controller);
  }
  return controller;
}

export async function clearAdvisorSettingsSync() {
  const active = [...liveControllers];
  controllers.clear();
  await Promise.all(active.map(controller => controller.stop()));
}
