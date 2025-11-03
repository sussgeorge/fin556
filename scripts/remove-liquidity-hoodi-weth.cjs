// scripts/remove-liquidity-hoodi-weth.cjs
// -------------------------------------------------------------
// 💧 Liquidity Remover (Direct via Pair Contract)
// -------------------------------------------------------------
//  - Works with your minimal Uniswap-like router (no removeLiquidityETH)
//  - Checks LP balances and total supply
//  - Burns your LP tokens to withdraw HOODI + WETH
// -------------------------------------------------------------

const { ethers } = require("hardhat");
require("dotenv").config();

// Helper: wait for transaction confirmation
async function waitForTx(hash, timeout = 120000) {
  const start = Date.now();
  let receipt = null;
  while (!receipt) {
    receipt = await ethers.provider.getTransactionReceipt(hash);
    if (receipt) return receipt;
    if (Date.now() - start > timeout)
      throw new Error(`⏳ Tx ${hash} not confirmed in time`);
    await new Promise((res) => setTimeout(res, 3000));
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Using wallet: ${deployer.address}`);
  console.log("-------------------------------------------------------------");

  const tokenAddress = process.env.TOKEN_ADDRESS;
  const factoryAddress = process.env.UNISWAP_FACTORY_ADDRESS;
  const wethAddress = process.env.WETH_ADDRESS;

  if (!tokenAddress || !factoryAddress || !wethAddress)
    throw new Error(
      "❌ Missing TOKEN_ADDRESS, FACTORY_ADDRESS, or WETH_ADDRESS"
    );

  // 🏗️ Load factory + get pair
  const factory = await ethers.getContractAt(
    "UniswapV2Factory",
    factoryAddress
  );
  const pairAddress = await factory.getPair(tokenAddress, wethAddress);

  if (pairAddress === ethers.ZeroAddress)
    throw new Error("❌ Pair not found. No liquidity exists yet.");

  console.log(`✅ Found pair: ${pairAddress}`);

  // 🧾 Load pair contract (UniswapV2Pair ABI)
  const pair = new ethers.Contract(
    pairAddress,
    [
      "function balanceOf(address) view returns (uint256)",
      "function approve(address spender, uint256 value) external returns (bool)",
      "function totalSupply() view returns (uint256)",
      "function burn(address to) external returns (uint amount0, uint amount1)",
      "function token0() view returns (address)",
      "function token1() view returns (address)",
      "function transfer(address to, uint256 value) returns (bool)",
    ],
    deployer
  );

  // 🧮 Check LP balances
  const lpBalance = await pair.balanceOf(deployer.address);
  const totalSupply = await pair.totalSupply();
  console.log(`💰 Your LP balance: ${ethers.formatUnits(lpBalance, 18)}`);
  console.log(`🏦 Total LP supply: ${ethers.formatUnits(totalSupply, 18)}`);

  if (lpBalance === 0n) {
    console.log("⚠️  You don’t own any LP tokens — nothing to remove.");
    console.log("👉 This means someone else still holds the pool liquidity.");
    console.log(
      "-------------------------------------------------------------"
    );
    console.log(
      "If you used another wallet earlier, check that wallet’s LP balance."
    );
    return;
  }

  // 🧠 Show pair tokens
  const token0 = await pair.token0();
  const token1 = await pair.token1();
  console.log(`🔍 Pair tokens: ${token0} / ${token1}`);

  // 🔐 Approve pair to burn your LP tokens
  console.log("⏳ Approving LP burn...");
  const approveTx = await pair.approve(pairAddress, lpBalance);
  await waitForTx(approveTx.hash);
  console.log("✅ Approval confirmed");

  // 🔥 Burn LP tokens to remove liquidity
  console.log("🚀 Burning LP tokens and removing liquidity...");
  const burnTx = await pair.burn(deployer.address, { gasLimit: 3_000_000 });
  console.log(`📡 Tx sent: ${burnTx.hash}`);
  const receipt = await waitForTx(burnTx.hash);
  console.log(
    `✅ Liquidity removed successfully (block ${receipt.blockNumber})`
  );

  console.log("-------------------------------------------------------------");
  console.log("🎯 HOODI/WETH pool cleared — ready to rebalance!");
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
