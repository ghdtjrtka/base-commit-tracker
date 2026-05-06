const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const MNEMONIC = "benefit dinner staff dice letter pig future capable teach easy twenty pottery";
const SEPOLIA_RPC = "https://sepolia.base.org";
const CONTRACT_ADDRESS = "0x7a6fe02d3607De093287026e38ED0D448F82E8E4";

// CommitTracker ABI — for reading state
const CONTRACT_ABI = [
  "function commit() external returns (uint256)",
  "function totalCommits() external view returns (uint256)",
  "function commits(address,uint256) view returns (uint256,bytes32)"
];

const LOG_FILE = path.join(__dirname, "daily-log.json");

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function loadLog() {
  if (fs.existsSync(LOG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
      if (Array.isArray(data)) return data;
    } catch { /* fall through */ }
  }
  return [];
}

function saveLog(log, entry) {
  log.push(entry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2) + "\n");
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(50));
  console.log("  Auto Commit — Base Sepolia");
  console.log("═".repeat(50));

  // 1. Connect
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = ethers.Wallet.fromPhrase(MNEMONIC);
  const signer = wallet.connect(provider);

  console.log(`\n📋 Wallet      : ${wallet.address}`);
  console.log(`📋 Contract    : ${CONTRACT_ADDRESS}`);

  // 2. Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance     : ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error("Wallet balance is 0 ETH — cannot pay gas");
  }

  // 3. Get current total commits (read contract state)
  let contractCommitsBefore = 0;
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const count = await contract.totalCommits();
    contractCommitsBefore = Number(count);
    console.log(`📊 Contract totalCommits: ${contractCommitsBefore}`);
  } catch {
    console.log("⚠️  Could not read contract totalCommits — contract may be paused");
  }

  // 4. Try sending a commit via the contract first
  let receipt = null;
  let commitMethod = "self-transfer"; // fallback
  const dateStr = new Date().toISOString().split("T")[0];

  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Try contract commit() — skip estimateGas, just send with fixed limit
    console.log("\n📤 Attempting contract.commit()...");
    const tx = await contract.commit({ gasLimit: 300000 });
    console.log(`   Tx hash: ${tx.hash}`);
    receipt = await tx.wait();
    commitMethod = "contract";

    console.log(`   Status : ${receipt.status === 1 ? "✅ Success" : "❌ Reverted"}`);

    if (receipt.status === 0) {
      // Contract reverted — that's OK, we fall through to self-transfer
      console.log("   Contract commit() reverted — falling back to self-transfer...");
      receipt = null;
    }
  } catch (err) {
    console.log(`   ⚠️  Contract commit() failed: ${err.message.substring(0, 80)}`);
    console.log("   Falling back to self-transfer...");
  }

  // 5. Fallback: self-transfer with daily data
  if (!receipt) {
    const msg = `daily-commit:${dateStr}`;
    const data = ethers.hexlify(ethers.toUtf8Bytes(msg));

    const tx = {
      to: wallet.address,  // send to self
      value: 0n,           // zero ETH transfer
      data: data,
      gasLimit: 50000,
    };

    console.log("\n📤 Sending self-transfer (daily commit)...");
    const sentTx = await signer.sendTransaction(tx);
    console.log(`   Tx hash: ${sentTx.hash}`);
    receipt = await sentTx.wait();
    commitMethod = "self-transfer";
  }

  // 6. Get updated totals
  let contractCommitsAfter = contractCommitsBefore;
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const count = await contract.totalCommits();
    contractCommitsAfter = Number(count);
  } catch { /* ignore */ }

  // 7. Print summary
  console.log("\n" + "─".repeat(50));
  console.log(`✅ Commit cycle complete`);
  console.log("─".repeat(50));
  console.log(`   Method      : ${commitMethod}`);
  console.log(`   Tx hash     : ${receipt.hash}`);
  console.log(`   Block #     : ${receipt.blockNumber}`);
  console.log(`   Gas used    : ${receipt.gasUsed.toString()}`);
  console.log(`   Gas price   : ${ethers.formatUnits(receipt.gasPrice || 0n, "gwei")} gwei`);
  console.log(`   Status      : ${receipt.status === 1 ? "Success" : "Failed"}`);
  console.log(`   Contract    : ${contractCommitsBefore} → ${contractCommitsAfter}`);

  // 8. Update daily log
  const log = loadLog();
  const entry = {
    date: dateStr,
    timestamp: new Date().toISOString(),
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    gasPrice: (receipt.gasPrice || 0n).toString(),
    method: commitMethod,
    contractCommits: contractCommitsAfter.toString(),
    status: receipt.status === 1 ? "success" : "failed"
  };
  saveLog(log, entry);
  console.log(`\n📝 Log entries : ${log.length}`);

  console.log("\n" + "═".repeat(50));
  console.log("  Done.");
  console.log("═".repeat(50) + "\n");

  // Machine-readable output
  console.log(`TX_HASH=${receipt.hash}`);
  console.log(`GAS_USED=${receipt.gasUsed.toString()}`);
  console.log(`METHOD=${commitMethod}`);
  console.log(`CONTRACT_COMMITS=${contractCommitsAfter}`);
}

main().catch((err) => {
  console.error(`\n❌ Error: ${err.message}`);
  console.log(`ERROR=${err.message}`);
  process.exit(1);
});