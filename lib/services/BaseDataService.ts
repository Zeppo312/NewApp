/**
 * BaseDataService
 *
 * Abstract base class for dual-backend data operations.
 * Provides helper methods for dual-write and selective read patterns.
 *
 * Error Handling Strategy:
 * - Primary Success, Secondary Fail: User sees success, warning logged
 * - Primary Fail, Secondary Success: User sees error, operation considered failed
 * - Both Fail: User sees error
 */

import type { ConvexReactClient } from 'convex/react';

export type BackendType = 'supabase' | 'convex';

export interface DualWriteResult<T> {
  primary: {
    data: T | null;
    error: any;
  };
  secondary: {
    data: T | null;
    error: any;
  };
  success: boolean; // Based on primary backend success
}

export interface ReadResult<T> {
  data: T | null;
  error: any;
  source: BackendType;
}

export abstract class BaseDataService {
  protected activeBackend: BackendType;
  protected convexClient: ConvexReactClient | null;
  protected userId: string;

  constructor(
    activeBackend: BackendType,
    convexClient: ConvexReactClient | null,
    userId: string
  ) {
    this.activeBackend = activeBackend;
    this.convexClient = convexClient;
    this.userId = userId;
  }
  /**
   * Dual-write to both backends in parallel.
   * Primary backend determines success/failure for user feedback.
   */
  protected async dualWrite<T>(
    primaryBackend: BackendType,
    primaryOperation: () => Promise<{ data: T | null; error: any }>,
    secondaryOperation: () => Promise<{ data: T | null; error: any }>
  ): Promise<DualWriteResult<T>> {
    // Execute both operations in parallel
    const [primaryResult, secondaryResult] = await Promise.allSettled([
      primaryOperation(),
      secondaryOperation(),
    ]);

    const primary =
      primaryResult.status === 'fulfilled'
        ? primaryResult.value
        : { data: null, error: primaryResult.reason };

    const secondary =
      secondaryResult.status === 'fulfilled'
        ? secondaryResult.value
        : { data: null, error: secondaryResult.reason };

    // Log warning if secondary write failed but primary succeeded
    if (!primary.error && secondary.error) {
      console.warn(
        `[DualWrite] Secondary backend (${
          primaryBackend === 'supabase' ? 'convex' : 'supabase'
        }) write failed:`,
        secondary.error
      );
    }

    // Log error if primary write failed but secondary succeeded
    if (primary.error && !secondary.error) {
      console.error(
        `[DualWrite] Primary backend (${primaryBackend}) write failed:`,
        primary.error
      );
    }

    // Log error if both failed
    if (primary.error && secondary.error) {
      console.error('[DualWrite] Both backends failed:', {
        primary: primary.error,
        secondary: secondary.error,
      });
    }

    return {
      primary,
      secondary,
      success: !primary.error,
    };
  }

  /**
   * Read from the active backend only.
   */
  protected async readFromActive<T>(
    activeBackend: BackendType,
    supabaseOperation: () => Promise<{ data: T | null; error: any }>,
    convexOperation: () => Promise<{ data: T | null; error: any }>
  ): Promise<ReadResult<T>> {
    const operation =
      activeBackend === 'supabase' ? supabaseOperation : convexOperation;

    try {
      const result = await operation();
      return {
        ...result,
        source: activeBackend,
      };
    } catch (error) {
      console.error(`[ReadFromActive] ${activeBackend} read failed:`, error);
      return {
        data: null,
        error,
        source: activeBackend,
      };
    }
  }

  /**
   * Helper to handle retry logic for failed primary writes.
   * Retries up to maxRetries times with exponential backoff.
   */
  protected async withRetry<T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<{ data: T | null; error: any }> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation();
        if (!result.error) {
          return result;
        }
        lastError = result.error;
      } catch (error) {
        lastError = error;
      }

      // Wait before retry with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return { data: null, error: lastError };
  }
}
