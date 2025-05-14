/**
 * Project: School E-Voting System
 * Developer: Hassan Iftikhar
 * Date: May 2025
 * Description: Backend & Frontend developed by Hassan Iftikhar.
 * Website: https://hassaniftikhar.vercel.app/
 * Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
 * LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
 * Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
 * Email: hassaniftikhardev@gmail.com
 * Note: Redistribution or commercial use without license is not allowed.
 */

const createDefaultSettings = () => ({
  isActive: false,
  electionTitle: "Student Council Election 2025",
  votingStartDate: new Date().toISOString().split("T")[0],
  votingEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0],
  votingStartTime: "08:00",
  votingEndTime: "17:00",
  resultsPublished: false,
  systemName: "School Election System",
});

// Default election status
const createDefaultElectionStatus = () => ({
  title: "Default Election",
  date: new Date().toISOString().split("T")[0],
  isActive: false,
  startTime: "08:00:00",
  endTime: "17:00:00",
});

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      expirations: 0,
      lastReset: Date.now(),
    };

    // Initialize with default values
    this.set("electionStatus", createDefaultElectionStatus(), {
      ttl: 300000,
      source: "initialization",
    });

    this.set("settings", createDefaultSettings(), {
      ttl: 600000,
      source: "initialization",
    });

    // Set up periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // 5 minutes
  }

  /**
   * Get an item from cache
   * @param {string} key - Cache key
   * @param {Object} options - Optional parameters
   * @param {boolean} options.allowExpired - Whether to return expired items
   * @returns {any} - The cached value or null if not found
   */
  get(key, options = {}) {
    this.stats.totalRequests++;

    if (!this.cache.has(key)) {
      this.stats.misses++;
      return null;
    }

    const cacheItem = this.cache.get(key);
    const now = Date.now();

    // Check if item has expired
    if (cacheItem.expiry !== 0 && now > cacheItem.expiry) {
      if (!options.allowExpired) {
        this.stats.misses++;
        return null;
      }
      // Return expired item if allowed (useful during outages)
      cacheItem.isStale = true;
    }

    this.stats.hits++;
    cacheItem.lastAccessed = now;
    cacheItem.hits++;
    return cacheItem.data;
  }

  /**
   * Store an item in cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {Object} options - Cache options
   * @param {number} options.ttl - Time to live in milliseconds (0 for no expiry)
   * @param {string} options.source - Source of the data (e.g., 'database', 'default')
   * @returns {boolean} - Success indicator
   */
  set(key, data, options = {}) {
    const { ttl = 300000, source = "unknown" } = options; // Default 5 minutes TTL

    if (data === undefined || data === null) {
      console.warn(
        `[CACHE] Attempted to cache null/undefined for key "${key}"`
      );

      // Set a default value based on the key
      if (key === "electionStatus") {
        data = createDefaultElectionStatus();
      } else if (key === "settings") {
        data = createDefaultSettings();
      } else {
        // For unknown keys, return false to indicate failure
        return false;
      }

      console.log(`[CACHE] Used default value for "${key}" instead`);
    }

    // Add timestamp to help with debugging cache issues
    const timestamp = new Date().toISOString();

    const cacheItem = {
      data,
      created: Date.now(),
      lastAccessed: Date.now(),
      expiry: ttl === 0 ? 0 : Date.now() + ttl,
      isStale: false,
      source,
      hits: 0,
      timestamp,
    };

    this.cache.set(key, cacheItem);
    // console.log(
    //   `[CACHE] Set key "${key}" with TTL ${ttl}ms from ${source} at ${timestamp}`
    // );
    return true;
  }

  /**
   * Invalidate a specific cache item
   * @param {string} key - Cache key to invalidate
   */
  invalidate(key) {
    if (this.cache.has(key)) {
      console.log(`[CACHE] Invalidated cache key "${key}"`);
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Remove expired items from cache
   */
  cleanup() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.expiry !== 0 && now > item.expiry) {
        this.cache.delete(key);
        expiredCount++;
        this.stats.expirations++;
      }
    }

    if (expiredCount > 0) {
      console.log(`[CACHE] Cleaned up ${expiredCount} expired items`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate =
      this.stats.totalRequests > 0
        ? ((this.stats.hits / this.stats.totalRequests) * 100).toFixed(2) + "%"
        : "0%";

    return {
      ...this.stats,
      hitRate,
      itemCount: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryUsageEstimate: this._estimateMemoryUsage(),
    };
  }

  /**
   * Estimate cache memory usage (very rough estimate)
   * @private
   */
  _estimateMemoryUsage() {
    let total = 0;
    for (const [key, item] of this.cache.entries()) {
      // Key size (Unicode string)
      total += key.length * 2;

      // Item metadata
      total += 48;

      // Rough size estimate for data (very approximate)
      const dataStr = JSON.stringify(item.data);
      total += dataStr ? dataStr.length * 2 : 0;
    }

    // Convert to KB
    return Math.round(total / 1024) + " KB";
  }

  /**
   * Reset the cache statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      expirations: 0,
      lastReset: Date.now(),
    };
    return this.stats;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const count = this.cache.size;
    this.cache.clear();

    // Re-initialize with defaults
    this.set("electionStatus", createDefaultElectionStatus(), {
      ttl: 300000,
      source: "initialization",
    });

    this.set("settings", createDefaultSettings(), {
      ttl: 600000,
      source: "initialization",
    });

    console.log(
      `[CACHE] Cleared ${count} items from cache and restored defaults`
    );
    return count;
  }

  /**
   * Destroy the cache manager and clean up
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    console.log("[CACHE] Cache manager destroyed");
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

export default cacheManager;
