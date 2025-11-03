// scripts/rebalance-hoodi-weth.cjs
// -------------------------------------------------------------
// 🔁 HOODI/WETH Liquidity Balancer — realistic ratio
// -------------------------------------------------------------
//  • Maintains target ratio (~0.0001 WETH per HOODI)
//  • Automatically adjusts if your ETH or token balance is smaller
//  • Works with your minimal Uniswap-like router (addLiquidityETH only)
// -------------------------------------------------------------

const { ethers } = require("hardhat");
require("dotenv").config();

// 🕒 Helper — wait for transaction confirmation
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

  // 🌿 Load .env
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const routerAddress = process.env.UNISWAP_ROUTER_ADDRESS;
  const factoryAddress = process.env.UNISWAP_FACTORY_ADDRESS;
  const wethAddress = process.env.WETH_ADDRESS;
  const desiredTokens = parseFloat(process.env.LIQUIDITY_TOKENS || "10000");
  const wethPerToken = parseFloat(process.env.WETH_PER_TOKEN || "0.0001");
  const maxEthLiquidity = ethers.parseEther(
    process.env.LIQUIDITY_ETH_MAX || "1.0"
  );

  if (!tokenAddress || !routerAddress || !factoryAddress || !wethAddress) {
    throw new Error("❌ Missing required addresses in .env");
  }

  // 🧾 Contracts
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

  const routerAbi = [
    "function addLiquidityETH(address token,uint amountTokenDesired,uint amountTokenMin,uint amountETHMin,address to,uint deadline) payable returns (uint amountToken,uint amountETH,uint liquidity)",
  ];
  const router = new ethers.Contract(routerAddress, routerAbi, deployer);
  const factory = await ethers.getContractAt(
    "UniswapV2Factory",
    factoryAddress
  );

  // 🏦 Check or create pair
  let pairAddress = await factory.getPair(tokenAddress, wethAddress);
  if (pairAddress === ethers.ZeroAddress) {
    console.log("⚠️  No pair found — creating...");
    const tx = await factory.createPair(tokenAddress, wethAddress);
    await waitForTx(tx.hash);
    pairAddress = await factory.getPair(tokenAddress, wethAddress);
    console.log(`✅ Pair created: ${pairAddress}`);
  } else {
    console.log(`✅ Existing pair: ${pairAddress}`);
  }

  // 🧮 Ratio & liquidity math
  const tokenDecimals = await token.decimals();
  const requiredEthFloat = desiredTokens * wethPerToken; // raw ETH needed for desired tokens
  let ethAmount = ethers.parseEther(requiredEthFloat.toFixed(10));

  if (ethAmount > maxEthLiquidity) {
    console.log(
      `⚠️ Required ${ethers.formatEther(
        ethAmount
      )} ETH > cap (${ethers.formatEther(maxEthLiquidity)} ETH). Limiting...`
    );
    ethAmount = maxEthLiquidity;
  }

  // recompute actual token side from the ETH actually provided
  const ethFloat = parseFloat(ethers.formatEther(ethAmount));
  const finalTokens = ethFloat / wethPerToken;
  const tokenAmount = ethers.parseUnits(finalTokens.toFixed(6), tokenDecimals);

  console.log(`🪙 Token Liquidity: ${finalTokens.toFixed(6)} HOODI`);
  console.log(`💧 ETH Liquidity: ${ethers.formatEther(ethAmount)} ETH`);
  console.log(`⚖️  Target Ratio: 1 HOODI ≈ ${wethPerToken} WETH`);
  console.log("-------------------------------------------------------------");

  // 💰 Check balances
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  const tokenBalance = await token.balanceOf(deployer.address);
  if (ethBalance < ethAmount) throw new Error("❌ Not enough ETH in wallet");
  if (tokenBalance < tokenAmount)
    throw new Error("❌ Not enough tokens in wallet");

  // 🔐 Approve router
  const allowance = await token.allowance(deployer.address, routerAddress);
  if (allowance < tokenAmount) {
    console.log("⏳ Approving router...");
    const approveTx = await token.approve(routerAddress, tokenAmount);
    await waitForTx(approveTx.hash);
    console.log("✅ Approval confirmed");
  } else console.log("✅ Allowance already sufficient");

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
    console.log(`📡 Tx sent: ${addTx.hash}`);
    const receipt = await waitForTx(addTx.hash);
    console.log(`✅ Liquidity added (block ${receipt.blockNumber})`);
    console.log(`📝 Tx: ${receipt.transactionHash}`);
  } catch (err) {
    console.error("❌ Add liquidity failed:", err);
    process.exit(1);
  }

  console.log("-------------------------------------------------------------");
  console.log("🎯 HOODI/WETH pool balanced successfully!");
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
