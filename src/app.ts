import swagger from "@elysiajs/swagger";
import Elysia, { t } from "elysia";
import { ethersService } from "@/lib/ether-service";
import { transactionHashField } from "@/lib/validation";

export const app = new Elysia({
  name: "main_app",
  prefix: "/api",
})
  .use(swagger())

  .get("/health", async () => {
    const isConnected = await ethersService.isConnected();
    return {
      status: isConnected ? "healthy" : "unhealthy",
      service: "Web3 Transaction Verification",
      timestamp: new Date().toISOString(),
      bsc_connection: isConnected,
    };
  })

  .get(
    "/usdt/validate/:contract",
    async ({ params, set }) => {
      try {
        const contractAddress = params.contract.toLowerCase();
        const validation =
          await ethersService.validateContractIsUSDT(contractAddress);

        return {
          success: true,
          contract: contractAddress,
          expectedUSDTContract: ethersService.getUSDTContractAddress(),
          validation,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        set.status = 500;
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Internal server error",
          timestamp: new Date().toISOString(),
        };
      }
    },
    {
      params: t.Object({
        contract: t.String({
          minLength: 42,
          maxLength: 42,
          pattern: "^0x[0-9a-fA-F]{40}$",
          description: "Contract address to validate",
        }),
      }),
    },
  )
  .get("/block", async () => {
    try {
      const blockNumber = await ethersService.getCurrentBlockNumber();
      return {
        success: true,
        currentBlock: `${blockNumber}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  })

  .get(
    "/verify/:hash",
    async ({ params, set }) => {
      try {
        params.hash = params.hash.toLowerCase();

        // Check if transaction exists first
        const exists = await ethersService.transactionExists(params.hash);
        if (!exists) {
          set.status = 404;
          return {
            success: false,
            error: "Transaction not found",
            hash: params.hash,
            timestamp: new Date().toISOString(),
          };
        }

        const details = await ethersService.getDetailsByHash(params.hash);

        if (!details) {
          set.status = 404;
          return {
            success: false,
            error: "Transaction details not found",
            hash: params.hash,
            timestamp: new Date().toISOString(),
          };
        }
        console.log(details);
        return {
          success: true,
          hash: params.hash,

          transaction: {
            contract: details.contract?.toLowerCase(),
            toWalletAddress: details.toWalletAddress.toLowerCase(),
            fromWalletAddress: details.fromWalletAddress.toLowerCase(),
            amount: details.amount,
            datetime: details.datetime,
            blockNumber: details.blockNumber,
            gasUsed: details.gasUsed,
            gasPrice: details.gasPrice,
            transactionFee: details.transactionFee,
            status: details.status,
            tokenSymbol: details.tokenSymbol,
            tokenDecimals: details.tokenDecimals,
            isUSDT: details.isUSDT,
            tokenMismatch: details.tokenMismatch,
            expectedContract: details.expectedContract,
          },
          validation: {
            isValidUSDT: details.isUSDT && !details.tokenMismatch,
            warning: details.tokenMismatch
              ? details.contract
                ? `Transaction involves ${details.tokenSymbol || "unknown token"} instead of USDT`
                : "Transaction is BNB transfer, not USDT"
              : null,
          },
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Verification error:", error);
        set.status = 500;
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Internal server error",
          hash: params.hash,
          timestamp: new Date().toISOString(),
        };
      }
    },
    {
      params: t.Object({
        hash: transactionHashField,
      }),
    },
  )

  .post(
    "/verify/batch",
    async ({ body, set }) => {
      try {
        const results = await Promise.allSettled(
          body.hashes.map(async (hash: string) => {
            const normalizedHash = hash.toLowerCase();
            try {
              const details =
                await ethersService.getDetailsByHash(normalizedHash);
              return {
                hash: normalizedHash,
                success: true,
                transaction: details,
              };
            } catch (error) {
              return {
                hash: normalizedHash,
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              };
            }
          }),
        );

        const response = results.map((result) =>
          result.status === "fulfilled"
            ? result.value
            : {
                success: false,
                error:
                  result.reason instanceof Error
                    ? result.reason.message
                    : "Unknown error",
              },
        );

        return {
          success: true,
          results: response,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        set.status = 500;
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Internal server error",
          timestamp: new Date().toISOString(),
        };
      }
    },
    {
      body: t.Object({
        hashes: t.Array(transactionHashField, {
          minItems: 1,
          maxItems: 10,
          description: "Array of transaction hashes to verify",
        }),
      }),
    },
  );
