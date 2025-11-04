// scripts/reconstruct-before-from-tx.cjs
// -------------------------------------------------------------
// ✅ Reconstruct BEFORE-removal balances using the removal tx
// ✅ Extracts HOODI + WETH returned from logs
// ✅ Saves before.json and after.json
// -------------------------------------------------------------

const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

// ERC20 Transfer event
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function main() {
  const removalTxHash = process.env.REMOVAL_TX_HASH;
  if (!removalTxHash) throw new Error("❌ Add REMOVAL_TX_HASH to .env");

  const [user] = await ethers.getSigners();

  const tokenAddress = process.env.TOKEN_ADDRESS;
  const wethAddress = process.env.WETH_ADDRESS;

  const erc20Abi = [
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
  ];

  const hoodi = new ethers.Contract(tokenAddress, erc20Abi, user);
  const weth = new ethers.Contract(wethAddress, erc20Abi, user);

  const hoodiSym = await hoodi.symbol();
  const wethSym = await weth.symbol();

  const hoodiDec = await hoodi.decimals();
  const wethDec = await weth.decimals();

  console.log("📡 Fetching removal transaction...");

  const receipt = await ethers.provider.getTransactionReceipt(removalTxHash);

  if (!receipt) throw new Error("❌ Tx not found.");

  console.log("✅ Tx found. Decoding logs...");

  let hoodiReturned = 0n;
  let wethReturned = 0n;

  // Parse logs
  for (const log of receipt.logs) {
    if (log.topics[0] !== TRANSFER_TOPIC) continue;

    const token = log.address.toLowerCase();
    const from = "0x" + log.topics[1].slice(26).toLowerCase();
    const to = "0x" + log.topics[2].slice(26).toLowerCase();
    const amount = BigInt(log.data);

    // We only care about tokens transferred *to the user*
    if (to !== user.address.toLowerCase()) continue;

    if (token === tokenAddress.toLowerCase()) {
      hoodiReturned += amount;
    }
    if (token === wethAddress.toLowerCase()) {
      wethReturned += amount;
    }
  }

  console.log(
    "✅ HOODI returned:",
    ethers.formatUnits(hoodiReturned, hoodiDec)
  );
  console.log("✅ WETH returned:", ethers.formatUnits(wethReturned, wethDec));

  // Get AFTER balances
  const after = {
    HOODI: ethers.formatUnits(await hoodi.balanceOf(user.address), hoodiDec),
    WETH: ethers.formatUnits(await weth.balanceOf(user.address), wethDec),
    ETH: ethers.formatEther(await ethers.provider.getBalance(user.address)),
  };

  // BEFORE = AFTER - returned tokens
  const before = {
    HOODI: (
      parseFloat(after.HOODI) -
      parseFloat(ethers.formatUnits(hoodiReturned, hoodiDec))
    ).toString(),
    WETH: (
      parseFloat(after.WETH) -
      parseFloat(ethers.formatUnits(wethReturned, wethDec))
    ).toString(),
    ETH: "N/A (ETH not returned directly)",
  };

  fs.writeFileSync("before-removal.json", JSON.stringify(before, null, 2));
  fs.writeFileSync("after-removal.json", JSON.stringify(after, null, 2));

  console.log("\n✅ BEFORE & AFTER snapshots saved:");
  console.log("📄 before-removal.json");
  console.log("📄 after-removal.json");
}

main().catch(console.error);
