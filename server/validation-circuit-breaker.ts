/**
 * Circuit Breaker Pattern for Validation Service Reliability
 * Based on CC-Mathmaster's PrewarmedValidationService pattern
 */

export interface CircuitBreakerOptions {
  maxFailures: number;
  resetTimeout: number;
  name: string;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class ValidationCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state = CircuitState.CLOSED;
  private readonly maxFailures: number;
  private readonly resetTimeout: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions) {
    this.maxFailures = options.maxFailures;
    this.resetTimeout = options.resetTimeout;
    this.name = options.name;
  }

  async callWithFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    if (this.isOpen()) {
      console.warn(`[${this.name}] Circuit breaker is OPEN, using fallback`);
      return await fallback();
    }

    if (this.isHalfOpen()) {
      console.info(`[${this.name}] Circuit breaker is HALF_OPEN, testing primary`);
    }

    try {
      const result = await primary();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      console.error(`[${this.name}] Primary function failed:`, error);
      return await fallback();
    }
  }

  private isOpen(): boolean {
    if (this.state !== CircuitState.OPEN) {
      return false;
    }

    // Check if reset timeout has passed
    if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
      this.state = CircuitState.HALF_OPEN;
      console.info(`[${this.name}] Circuit breaker transitioning to HALF_OPEN`);
      return false;
    }

    return true;
  }

  private isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.reset();
      console.info(`[${this.name}] Circuit breaker reset to CLOSED after successful call`);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.maxFailures) {
      this.state = CircuitState.OPEN;
      console.warn(`[${this.name}] Circuit breaker OPENED after ${this.failureCount} failures`);
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = CircuitState.CLOSED;
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  forceReset(): void {
    this.reset();
    console.info(`[${this.name}] Circuit breaker manually reset`);
  }
}

// Pre-configured circuit breakers for different validation services
export const aiValidationBreaker = new ValidationCircuitBreaker({
  maxFailures: 3,
  resetTimeout: 30000, // 30 seconds
  name: 'AI_Validation'
});

export const sympyValidationBreaker = new ValidationCircuitBreaker({
  maxFailures: 2,
  resetTimeout: 15000, // 15 seconds
  name: 'SymPy_Validation'
});

export const batchValidationBreaker = new ValidationCircuitBreaker({
  maxFailures: 5,
  resetTimeout: 60000, // 60 seconds
  name: 'Batch_Validation'
});