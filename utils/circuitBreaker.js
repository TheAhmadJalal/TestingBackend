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

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.state = "CLOSED"; // CLOSED = normal, OPEN = failing, HALF_OPEN = testing
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.fallbackFunction = options.fallback || null;
    this.successThreshold = options.successThreshold || 2; // Successful calls to close circuit
    this.successCount = 0;

    // Initialize stats tracking
    this.stats = {
      success: 0,
      failure: 0,
      rejected: 0,
      fallbackSuccess: 0,
      fallbackFailure: 0,
      lastTripped: null,
      totalCalls: 0,
    };

    console.log(`Circuit breaker "${name}" initialized`);
  }

  async execute(fn, ...args) {
    this.stats.totalCalls++;

    // If circuit is open, check if we should try again
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        console.log(`Circuit "${this.name}" entering half-open state`);
        this.state = "HALF_OPEN";
        this.successCount = 0;
      } else {
        this.stats.rejected++;
        console.log(`Circuit "${this.name}" is OPEN, request rejected`);

        if (this.fallbackFunction) {
          try {
            const fallbackResult = await this.fallbackFunction(...args);
            this.stats.fallbackSuccess++;
            return fallbackResult;
          } catch (fallbackError) {
            console.error(
              `Circuit "${this.name}" fallback failed:`,
              fallbackError
            );
            this.stats.fallbackFailure++;
            throw new Error(
              `Circuit "${this.name}" is OPEN and fallback failed`
            );
          }
        }

        throw new Error(`Circuit "${this.name}" is OPEN, request rejected`);
      }
    }

    try {
      const result = await fn(...args);

      this.stats.success++;

      // If we were in HALF_OPEN, check if we've hit success threshold
      if (this.state === "HALF_OPEN") {
        this.successCount++;

        if (this.successCount >= this.successThreshold) {
          console.log(
            `Circuit "${this.name}" is now CLOSED after ${this.successCount} successful tests`
          );
          this.state = "CLOSED";
          this.failureCount = 0;
        }
      } else {
        // Reset failure count on successful CLOSED state operation
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      this.stats.failure++;

      console.error(
        `Circuit "${this.name}" recorded failure ${this.failureCount}/${this.failureThreshold}:`,
        error.message
      );

      // If we've hit the threshold, open the circuit
      if (this.failureCount >= this.failureThreshold) {
        this.state = "OPEN";
        this.stats.lastTripped = new Date();
        console.warn(
          `Circuit "${this.name}" is now OPEN due to multiple failures`
        );
      }

      // If fallback exists, use it
      if (this.fallbackFunction) {
        try {
          const fallbackResult = await this.fallbackFunction(...args);
          this.stats.fallbackSuccess++;
          return fallbackResult;
        } catch (fallbackError) {
          this.stats.fallbackFailure++;
          console.error(
            `Circuit "${this.name}" fallback failed:`,
            fallbackError
          );
        }
      }

      throw error;
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getStats() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failureCount,
      threshold: this.failureThreshold,
      resetTimeout: this.resetTimeout,
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
      statistics: { ...this.stats },
      timeUntilReset:
        this.state === "OPEN" && this.lastFailureTime
          ? Math.max(0, this.resetTimeout - (Date.now() - this.lastFailureTime))
          : 0,
    };
  }

  // Force reset the circuit breaker
  reset() {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    console.log(`Circuit "${this.name}" has been manually reset`);
  }
}

// Singleton map of circuit breakers
const circuitBreakers = {};

// Factory function to get or create circuit breakers
export const getCircuitBreaker = (name, options = {}) => {
  if (!circuitBreakers[name]) {
    circuitBreakers[name] = new CircuitBreaker(name, options);
  }
  return circuitBreakers[name];
};

// Get statistics for all circuit breakers
export const getAllCircuitBreakerStats = () => {
  return Object.keys(circuitBreakers).map((name) =>
    circuitBreakers[name].getStats()
  );
};

// Reset all circuit breakers
export const resetAllCircuitBreakers = () => {
  Object.values(circuitBreakers).forEach((breaker) => breaker.reset());
  return Object.keys(circuitBreakers).length;
};

export default {
  getCircuitBreaker,
  getAllCircuitBreakerStats,
  resetAllCircuitBreakers,
};
