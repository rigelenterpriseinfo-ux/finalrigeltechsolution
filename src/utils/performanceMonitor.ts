/**
 * Performance Monitoring Utilities
 * 
 * Provides utilities for tracking performance metrics in the dashboard.
 * Integrates with the Performance API and can send metrics to analytics.
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initObservers();
  }

  private initObservers() {
    // Observe Long Tasks (> 50ms)
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('long_task', entry.duration, {
              entryType: entry.entryType,
              startTime: entry.startTime,
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        console.warn('Long task observer not supported');
      }

      // Observe Layout Shifts
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const clsEntry = entry as any;
            if (clsEntry.hadRecentInput) continue;
            
            this.recordMetric('layout_shift', clsEntry.value, {
              entryType: entry.entryType,
              startTime: entry.startTime,
            });
          }
        });
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutShiftObserver);
      } catch (e) {
        console.warn('Layout shift observer not supported');
      }
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Log in development
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name}:`, value, metadata);
    }

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    return metric;
  }

  /**
   * Measure execution time of a function
   */
  async measure<T>(
    name: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Get Web Vitals metrics
   */
  getWebVitals() {
    if (!('performance' in window)) return null;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    return {
      // First Contentful Paint
      fcp: paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime || 0,
      
      // Largest Contentful Paint
      lcp: this.getLargestContentfulPaint(),
      
      // First Input Delay
      fid: this.getFirstInputDelay(),
      
      // Cumulative Layout Shift
      cls: this.getCumulativeLayoutShift(),
      
      // Time to Interactive
      tti: navigation?.domInteractive || 0,
      
      // Total Blocking Time
      tbt: this.getTotalBlockingTime(),
    };
  }

  private getLargestContentfulPaint(): number {
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    return lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : 0;
  }

  private getFirstInputDelay(): number {
    const fidEntries = performance.getEntriesByType('first-input');
    return fidEntries.length > 0 ? (fidEntries[0] as any).processingStart - fidEntries[0].startTime : 0;
  }

  private getCumulativeLayoutShift(): number {
    return this.metrics
      .filter((m) => m.name === 'layout_shift')
      .reduce((sum, m) => sum + m.value, 0);
  }

  private getTotalBlockingTime(): number {
    return this.metrics
      .filter((m) => m.name === 'long_task' && m.value > 50)
      .reduce((sum, m) => sum + Math.max(0, m.value - 50), 0);
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    const summary: Record<string, { count: number; total: number; avg: number; min: number; max: number }> = {};

    this.metrics.forEach((metric) => {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          total: 0,
          avg: 0,
          min: Infinity,
          max: -Infinity,
        };
      }

      const s = summary[metric.name];
      s.count++;
      s.total += metric.value;
      s.min = Math.min(s.min, metric.value);
      s.max = Math.max(s.max, metric.value);
      s.avg = s.total / s.count;
    });

    return summary;
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = [];
  }

  /**
   * Cleanup observers
   */
  disconnect() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export hook for React components
export const usePerformanceMonitor = () => performanceMonitor;
