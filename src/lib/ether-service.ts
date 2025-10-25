import { ethers, type Log } from "ethers";
import { RPC_URL1, RPC_URL2, RPC_URL3, RPC_URL4, RPC_URL5 } from "@/env";
import type { TransactionDetails } from "@/types";
import { RPCPool } from "./rpc-pool";

class EthersService {
  private rpcPool: RPCPool;
  private readonly USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";

  constructor() {
    const rpcUrls = [
      RPC_URL1,
      RPC_URL2,
      RPC_URL3,
      RPC_URL4,
      RPC_URL4,
      RPC_URL5,
    ];
    this.rpcPool = new RPCPool(rpcUrls);
  }

  private isUSDTContract(address: string): boolean {
    return address.toLowerCase() === this.USDT_CONTRACT.toLowerCase();
  }

  private async getTokenDetails(contractAddress: string): Promise<{
    symbol: string;
    decimals: number;
  } | null> {
    try {
      return await this.rpcPool.executeWithRetry(async (provider) => {
        const abi = [
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
        ];
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const [symbol, decimals] = await Promise.all([
          contract.symbol(),
          contract.decimals(),
        ]);
        return { symbol, decimals };
      });
    } catch (err) {
      console.error("Error fetching token details:", err);
      return null;
    }
  }

  private async validateUSDTTransaction(contractAddress: string): Promise<{
    isUSDT: boolean;
    tokenMismatch: boolean;
    symbol?: string;
    decimals?: number;
  }> {
    const isExpectedUSDT = this.isUSDTContract(contractAddress);

    try {
      const tokenDetails = await this.getTokenDetails(contractAddress);
      if (!tokenDetails) {
        return {
          isUSDT: false,
          tokenMismatch: true,
        };
      }

      const tokenMismatch = !isExpectedUSDT;

      return {
        isUSDT: isExpectedUSDT,
        tokenMismatch,
        symbol: tokenDetails.symbol,
        decimals: tokenDetails.decimals,
      };
    } catch {
      return {
        isUSDT: false,
        tokenMismatch: true,
      };
    }
  }

  private parseTransferLog(log: Log): {
    from: string;
    to: string;
    value: string;
  } | null {
    try {
      const TRANSFER_EVENT_SIG_HASH =
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

      if (log.topics[0] !== TRANSFER_EVENT_SIG_HASH) return null;

      const from = ethers.getAddress(`0x${log.topics[1].slice(26)}`);
      const to = ethers.getAddress(`0x${log.topics[2].slice(26)}`);
      const value = BigInt(log.data).toString();

      return { from, to, value };
    } catch (err) {
      console.error("Failed to parse transfer log:", err);
      return null;
    }
  }

  async getDetailsByHash(hash: string): Promise<TransactionDetails | null> {
    try {
      const [tx, receipt] = await this.rpcPool.executeWithRetry(
        async (provider) => {
          const [tx, receipt] = await Promise.all([
            provider.getTransaction(hash),
            provider.getTransactionReceipt(hash),
          ]);
          return [tx, receipt] as const;
        },
      );

      if (!tx || !receipt) throw new Error("Transaction not found");

      const block = await this.rpcPool.executeWithRetry((provider) =>
        provider.getBlock(receipt.blockNumber!),
      );
      if (!block) throw new Error("block timestamp could not be found");
      const datetime = new Date(Number(block.timestamp) * 1000).toISOString();

      const gasUsed = receipt.gasUsed.toString();
      const gasPrice = tx.gasPrice?.toString() ?? "0";
      const transactionFee = ethers.formatEther(
        (BigInt(gasUsed) * BigInt(gasPrice)).toString(),
      );

      const result: TransactionDetails = {
        contract: null,
        toWalletAddress: tx.to ?? "",
        fromWalletAddress: tx.from,
        amount: "0",
        datetime,
        blockNumber: receipt.blockNumber,
        gasUsed,
        gasPrice,
        transactionFee,
        status: receipt.status === 1,
        isUSDT: false,
        tokenMismatch: false,
        expectedContract: this.USDT_CONTRACT,
      };

      if (tx.to && tx.data !== "0x") {
        result.contract = tx.to;

        const usdtValidation = await this.validateUSDTTransaction(tx.to);
        result.isUSDT = usdtValidation.isUSDT;
        result.tokenMismatch = usdtValidation.tokenMismatch;

        const transferLog = receipt.logs.find(
          (log) =>
            log.topics[0] ===
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        );

        if (transferLog) {
          const transferData = this.parseTransferLog(transferLog);
          if (transferData) {
            result.fromWalletAddress = transferData.from;
            result.toWalletAddress = transferData.to;

            if (usdtValidation.symbol && usdtValidation.decimals) {
              result.tokenSymbol = usdtValidation.symbol;
              result.tokenDecimals = usdtValidation.decimals.toString();

              const raw = BigInt(transferData.value);
              const divisor = BigInt(10) ** BigInt(usdtValidation.decimals);
              result.amount = (Number(raw) / Number(divisor)).toString();
            } else {
              result.amount = transferData.value;
            }
          }
        }
      } else {
        // Native BNB transfer
        result.amount = ethers.formatEther(tx.value);
        result.tokenSymbol = "BNB";
        result.tokenDecimals = "18";
        result.isUSDT = false;
        result.tokenMismatch = true;
      }

      return result;
    } catch (error) {
      console.error("Error in getDetailsByHash:", error);
      throw new Error(
        `Failed to fetch transaction details: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  async validateContractIsUSDT(contractAddress: string): Promise<{
    isValid: boolean;
    isUSDT: boolean;
    tokenMismatch: boolean;
    details?: { symbol: string; decimals: number };
  }> {
    try {
      const validation = await this.validateUSDTTransaction(contractAddress);
      return {
        isValid: !validation.tokenMismatch,
        isUSDT: validation.isUSDT,
        tokenMismatch: validation.tokenMismatch,
        details:
          validation.symbol && validation.decimals
            ? { symbol: validation.symbol, decimals: validation.decimals }
            : undefined,
      };
    } catch {
      return {
        isValid: false,
        isUSDT: false,
        tokenMismatch: true,
      };
    }
  }

  async transactionExists(hash: string): Promise<boolean> {
    try {
      const tx = await this.rpcPool.executeWithRetry((provider) =>
        provider.getTransaction(hash),
      );
      return !!tx;
    } catch {
      return false;
    }
  }

  async getCurrentBlockNumber(): Promise<bigint> {
    try {
      const blockNumber = await this.rpcPool.executeWithRetry((provider) =>
        provider.getBlockNumber(),
      );
      return BigInt(blockNumber);
    } catch (err) {
      console.error("Failed to fetch block number:", err);
      throw new Error("Failed to fetch block number");
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.rpcPool.executeWithRetry((provider) =>
        provider.getBlockNumber(),
      );
      return true;
    } catch {
      return false;
    }
  }

  getUSDTContractAddress(): string {
    return this.USDT_CONTRACT;
  }

  getRPCStats() {
    return this.rpcPool.getStats();
  }

  destroy(): void {
    this.rpcPool.destroy();
  }

  get Hello(): string {
    return "Hello";
  }
}

export const ethersService = new EthersService();
