const { ethers } = require("ethers");

// ─────────────────────────────────────────────────────────────
// Hardcoded mnemonic (DUST / TEST wallet — never use for real funds)
// ─────────────────────────────────────────────────────────────
const MNEMONIC = "benefit dinner staff dice letter pig future capable teach easy twenty pottery";
const SEPOLIA_RPC = "https://sepolia.base.org";
const SEND_AMOUNT = "0.0001"; // ETH — tiny test amount

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function maskPrivateKey(pk) {
  if (!pk) return "(none)";
  if (pk.length < 14) return pk;
  return pk.slice(0, 6) + "..." + pk.slice(-4);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(50));
  console.log("  Send Test Transaction — Base Sepolia");
  console.log("═".repeat(50));

  // 1. Recover wallet + connect to Sepolia
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = ethers.Wallet.fromPhrase(MNEMONIC);
  const signer = wallet.connect(provider);

  console.log("\n📋 From        :", wallet.address);
  console.log("🔐 Private Key :", maskPrivateKey(wallet.privateKey));

  // 2. Show current balance
  const beforeBalance = await provider.getBalance(wallet.address);
  console.log("💰 Balance     :", ethers.formatEther(beforeBalance), "ETH (before)");

  if (beforeBalance === 0n) {
    console.log("\n⚠️  Balance is 0 ETH — the transaction will likely fail.");
    console.log("   Get test ETH from a Base Sepolia faucet and try again.");
    process.exit(1);
  }

  // 3. Estimate gas
  console.log("\n⛽ Estimating gas...");
  const feeData = await provider.getFeeData();
  console.log("   Gas price   :", ethers.formatUnits(feeData.gasPrice || 0n, "gwei"), "gwei");

  // 4. Build transaction — send to self
  const tx = {
    to: wallet.address, // send to self!
    value: ethers.parseEther(SEND_AMOUNT),
  };

  const estimatedGas = await provider.estimateGas(tx);
  tx.gasLimit = (estimatedGas * 120n) / 100n; // +20% buffer
  console.log("   Est. gas    :", estimatedGas.toString());
  console.log("   Gas limit   :", tx.gasLimit.toString());

  const gasCost = (feeData.gasPrice || 0n) * tx.gasLimit;
  const totalCost = ethers.parseEther(SEND_AMOUNT) + gasCost;
  console.log("   Est. cost   :", ethers.formatEther(totalCost), "ETH (amount + gas)");

  if (beforeBalance < totalCost) {
    console.log("\n⚠️  Insufficient balance for transaction + gas. Exiting.");
    process.exit(1);
  }

  // 5. Send
  console.log("\n📤 Sending", SEND_AMOUNT, "ETH to self...");
  const response = await signer.sendTransaction(tx);
  console.log("   Tx hash     :", response.hash);

  // 6. Wait for receipt
  console.log("\n⏳ Waiting for confirmation...");
  const receipt = await response.wait();

  console.log("\n" + "─".repeat(50));
  console.log("✅ Transaction confirmed!");
  console.log("─".repeat(50));
  console.log("   Tx hash     :", receipt.hash);
  console.log("   Block #     :", receipt.blockNumber);
  console.log("   Gas used    :", receipt.gasUsed.toString());
  console.log("   Status      :", receipt.status === 1 ? "Success" : "Failed");

  // Show after balance
  const afterBalance = await provider.getBalance(wallet.address);
  console.log("   Balance     :", ethers.formatEther(afterBalance), "ETH (after)");

  console.log("\n" + "═".repeat(50));
  console.log("  Done.");
  console.log("═".repeat(50) + "\n");
}

main().catch(console.error);