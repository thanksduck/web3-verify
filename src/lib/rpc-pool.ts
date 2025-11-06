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
  private readonly healthCheckInterval = 3600000; // 1 hour (changed from 60 seconds to save costs)
  private healthCheckTimer?: Timer;

  constructor(rpcUrls: string[]) {
    console.info(
      `[RPC POOL] Initializing pool with ${rpcUrls.length} endpoints`,
    );
    this.initializeEndpoints(rpcUrls);
    this.startHealthChecks();
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

    console.info("[RPC POOL] Running initial health check on startup");
    // Initial health check
    this.checkAllEndpoints();
  }

  private async checkEndpointHealth(endpoint: RPCEndpoint) {
    const start = Date.now();
    try {
      console.info(
        `[RPC CALL] Health check to: ${endpoint.url.substring(0, 50)}...`,
      );
      await endpoint.provider.getBlockNumber();
      endpoint.latency = Date.now() - start;
      endpoint.isHealthy = true;
      endpoint.failureCount = 0;
      endpoint.lastChecked = Date.now();
      console.info(
        `[RPC SUCCESS] Health check passed in ${endpoint.latency}ms: ${endpoint.url.substring(0, 50)}...`,
      );
    } catch (error) {
      endpoint.failureCount++;
      endpoint.isHealthy = endpoint.failureCount < this.maxFailures;
      endpoint.lastChecked = Date.now();
      console.warn(
        `[RPC FAILED] Health check failed for ${endpoint.url.substring(0, 50)}...`,
        error,
      );
    }
  }

  private async checkAllEndpoints(): Promise<void> {
    console.info(
      `[RPC POOL] Running health check on ${this.endpoints.length} endpoints`,
    );
    await Promise.allSettled(
      this.endpoints.map((endpoint) => this.checkEndpointHealth(endpoint)),
    );
    console.info("[RPC POOL] Health check completed");
  }

  private startHealthChecks(): void {
    console.info(
      `[RPC POOL] Starting health checks every ${this.healthCheckInterval / 1000 / 60} minutes (hourly)`,
    );
    this.healthCheckTimer = setInterval(() => {
      console.info("[RPC POOL] Hourly scheduled health check triggered");
      this.checkAllEndpoints();
    }, this.healthCheckInterval);
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
    maxRetries = 3,
  ): Promise<T> {
    const healthy = this.getHealthyEndpoints();
    const candidates =
      healthy.length > 0 ? healthy : this.endpoints.slice(0, maxRetries);

    let lastError: Error | null = null;

    for (let i = 0; i < Math.min(candidates.length, maxRetries); i++) {
      const endpoint = candidates[i];
      try {
        console.info(
          `[RPC CALL] Executing request on: ${endpoint.url.substring(0, 50)}... (attempt ${i + 1}/${maxRetries})`,
        );
        const result = await fn(endpoint.provider);
        // Success - mark as healthy
        endpoint.failureCount = 0;
        endpoint.isHealthy = true;
        console.info(
          `[RPC SUCCESS] Request succeeded on: ${endpoint.url.substring(0, 50)}...`,
        );
        return result;
      } catch (error) {
        lastError = error as Error;
        endpoint.failureCount++;
        endpoint.isHealthy = endpoint.failureCount < this.maxFailures;
        console.warn(
          `[RPC FAILED] ${endpoint.url.substring(0, 50)}... failed (attempt ${i + 1}/${maxRetries}):`,
          error,
        );

        // If this wasn't the last attempt, continue to next RPC
        if (i < Math.min(candidates.length, maxRetries) - 1) {
        }
      }
    }

    throw new Error(
      `All RPC attempts failed. Last error: ${lastError?.message || "Unknown error"}`,
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
      console.info("[RPC POOL] Health check timer cleared");
    }
  }
}
