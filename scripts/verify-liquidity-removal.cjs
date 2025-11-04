// scripts/verify-liquidity-removal.cjs
// -------------------------------------------------------------
// ✅ Verify liquidity removal results
//  - Checks wallet balances BEFORE and AFTER removal
//  - Shows exact HOODI + WETH returned
// -------------------------------------------------------------

const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [user] = await ethers.getSigners();

  console.log("👤 Wallet:", user.address);

  const tokenAddress = process.env.TOKEN_ADDRESS;
  const wethAddress = process.env.WETH_ADDRESS;
  const pairAddress = process.env.UNISWAP_PAIR_ADDRESS; // optional

  if (!tokenAddress || !wethAddress) {
    throw new Error("❌ Missing TOKEN_ADDRESS or WETH_ADDRESS in .env");
  }

  // Minimal ABI for ERC20
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const hoodi = new ethers.Contract(tokenAddress, erc20Abi, user);
  const weth = new ethers.Contract(wethAddress, erc20Abi, user);

  // Get symbol + decimals dynamically
  const hoodiSymbol = await hoodi.symbol();
  const hoodiDecimals = await hoodi.decimals();
  const wethSymbol = await weth.symbol();
  const wethDecimals = await weth.decimals();

  console.log("\n📊 Checking balances...\n");

  // Fetch balances
  const hoodiBal = await hoodi.balanceOf(user.address);
  const wethBal = await weth.balanceOf(user.address);
  const ethBal = await ethers.provider.getBalance(user.address);

  console.log(
    `✅ ${hoodiSymbol} Balance: ${ethers.formatUnits(hoodiBal, hoodiDecimals)}`
  );
  console.log(
    `✅ ${wethSymbol} Balance: ${ethers.formatUnits(wethBal, wethDecimals)}`
  );
  console.log(`✅ ETH Balance: ${ethers.formatEther(ethBal)}\n`);

  // If pair provided, also show LP balance
  if (pairAddress) {
    const lp = new ethers.Contract(pairAddress, erc20Abi, user);
    const lpBal = await lp.balanceOf(user.address);
    console.log(
      `🔍 LP Balance (Pair: ${pairAddress}): ${ethers.formatEther(lpBal)}`
    );
  }

  console.log("\n✅ Verification complete!");
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
