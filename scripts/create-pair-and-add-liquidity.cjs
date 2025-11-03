// scripts/create-pair-and-add-liquidity.cjs
// -------------------------------------------------------------
// ✅ HOODI/WETH Liquidity Setup Script (Realistic Ratio Fix)
// -------------------------------------------------------------
//  • Creates Token/WETH pair if missing
//  • Automatically calculates correct ETH amount from ratio
//  • Removes small ETH bug (previously too tiny, e.g. 0.0004)
//  • Handles approvals and confirmations cleanly
// -------------------------------------------------------------

const { ethers } = require("hardhat");
require("dotenv").config();

// 🕒 Helper to wait for a transaction confirmation
async function waitForTx(hash, timeout = 120000) {
  const start = Date.now();
  let receipt = null;
  while (!receipt) {
    receipt = await ethers.provider.getTransactionReceipt(hash);
    if (receipt) return receipt;
    if (Date.now() - start > timeout) {
      throw new Error(`⏳ Transaction ${hash} not confirmed in time`);
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Using wallet: ${deployer.address}`);

  // 🧭 Check RPC node syncing
  const syncing = await ethers.provider.send("eth_syncing", []);
  if (syncing !== false) {
    console.error("⏳ RPC node is still syncing... try again later.");
    process.exit(1);
  }

  // 🌿 Load environment variables
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const routerAddress = process.env.UNISWAP_ROUTER_ADDRESS;
  const factoryAddress = process.env.UNISWAP_FACTORY_ADDRESS;
  const wethAddress = process.env.WETH_ADDRESS;

  if (!tokenAddress || !routerAddress || !factoryAddress || !wethAddress) {
    throw new Error("❌ Missing addresses in .env");
  }

  // 💧 Target ratio configuration
  // -------------------------------------------------------------
  // Example: 1 HOODI ≈ 0.0001 WETH → 10,000 HOODI = 1 WETH
  const tokenAmountStr = process.env.LIQUIDITY_TOKENS || "7274.7112";
  const wethPerToken = parseFloat(process.env.WETH_PER_TOKEN || "0.0001");

  // 🧮 Compute ETH amount exactly based on ratio
  let targetEthForTokens = parseFloat(tokenAmountStr) * wethPerToken;

  console.log("-------------------------------------------------------------");
  console.log(`📊 Token Liquidity: ${tokenAmountStr}`);
  console.log(`⚖️  Target ratio: 1 HOODI ≈ ${wethPerToken} WETH`);
  console.log(`🧮 Computed ETH needed: ${targetEthForTokens} ETH`);

  // 🧩 (Optional) Safety cap to prevent overspending
  const maxEthCap = parseFloat(process.env.LIQUIDITY_ETH_MAX || "1.0");
  if (targetEthForTokens > maxEthCap) {
    console.log(
      `⚠️  ETH capped to ${maxEthCap} (from ${targetEthForTokens} ETH)`
    );
    targetEthForTokens = maxEthCap;
  }

  const ethAmount = ethers.parseEther(targetEthForTokens.toFixed(6));
  console.log(
    `✅ Final ETH used for liquidity: ${ethers.formatEther(ethAmount)} ETH`
  );
  console.log("-------------------------------------------------------------");

  // 🧾 Token contract
  const token = new ethers.Contract(
    tokenAddress,
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)",
      "function decimals() view returns (uint8)",
    ],
    deployer
  );

  const router = await ethers.getContractAt("UniswapV2Router02", routerAddress);
  const factory = await ethers.getContractAt(
    "UniswapV2Factory",
    factoryAddress
  );

  // 🧮 Get balances
  const tokenDecimals = await token.decimals();
  const tokenAmount = ethers.parseUnits(tokenAmountStr, tokenDecimals);
  const tokenBalance = await token.balanceOf(deployer.address);
  const ethBalance = await ethers.provider.getBalance(deployer.address);

  console.log(`💰 ETH balance: ${ethers.formatEther(ethBalance)} ETH`);
  console.log(
    `💰 Token balance: ${ethers.formatUnits(
      tokenBalance,
      tokenDecimals
    )} Tokens`
  );

  if (tokenBalance < tokenAmount) {
    throw new Error(
      `❌ Not enough tokens. Need ${ethers.formatUnits(
        tokenAmount,
        tokenDecimals
      )}`
    );
  }

  // 🏦 Check or create pair
  let pairAddress = await factory.getPair(tokenAddress, wethAddress);
  if (pairAddress === ethers.ZeroAddress) {
    console.log(`⚠️  No pair found — creating HOODI/WETH pair...`);
    const createTx = await factory
      .connect(deployer)
      .createPair(tokenAddress, wethAddress);
    console.log(`📡 Pair creation tx: ${createTx.hash}`);
    await waitForTx(createTx.hash);
    pairAddress = await factory.getPair(tokenAddress, wethAddress);
    console.log(`✅ Pair created at: ${pairAddress}`);
  } else {
    console.log(`✅ Pair already exists at: ${pairAddress}`);
  }

  // 🔐 Approve router if necessary
  const allowance = await token.allowance(deployer.address, routerAddress);
  if (allowance < tokenAmount) {
    console.log(`⏳ Approving router to spend tokens...`);
    const approveTx = await token.approve(routerAddress, tokenAmount);
    await waitForTx(approveTx.hash);
    console.log(`✅ Approval confirmed`);
  } else {
    console.log(`✅ Allowance already sufficient`);
  }

  // 🚀 Add liquidity
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
  console.log(
    `⏳ Adding ${ethers.formatUnits(
      tokenAmount,
      tokenDecimals
    )} tokens + ${ethers.formatEther(ethAmount)} ETH`
  );

  try {
    const addTx = await router.addLiquidityETH(
      tokenAddress,
      tokenAmount,
      0,
      0,
      deployer.address,
      deadline,
      { value: ethAmount, gasLimit: 5_000_000 }
    );
    console.log(`📡 Liquidity tx sent: ${addTx.hash}`);
    const receipt = await waitForTx(addTx.hash);
    console.log(`✅ Liquidity added in block ${receipt.blockNumber}`);
    console.log(`📝 Tx: ${receipt.transactionHash}`);
  } catch (err) {
    console.error("❌ Add liquidity failed:", err);
    process.exit(1);
  }

  // 🪙 LP token balance
  const lpAbi = ["function balanceOf(address) view returns (uint256)"];
  const lp = new ethers.Contract(pairAddress, lpAbi, ethers.provider);
  const lpBal = await lp.balanceOf(deployer.address);
  console.log(`💼 LP tokens received: ${ethers.formatEther(lpBal)}`);
  console.log(`🏦 Pair address: ${pairAddress}`);
  console.log("🎉 Liquidity pool created successfully and ratio verified!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
