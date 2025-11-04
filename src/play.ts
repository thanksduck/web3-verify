import { ethersService } from "./lib/ether-service";

const TARGET_WALLET = "0x11fb8d39641c61e9c0cdeb0f9eb97a0ff26471a6";
const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";

async function testTransactionHash(hash: string, description: string) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Testing: ${description}`);
  console.log(`Hash: ${hash}`);
  console.log("=".repeat(80));

  try {
    // Use the new validation method that scans ALL Transfer logs
    const validation = await ethersService.validateTransactionForTargetWallet(
      hash,
      TARGET_WALLET,
    );

    console.log("\n📊 Validation Results:");
    console.log(
      `  Received in Target Wallet: ${validation.receivedInTargetWallet ? "✅ YES" : "❌ NO"}`,
    );
    console.log(
      `  Is USDT Transfer: ${validation.isUSDTTransfer ? "✅ YES" : "❌ NO"}`,
    );
    console.log(
      `  Contract Matches: ${validation.contractMatches ? "✅ YES" : "❌ NO"}`,
    );

    if (validation.contractAddress) {
      console.log("\n💎 Transfer Details:");
      console.log(`  Contract: ${validation.contractAddress}`);
      console.log(`  Expected: ${USDT_CONTRACT}`);
      console.log(`  From: ${validation.fromAddress}`);
      console.log(`  To: ${validation.toAddress}`);
      console.log(`  Amount: ${validation.amount}`);
    }

    if (validation.error) {
      console.log(`\n⚠️  Error: ${validation.error}`);
    }

    // Overall validation
    console.log(`\n${validation.isValid ? "✅" : "❌"} FINAL RESULT:`);
    if (validation.isValid) {
      console.log("  ✅ VALID - USDT transfer to target wallet found!");
      console.log(`     Amount: ${validation.amount} USDT`);
    } else if (
      validation.receivedInTargetWallet &&
      !validation.isUSDTTransfer
    ) {
      console.log("  ⚠️ PARTIAL - Transfer found but not USDT");
      console.log(`     Contract: ${validation.contractAddress}`);
      console.log("     This might be a different token or BNB transfer");
    } else {
      console.log("  ❌ INVALID - No USDT transfer to target wallet found");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

async function main() {
  console.log("🚀 Starting Transaction Validation Tests");
  console.log(`Target Wallet: ${TARGET_WALLET}`);
  console.log(`USDT Contract: ${USDT_CONTRACT}`);

  // Test 1: Direct USDT transfer (if the first hash is correct)
  // Note: The first hash you provided was missing a character
  // If you have the correct hash, test it here

  // Test 2: Transaction with Binance internal transfer (has USDT in logs)
  await testTransactionHash(
    "0x401408dfee4296037df838191d092e22719e92ee1fe0006996b81cb24d66e9d4",
    "Transaction #1 - Binance internal transfer with USDT in logs",
  );

  console.log(`\n${"=".repeat(80)}`);
  console.log("✅ Tests completed");
  console.log("=".repeat(80));
}

main().catch(console.error);
