import { NativeModules, Platform } from 'react-native';

type NativeActivityType = 'sleep' | 'feeding';

type NativeLiveActivitySnapshot = {
  id: string;
  startTime: string;
  startTimestamp?: number | null;
  elapsedTimeText: string;
  isTracking: boolean;
  quality?: string | null;
  babyName?: string | null;
  activityType?: NativeActivityType | null;
  feedingType?: string | null;
};

type LiveActivityNativeModule = {
  isSupported: () => Promise<boolean>;
  startSleepActivity: (startTimeISO: string, elapsedTimeText: string, babyName?: string | null) => Promise<string | null>;
  updateSleepActivity: (
    activityId: string,
    elapsedTimeText: string,
    quality?: string | null
  ) => Promise<boolean>;
  endSleepActivity: (
    activityId: string,
    elapsedTimeText: string,
    quality?: string | null
  ) => Promise<boolean>;
  getCurrentSleepActivity: () => Promise<NativeLiveActivitySnapshot | null>;
  endAllSleepActivities: () => Promise<boolean>;
  startFeedingActivity?: (
    startTimeISO: string,
    elapsedTimeText: string,
    babyName?: string | null,
    feedingType?: string | null
  ) => Promise<string | null>;
  updateFeedingActivity?: (
    activityId: string,
    elapsedTimeText: string,
    feedingType?: string | null
  ) => Promise<boolean>;
  endFeedingActivity?: (
    activityId: string,
    elapsedTimeText: string,
    feedingType?: string | null
  ) => Promise<boolean>;
  getCurrentFeedingActivity?: () => Promise<NativeLiveActivitySnapshot | null>;
  endAllFeedingActivities?: () => Promise<boolean>;
};

const liveActivityModule =
  NativeModules.LiveActivityModule as LiveActivityNativeModule | undefined;

class SleepActivityService {
  private currentSleepActivityId: string | null = null;
  private currentFeedingActivityId: string | null = null;

  public isLiveActivitySupported(): boolean {
    return Platform.OS === 'ios' && !!liveActivityModule;
  }

  private async ensureSupported(): Promise<boolean> {
    if (!this.isLiveActivitySupported() || !liveActivityModule) {
      return false;
    }

    try {
      return await liveActivityModule.isSupported();
    } catch (error) {
      console.error('Failed to check Live Activity support:', error);
      return false;
    }
  }

  private hasArityHint(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return (
      /argument/i.test(message) ||
      /expects/i.test(message) ||
      /arity/i.test(message) ||
      /too many/i.test(message) ||
      /not enough/i.test(message)
    );
  }

  // Compatibility: older native builds exposed startSleepActivity with 2 args,
  // newer builds with 3 args (babyName). Retry with legacy arity if needed.
  private async startSleepActivityCompat(startTimeISO: string, babyName?: string): Promise<string | null> {
    if (!liveActivityModule) {
      return null;
    }

    const startMethod = liveActivityModule.startSleepActivity as unknown as (
      startTimeISO: string,
      elapsedTimeText: string,
      babyName?: string | null
    ) => Promise<string | null>;

    try {
      return await startMethod(startTimeISO, '00:00:00', babyName ?? null);
    } catch (error) {
      if (!this.hasArityHint(error)) {
        throw error;
      }

      return await (startMethod as unknown as (
        startTimeISO: string,
        elapsedTimeText: string
      ) => Promise<string | null>)(startTimeISO, '00:00:00');
    }
  }

  private async startFeedingActivityCompat(
    startTimeISO: string,
    babyName?: string,
    feedingType?: string
  ): Promise<string | null> {
    if (!liveActivityModule?.startFeedingActivity) {
      return null;
    }

    const startMethod = liveActivityModule.startFeedingActivity as unknown as (
      startTimeISO: string,
      elapsedTimeText: string,
      babyName?: string | null,
      feedingType?: string | null
    ) => Promise<string | null>;

    try {
      return await startMethod(startTimeISO, '00:00:00', babyName ?? null, feedingType ?? null);
    } catch (error) {
      if (!this.hasArityHint(error)) {
        throw error;
      }
    }

    try {
      return await (startMethod as unknown as (
        startTimeISO: string,
        elapsedTimeText: string,
        babyName?: string | null
      ) => Promise<string | null>)(startTimeISO, '00:00:00', babyName ?? null);
    } catch (error) {
      if (!this.hasArityHint(error)) {
        throw error;
      }
    }

    return await (startMethod as unknown as (
      startTimeISO: string,
      elapsedTimeText: string
    ) => Promise<string | null>)(startTimeISO, '00:00:00');
  }

  public async restoreCurrentActivity(): Promise<NativeLiveActivitySnapshot | null> {
    if (!(await this.ensureSupported()) || !liveActivityModule) {
      return null;
    }

    try {
      const activity = await liveActivityModule.getCurrentSleepActivity();
      this.currentSleepActivityId = activity?.id ?? null;
      return activity;
    } catch (error) {
      console.error('Failed to restore current sleep live activity:', error);
      this.currentSleepActivityId = null;
      return null;
    }
  }

  public async startSleepActivity(startTime: Date, babyName?: string): Promise<string | null> {
    if (!(await this.ensureSupported()) || !liveActivityModule) {
      return null;
    }

    try {
      const activityId = await this.startSleepActivityCompat(startTime.toISOString(), babyName);
      this.currentSleepActivityId = activityId ?? null;
      if (activityId) {
        console.log('Sleep Live Activity started:', activityId);
      }
      return this.currentSleepActivityId;
    } catch (error) {
      console.error('Failed to start sleep live activity:', error);
      return null;
    }
  }

  public async restoreCurrentFeedingActivity(): Promise<NativeLiveActivitySnapshot | null> {
    if (!(await this.ensureSupported()) || !liveActivityModule?.getCurrentFeedingActivity) {
      return null;
    }

    try {
      const activity = await liveActivityModule.getCurrentFeedingActivity();
      this.currentFeedingActivityId = activity?.id ?? null;
      return activity;
    } catch (error) {
      console.error('Failed to restore current feeding live activity:', error);
      this.currentFeedingActivityId = null;
      return null;
    }
  }

  public async startFeedingActivity(
    startTime: Date,
    feedingType: string = 'BREAST',
    babyName?: string
  ): Promise<string | null> {
    if (!(await this.ensureSupported()) || !liveActivityModule?.startFeedingActivity) {
      return null;
    }

    try {
      const activityId = await this.startFeedingActivityCompat(startTime.toISOString(), babyName, feedingType);
      this.currentFeedingActivityId = activityId ?? null;
      if (activityId) {
        console.log('Feeding Live Activity started:', activityId);
      }
      return this.currentFeedingActivityId;
    } catch (error) {
      console.error('Failed to start feeding live activity:', error);
      return null;
    }
  }

  private async resolveSleepActivityId(): Promise<string | null> {
    if (this.currentSleepActivityId) {
      return this.currentSleepActivityId;
    }

    const current = await this.restoreCurrentActivity();
    return current?.id ?? null;
  }

  private async resolveFeedingActivityId(): Promise<string | null> {
    if (this.currentFeedingActivityId) {
      return this.currentFeedingActivityId;
    }

    const current = await this.restoreCurrentFeedingActivity();
    return current?.id ?? null;
  }

  public async updateSleepActivity(elapsedTimeText: string, quality?: string): Promise<boolean> {
    if (!(await this.ensureSupported()) || !liveActivityModule) {
      return false;
    }

    const activityId = await this.resolveSleepActivityId();
    if (!activityId) {
      return false;
    }

    try {
      const updated = await liveActivityModule.updateSleepActivity(
        activityId,
        elapsedTimeText,
        quality ?? null
      );
      if (!updated) {
        this.currentSleepActivityId = null;
      }
      return updated;
    } catch (error) {
      console.error('Failed to update sleep live activity:', error);
      return false;
    }
  }

  public async updateFeedingActivity(elapsedTimeText: string, feedingType: string = 'BREAST'): Promise<boolean> {
    if (!(await this.ensureSupported()) || !liveActivityModule?.updateFeedingActivity) {
      return false;
    }

    const activityId = await this.resolveFeedingActivityId();
    if (!activityId) {
      return false;
    }

    const updateMethod = liveActivityModule.updateFeedingActivity as unknown as (
      activityId: string,
      elapsedTimeText: string,
      feedingType?: string | null
    ) => Promise<boolean>;

    try {
      const updated = await updateMethod(activityId, elapsedTimeText, feedingType ?? null);
      if (!updated) {
        this.currentFeedingActivityId = null;
      }
      return updated;
    } catch (error) {
      if (!this.hasArityHint(error)) {
        console.error('Failed to update feeding live activity:', error);
        return false;
      }
    }

    try {
      const updatedLegacy = await (updateMethod as unknown as (
        activityId: string,
        elapsedTimeText: string
      ) => Promise<boolean>)(activityId, elapsedTimeText);
      if (!updatedLegacy) {
        this.currentFeedingActivityId = null;
      }
      return updatedLegacy;
    } catch (error) {
      console.error('Failed to update feeding live activity:', error);
      return false;
    }
  }

  public async endSleepActivity(quality: string, totalDuration: string): Promise<boolean> {
    if (!(await this.ensureSupported()) || !liveActivityModule) {
      return false;
    }

    const activityId = await this.resolveSleepActivityId();
    if (!activityId) {
      return false;
    }

    try {
      const ended = await liveActivityModule.endSleepActivity(activityId, totalDuration, quality);
      if (ended) {
        this.currentSleepActivityId = null;
        console.log('Sleep Live Activity ended');
      }
      return ended;
    } catch (error) {
      console.error('Failed to end sleep live activity:', error);
      return false;
    }
  }

  public async endFeedingActivity(totalDuration: string, feedingType: string = 'BREAST'): Promise<boolean> {
    if (!(await this.ensureSupported()) || !liveActivityModule?.endFeedingActivity) {
      return false;
    }

    const activityId = await this.resolveFeedingActivityId();
    if (!activityId) {
      return false;
    }

    const endMethod = liveActivityModule.endFeedingActivity as unknown as (
      activityId: string,
      elapsedTimeText: string,
      feedingType?: string | null
    ) => Promise<boolean>;

    try {
      const ended = await endMethod(activityId, totalDuration, feedingType ?? null);
      if (ended) {
        this.currentFeedingActivityId = null;
        console.log('Feeding Live Activity ended');
      }
      return ended;
    } catch (error) {
      if (!this.hasArityHint(error)) {
        console.error('Failed to end feeding live activity:', error);
        return false;
      }
    }

    try {
      const endedLegacy = await (endMethod as unknown as (
        activityId: string,
        elapsedTimeText: string
      ) => Promise<boolean>)(activityId, totalDuration);
      if (endedLegacy) {
        this.currentFeedingActivityId = null;
        console.log('Feeding Live Activity ended');
      }
      return endedLegacy;
    } catch (error) {
      console.error('Failed to end feeding live activity:', error);
      return false;
    }
  }

  public async endAllSleepActivities(): Promise<boolean> {
    if (!(await this.ensureSupported()) || !liveActivityModule) {
      return false;
    }

    try {
      const result = await liveActivityModule.endAllSleepActivities();
      this.currentSleepActivityId = null;
      return result;
    } catch (error) {
      console.error('Failed to end all sleep live activities:', error);
      return false;
    }
  }

  public async endAllFeedingActivities(): Promise<boolean> {
    if (!(await this.ensureSupported()) || !liveActivityModule?.endAllFeedingActivities) {
      return false;
    }

    try {
      const result = await liveActivityModule.endAllFeedingActivities();
      this.currentFeedingActivityId = null;
      return result;
    } catch (error) {
      console.error('Failed to end all feeding live activities:', error);
      return false;
    }
  }
}

export const sleepActivityService = new SleepActivityService();
