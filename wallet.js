const { ethers } = require("ethers");

// ─────────────────────────────────────────────────────────────
// Hardcoded mnemonic (DUST / TEST wallet — never use for real funds)
// ─────────────────────────────────────────────────────────────
const MNEMONIC = "benefit dinner staff dice letter pig future capable teach easy twenty pottery";

// RPC endpoints
const SEPOLIA_RPC = "https://sepolia.base.org";
const MAINNET_RPC = "https://mainnet.base.org";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function maskPrivateKey(pk) {
  // Show only first 6 chars (0x + 4 hex) and last 4 chars
  //   e.g. "0xabcd...ef01"
  if (!pk) return "(none)";
  if (pk.length < 14) return pk; // too short to mask meaningfully
  return pk.slice(0, 6) + "..." + pk.slice(-4);
}

function maskMnemonic(mnemonic) {
  const words = mnemonic.split(" ");
  if (words.length < 4) return mnemonic;
  return words[0] + " ... " + words[words.length - 1];
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(50));
  console.log("  Base Wallet Verification");
  console.log("═".repeat(50));

  // 1. Recover wallet from mnemonic
  const wallet = ethers.Wallet.fromPhrase(MNEMONIC);

  console.log("\n📋 Mnemonic   :", maskMnemonic(MNEMONIC));
  console.log("🔑 Address    :", wallet.address);
  console.log("🔐 Private Key:", maskPrivateKey(wallet.privateKey));

  // 2. Base Sepolia
  console.log("\n" + "─".repeat(50));
  console.log("  Base Sepolia");
  console.log("─".repeat(50));

  try {
    const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const sepoliaBalance = await sepoliaProvider.getBalance(wallet.address);
    console.log("🌐 RPC        :", SEPOLIA_RPC);
    console.log("💰 Balance    :", ethers.formatEther(sepoliaBalance), "ETH");
  } catch (err) {
    console.log("❌ Error      :", err.message);
  }

  // 3. Base Mainnet
  console.log("\n" + "─".repeat(50));
  console.log("  Base Mainnet");
  console.log("─".repeat(50));

  try {
    const mainnetProvider = new ethers.JsonRpcProvider(MAINNET_RPC);
    const mainnetBalance = await mainnetProvider.getBalance(wallet.address);
    console.log("🌐 RPC        :", MAINNET_RPC);
    console.log("💰 Balance    :", ethers.formatEther(mainnetBalance), "ETH");
  } catch (err) {
    console.log("❌ Error      :", err.message);
  }

  console.log("\n" + "═".repeat(50));
  console.log("  Done.");
  console.log("═".repeat(50) + "\n");
}

main().catch(console.error);