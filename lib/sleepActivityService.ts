import { NativeModules, Platform } from 'react-native';

type NativeSleepActivitySnapshot = {
  id: string;
  startTime: string;
  elapsedTimeText: string;
  isTracking: boolean;
  quality?: string | null;
};

type LiveActivityNativeModule = {
  isSupported: () => Promise<boolean>;
  startSleepActivity: (startTimeISO: string, elapsedTimeText: string) => Promise<string | null>;
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
  getCurrentSleepActivity: () => Promise<NativeSleepActivitySnapshot | null>;
  endAllSleepActivities: () => Promise<boolean>;
};

const liveActivityModule =
  NativeModules.LiveActivityModule as LiveActivityNativeModule | undefined;

class SleepActivityService {
  private currentActivityId: string | null = null;
  private supportCheckCompleted = false;
  private isSupportedByDevice = false;

  public isLiveActivitySupported(): boolean {
    return Platform.OS === 'ios' && !!liveActivityModule;
  }

  private async ensureSupported(): Promise<boolean> {
    if (!this.isLiveActivitySupported() || !liveActivityModule) {
      return false;
    }

    if (this.supportCheckCompleted) {
      return this.isSupportedByDevice;
    }

    try {
      this.isSupportedByDevice = await liveActivityModule.isSupported();
    } catch (error) {
      console.error('Failed to check Live Activity support:', error);
      this.isSupportedByDevice = false;
    } finally {
      this.supportCheckCompleted = true;
    }

    return this.isSupportedByDevice;
  }

  public async restoreCurrentActivity(): Promise<NativeSleepActivitySnapshot | null> {
    if (!(await this.ensureSupported()) || !liveActivityModule) {
      return null;
    }

    try {
      const activity = await liveActivityModule.getCurrentSleepActivity();
      this.currentActivityId = activity?.id ?? null;
      return activity;
    } catch (error) {
      console.error('Failed to restore current sleep live activity:', error);
      this.currentActivityId = null;
      return null;
    }
  }

  public async startSleepActivity(startTime: Date): Promise<string | null> {
    if (!(await this.ensureSupported()) || !liveActivityModule) {
      return null;
    }

    try {
      const activityId = await liveActivityModule.startSleepActivity(
        startTime.toISOString(),
        '00:00:00'
      );
      this.currentActivityId = activityId ?? null;
      if (activityId) {
        console.log('Sleep Live Activity started:', activityId);
      }
      return this.currentActivityId;
    } catch (error) {
      console.error('Failed to start sleep live activity:', error);
      return null;
    }
  }

  private async resolveActivityId(): Promise<string | null> {
    if (this.currentActivityId) {
      return this.currentActivityId;
    }

    const current = await this.restoreCurrentActivity();
    return current?.id ?? null;
  }

  public async updateSleepActivity(elapsedTimeText: string, quality?: string): Promise<boolean> {
    if (!(await this.ensureSupported()) || !liveActivityModule) {
      return false;
    }

    const activityId = await this.resolveActivityId();
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
        this.currentActivityId = null;
      }
      return updated;
    } catch (error) {
      console.error('Failed to update sleep live activity:', error);
      return false;
    }
  }

  public async endSleepActivity(quality: string, totalDuration: string): Promise<boolean> {
    if (!(await this.ensureSupported()) || !liveActivityModule) {
      return false;
    }

    const activityId = await this.resolveActivityId();
    if (!activityId) {
      return false;
    }

    try {
      const ended = await liveActivityModule.endSleepActivity(activityId, totalDuration, quality);
      if (ended) {
        this.currentActivityId = null;
        console.log('Sleep Live Activity ended');
      }
      return ended;
    } catch (error) {
      console.error('Failed to end sleep live activity:', error);
      return false;
    }
  }

  public async endAllSleepActivities(): Promise<boolean> {
    if (!(await this.ensureSupported()) || !liveActivityModule) {
      return false;
    }

    try {
      const result = await liveActivityModule.endAllSleepActivities();
      this.currentActivityId = null;
      return result;
    } catch (error) {
      console.error('Failed to end all sleep live activities:', error);
      return false;
    }
  }
}

export const sleepActivityService = new SleepActivityService();
