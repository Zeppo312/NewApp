import { Platform } from 'react-native';
import OptimizedStorage from './optimizedStorage';

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface ComponentRenderMetric {
  componentName: string;
  renderCount: number;
  averageRenderTime: number;
  lastRenderTime: number;
}

class PerformanceMonitor {
  private static metrics: Map<string, PerformanceMetric> = new Map();
  private static componentMetrics: Map<string, ComponentRenderMetric> = new Map();
  private static isEnabled = __DEV__; // Only enable in development
  private static readonly STORAGE_KEY = 'performance_metrics';
  private static readonly MAX_STORED_METRICS = 100;

  // Start measuring a performance metric
  static startMeasurement(name: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      startTime: Date.now(),
      metadata,
    };

    this.metrics.set(name, metric);
  }

  // End measuring a performance metric
  static endMeasurement(name: string): number | null {
    if (!this.isEnabled) return null;

    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance measurement '${name}' was not started`);
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    // Log slow operations
    if (duration > 1000) {
      console.warn(`Slow operation detected: ${name} took ${duration}ms`, metric.metadata);
    }

    // Store completed metric
    this.storeMetric(metric);

    return duration;
  }

  // Measure a function execution time
  static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.isEnabled) {
      return await fn();
    }

    this.startMeasurement(name, metadata);
    try {
      const result = await fn();
      this.endMeasurement(name);
      return result;
    } catch (error) {
      this.endMeasurement(name);
      throw error;
    }
  }

  // Measure synchronous function execution time
  static measure<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    if (!this.isEnabled) {
      return fn();
    }

    this.startMeasurement(name, metadata);
    try {
      const result = fn();
      this.endMeasurement(name);
      return result;
    } catch (error) {
      this.endMeasurement(name);
      throw error;
    }
  }

  // Track component render performance
  static trackComponentRender(componentName: string, renderTime: number): void {
    if (!this.isEnabled) return;

    const existing = this.componentMetrics.get(componentName);
    
    if (existing) {
      const newRenderCount = existing.renderCount + 1;
      const newAverageTime = ((existing.averageRenderTime * existing.renderCount) + renderTime) / newRenderCount;
      
      this.componentMetrics.set(componentName, {
        componentName,
        renderCount: newRenderCount,
        averageRenderTime: newAverageTime,
        lastRenderTime: renderTime,
      });
    } else {
      this.componentMetrics.set(componentName, {
        componentName,
        renderCount: 1,
        averageRenderTime: renderTime,
        lastRenderTime: renderTime,
      });
    }

    // Warn about slow renders
    if (renderTime > 16) { // 60fps = 16.67ms per frame
      console.warn(`Slow render detected: ${componentName} took ${renderTime}ms`);
    }
  }

  // Get performance summary
  static getPerformanceSummary(): {
    slowestOperations: PerformanceMetric[];
    componentStats: ComponentRenderMetric[];
    memoryUsage?: any;
  } {
    const storedMetrics = this.getStoredMetrics();
    const slowestOperations = storedMetrics
      .filter(m => m.duration && m.duration > 100)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    const componentStats = Array.from(this.componentMetrics.values())
      .filter(c => c.averageRenderTime > 10)
      .sort((a, b) => b.averageRenderTime - a.averageRenderTime);

    const summary = {
      slowestOperations,
      componentStats,
    };

    // Add memory usage if available (React Native specific)
    if (Platform.OS !== 'web' && global.performance?.memory) {
      (summary as any).memoryUsage = {
        usedJSHeapSize: global.performance.memory.usedJSHeapSize,
        totalJSHeapSize: global.performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: global.performance.memory.jsHeapSizeLimit,
      };
    }

    return summary;
  }

  // Store metric to persistent storage
  private static async storeMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const stored = await this.getStoredMetrics();
      stored.push(metric);

      // Keep only the most recent metrics
      if (stored.length > this.MAX_STORED_METRICS) {
        stored.splice(0, stored.length - this.MAX_STORED_METRICS);
      }

      await OptimizedStorage.setObject(this.STORAGE_KEY, stored);
    } catch (error) {
      console.warn('Failed to store performance metric:', error);
    }
  }

  // Get stored metrics
  private static getStoredMetrics(): PerformanceMetric[] {
    try {
      return OptimizedStorage.getObject<PerformanceMetric[]>(this.STORAGE_KEY, []) as PerformanceMetric[] || [];
    } catch (error) {
      console.warn('Failed to get stored metrics:', error);
      return [];
    }
  }

  // Clear all stored metrics
  static async clearMetrics(): Promise<void> {
    try {
      await OptimizedStorage.removeItem(this.STORAGE_KEY);
      this.metrics.clear();
      this.componentMetrics.clear();
    } catch (error) {
      console.warn('Failed to clear metrics:', error);
    }
  }

  // Enable/disable monitoring
  static setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Check if monitoring is enabled
  static isMonitoringEnabled(): boolean {
    return this.isEnabled;
  }

  // Get current active measurements
  static getActiveMeasurements(): string[] {
    return Array.from(this.metrics.keys());
  }

  // Log performance report
  static logPerformanceReport(): void {
    if (!this.isEnabled) return;

    const summary = this.getPerformanceSummary();
    
    console.group('🚀 Performance Report');
    
    if (summary.slowestOperations.length > 0) {
      console.group('🐌 Slowest Operations');
      summary.slowestOperations.forEach(op => {
        console.log(`${op.name}: ${op.duration}ms`, op.metadata);
      });
      console.groupEnd();
    }

    if (summary.componentStats.length > 0) {
      console.group('🎨 Slow Components');
      summary.componentStats.forEach(comp => {
        console.log(`${comp.componentName}: avg ${comp.averageRenderTime.toFixed(2)}ms (${comp.renderCount} renders)`);
      });
      console.groupEnd();
    }

    if ((summary as any).memoryUsage) {
      console.group('💾 Memory Usage');
      const memory = (summary as any).memoryUsage;
      console.log(`Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Total: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      console.groupEnd();
    }

    console.groupEnd();
  }
}

// React Hook for tracking component render performance
export function usePerformanceTracking(componentName: string) {
  if (!PerformanceMonitor.isMonitoringEnabled()) return;

  const startTime = Date.now();
  
  return {
    trackRender: () => {
      const renderTime = Date.now() - startTime;
      PerformanceMonitor.trackComponentRender(componentName, renderTime);
    }
  };
}

export default PerformanceMonitor;