const { ethers } = require("ethers");

// ─────────────────────────────────────────────────────────────
// Hardcoded mnemonic (DUST wallet)
// ─────────────────────────────────────────────────────────────
const MNEMONIC = "benefit dinner staff dice letter pig future capable teach easy twenty pottery";

// Farcaster ID Registry contract on Base Mainnet
const ID_REGISTRY_ADDRESS = "0x00000000fc6c5f01fc30151999387bb99a9f489b";

// Minimal ABI for the ID Registry — only what we need
const ID_REGISTRY_ABI = [
  "function idOf(address owner) view returns (uint256)",
  "function custodyOf(uint256 fid) view returns (address)",
  "function ownerOf(uint256 fid) view returns (address)",
  "function nameRegistry() view returns (address)"
];

// Farcaster Hub API (public, no key needed)
const HUBS = [
  "https://hub.pinata.cloud",
  "https://nemes.farcaster.xyz:2281"
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function maskMnemonic(mnemonic) {
  const words = mnemonic.split(" ");
  if (words.length < 4) return mnemonic;
  return words[0] + " ... " + words[words.length - 1];
}

function maskPrivateKey(pk) {
  if (!pk) return "(none)";
  if (pk.length < 14) return pk;
  return pk.slice(0, 6) + "..." + pk.slice(-4);
}

async function fetchJson(url, options = {}) {
  const https = require("https");
  const http = require("http");
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(55));
  console.log("  Farcaster Account Check");
  console.log("═".repeat(55));

  // 1. Recover wallet
  const wallet = ethers.Wallet.fromPhrase(MNEMONIC);
  const address = wallet.address;

  console.log("\n📋 Mnemonic   :", maskMnemonic(MNEMONIC));
  console.log("🔑 Address    :", address);
  console.log("🔐 Private Key:", maskPrivateKey(wallet.privateKey));

  // 2. Connect to Base Mainnet
  console.log("\n" + "─".repeat(55));
  console.log("  Checking Farcaster ID Registry...");
  console.log("─".repeat(55));

  let fid = 0;
  try {
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const registry = new ethers.Contract(ID_REGISTRY_ADDRESS, ID_REGISTRY_ABI, provider);

    fid = Number(await registry.idOf(address));
    console.log("  Contract :", ID_REGISTRY_ADDRESS);

    if (fid > 0) {
      console.log("  ✅ FID    :", fid);

      // Get custody address
      try {
        const custody = await registry.custodyOf(fid);
        console.log("  🏛️ Custody :", custody);
      } catch (e) {
        console.log("  ⚠️  Custody check failed (may not be registered on L2)");
      }

      // Try to get the owner
      try {
        const owner = await registry.ownerOf(fid);
        console.log("  👤 Owner  :", owner.toLowerCase() === address.toLowerCase() ? address + " (this wallet)" : owner);
      } catch (e) {
        console.log("  ⚠️  Owner check failed:", e.message.slice(0, 80));
      }
    } else {
      console.log("  ❌ No Farcaster account found for this wallet (FID = 0)");
    }
  } catch (err) {
    console.log("  ❌ Contract query failed:", err.message.slice(0, 120));
  }

  // 3. Try Hub API for additional info
  if (fid > 0) {
    console.log("\n" + "─".repeat(55));
    console.log("  Fetching profile from Farcaster Hubs...");
    console.log("─".repeat(55));

    let profileFound = false;
    for (const hubUrl of HUBS) {
      if (profileFound) break;
      try {
        console.log("\n  Trying hub:", hubUrl);

        // Try v2 API first (more endpoints available)
        const userData = await fetchJson(`${hubUrl}/v2/userData?fid=${fid}`);
        
        if (userData && userData.messages) {
          const data = {};
          for (const msg of userData.messages) {
            const type = msg.data?.userDataBody?.type;
            const value = msg.data?.userDataBody?.value;
            const typeNames = {
              1: "pfp",
              2: "display",
              3: "bio",
              4: "url",
              5: "username"
            };
            if (type && value) {
              data[typeNames[type] || type] = value;
            }
          }

          console.log("  🖼️  PFP     :", data.pfp || "(none)");
          console.log("  👤 Username : @", data.username || "(unknown)");
          console.log("  📝 Display  :", data.display || "(none)");
          console.log("  📖 Bio      :", (data.bio || "(none)").slice(0, 200));
          console.log("  🔗 URL      :", data.url || "(none)");
          profileFound = true;
        }

        // Also try fetching recent casts
        try {
          const casts = await fetchJson(`${hubUrl}/v1/castsByFid?fid=${fid}&pageSize=3`);
          if (casts && casts.messages && casts.messages.length > 0) {
            console.log("\n  📢 Recent Casts:");
            for (const cast of casts.messages.slice(0, 3)) {
              const text = cast.data?.castAddBody?.text || "(empty)";
              const hash = cast.hash?.slice(0, 10) || "???";
              console.log(`     [${hash}] ${text.slice(0, 120)}`);
            }
          } else {
            console.log("\n  📢 No casts found (or API doesn't support cast history)");
          }
        } catch (e) {
          console.log("\n  ⚠️  Could not fetch casts:", e.message.slice(0, 60));
        }

      } catch (err) {
        console.log("  ⚠️  Hub error:", err.message.slice(0, 80));
      }
    }

    if (!profileFound) {
      console.log("\n  ⚠️  Could not fetch profile from any hub.");
      console.log("  Check manually: https://warpcast.com/~/inbox?address=" + address);
    }
  }

  // 4. Summary
  console.log("\n" + "═".repeat(55));
  if (fid > 0) {
    console.log("  ✅ This wallet HAS a Farcaster account! (FID:", fid + ")");
    console.log("  🌐 https://warpcast.com/");
  } else {
    console.log("  ❌ No Farcaster account tied to this wallet.");
    console.log("  📝 You can register at https://warpcast.com/");
  }
  console.log("═".repeat(55) + "\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});