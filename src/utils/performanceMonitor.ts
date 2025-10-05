/**
 * Performance monitoring utilities for dashboard
 */

interface PerformanceMetric {
  name: string;
  startTime: number;
  duration?: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private enabled: boolean = process.env.NODE_ENV === 'development';

  start(metricName: string) {
    if (!this.enabled) return;
    
    this.metrics.set(metricName, {
      name: metricName,
      startTime: performance.now(),
    });
  }

  end(metricName: string) {
    if (!this.enabled) return;

    const metric = this.metrics.get(metricName);
    if (!metric) {
      console.warn(`Performance metric "${metricName}" not found`);
      return;
    }

    const duration = performance.now() - metric.startTime;
    metric.duration = duration;

    // Log slow operations (> 1000ms)
    if (duration > 1000) {
      console.warn(`⚠️ Slow operation detected: ${metricName} took ${duration.toFixed(2)}ms`);
    } else if (duration > 500) {
      console.log(`⏱️ ${metricName} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  measure(metricName: string, fn: () => void) {
    this.start(metricName);
    fn();
    this.end(metricName);
  }

  async measureAsync<T>(metricName: string, fn: () => Promise<T>): Promise<T> {
    this.start(metricName);
    try {
      const result = await fn();
      this.end(metricName);
      return result;
    } catch (error) {
      this.end(metricName);
      throw error;
    }
  }

  getMetrics() {
    return Array.from(this.metrics.values());
  }

  clear() {
    this.metrics.clear();
  }

  logSummary() {
    if (!this.enabled) return;

    const metrics = this.getMetrics().filter(m => m.duration !== undefined);
    if (metrics.length === 0) return;

    console.group('📊 Dashboard Performance Summary');
    metrics.forEach(metric => {
      console.log(`  ${metric.name}: ${metric.duration?.toFixed(2)}ms`);
    });
    console.groupEnd();
  }
}

export const performanceMonitor = new PerformanceMonitor();

// React hook for measuring component render time
export const useMeasureRender = (componentName: string) => {
  if (process.env.NODE_ENV !== 'development') return;

  performanceMonitor.start(`render-${componentName}`);
  
  // Cleanup on unmount
  return () => {
    performanceMonitor.end(`render-${componentName}`);
  };
};
