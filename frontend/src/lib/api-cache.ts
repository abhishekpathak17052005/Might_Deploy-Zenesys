/**
 * Simple in-memory cache for API responses
 * Reduces unnecessary API calls and improves UX
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private retryQueue: Array<{ fn: () => Promise<any>; retries: number }> = [];

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Clear specific cache entry or all cache
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Retry failed request with exponential backoff
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i); // exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("All retries failed");
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

export const apiCache = new APICache();
