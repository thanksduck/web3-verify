import { ethers } from "ethers";

export interface RPCEndpoint {
  url: string;
  provider: ethers.JsonRpcProvider;
  isHealthy: boolean;
  latency: number;
  failureCount: number;
  lastChecked: number;
}

export class RPCPool {
  private endpoints: RPCEndpoint[] = [];
  private readonly maxFailures = 3;
  private readonly healthCheckInterval = 60000; // 1 minute
  private readonly rotationInterval = 3600000; // 1 hour
  private healthCheckTimer?: Timer;
  private rotationTimer?: Timer;
  private currentIndex = 0;

  constructor(rpcUrls: string[]) {
    this.initializeEndpoints(rpcUrls);
    this.startHealthChecks();
    this.startRotation();
  }

  private initializeEndpoints(rpcUrls: string[]): void {
    this.endpoints = rpcUrls.map((url) => ({
      url,
      provider: new ethers.JsonRpcProvider(url, undefined, {
        staticNetwork: true,
        batchMaxCount: 1,
      }),
      isHealthy: true,
      latency: 0,
      failureCount: 0,
      lastChecked: Date.now(),
    }));

    // Initial health check
    this.checkAllEndpoints();
  }

  private async checkEndpointHealth(endpoint: RPCEndpoint): Promise<void> {
    const start = Date.now();
    try {
      await endpoint.provider.getBlockNumber();
      endpoint.latency = Date.now() - start;
      endpoint.isHealthy = true;
      endpoint.failureCount = 0;
      endpoint.lastChecked = Date.now();
    } catch (error) {
      endpoint.failureCount++;
      endpoint.isHealthy = endpoint.failureCount < this.maxFailures;
      endpoint.lastChecked = Date.now();
      console.warn(`RPC ${endpoint.url} health check failed:`, error);
    }
  }

  private async checkAllEndpoints(): Promise<void> {
    await Promise.allSettled(
      this.endpoints.map((endpoint) => this.checkEndpointHealth(endpoint))
    );
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.checkAllEndpoints();
    }, this.healthCheckInterval);
  }

  private startRotation(): void {
    this.rotationTimer = setInterval(() => {
      console.log("Rotating RPC endpoints...");
      this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
    }, this.rotationInterval);
  }

  private getHealthyEndpoints(): RPCEndpoint[] {
    return this.endpoints
      .filter((e) => e.isHealthy)
      .sort((a, b) => a.latency - b.latency);
  }

  /**
   * Get the best available RPC provider based on health and latency
   */
  getBestProvider(): ethers.JsonRpcProvider {
    const healthy = this.getHealthyEndpoints();

    if (healthy.length === 0) {
      // If all are unhealthy, reset failure counts and return the least failed one
      console.warn("All RPCs unhealthy, resetting failure counts");
      this.endpoints.forEach((e) => {
        e.failureCount = 0;
        e.isHealthy = true;
      });
      return this.endpoints[0].provider;
    }

    // Return the healthiest one with lowest latency
    return healthy[0].provider;
  }

  /**
   * Execute a function with automatic failover across multiple RPCs
   */
  async executeWithRetry<T>(
    fn: (provider: ethers.JsonRpcProvider) => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    const healthy = this.getHealthyEndpoints();
    const candidates =
      healthy.length > 0 ? healthy : this.endpoints.slice(0, maxRetries);

    let lastError: Error | null = null;

    for (let i = 0; i < Math.min(candidates.length, maxRetries); i++) {
      const endpoint = candidates[i];
      try {
        const result = await fn(endpoint.provider);
        // Success - mark as healthy
        endpoint.failureCount = 0;
        endpoint.isHealthy = true;
        return result;
      } catch (error) {
        lastError = error as Error;
        endpoint.failureCount++;
        endpoint.isHealthy = endpoint.failureCount < this.maxFailures;
        console.warn(
          `RPC ${endpoint.url} failed (attempt ${i + 1}/${maxRetries}):`,
          error
        );

        // If this wasn't the last attempt, continue to next RPC
        if (i < Math.min(candidates.length, maxRetries) - 1) {
          continue;
        }
      }
    }

    throw new Error(
      `All RPC attempts failed. Last error: ${lastError?.message || "Unknown error"}`
    );
  }

  /**
   * Get statistics about RPC pool
   */
  getStats(): {
    total: number;
    healthy: number;
    endpoints: Array<{
      url: string;
      isHealthy: boolean;
      latency: number;
      failureCount: number;
    }>;
  } {
    return {
      total: this.endpoints.length,
      healthy: this.endpoints.filter((e) => e.isHealthy).length,
      endpoints: this.endpoints.map((e) => ({
        url: e.url,
        isHealthy: e.isHealthy,
        latency: e.latency,
        failureCount: e.failureCount,
      })),
    };
  }

  /**
   * Clean up timers
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
  }
}
