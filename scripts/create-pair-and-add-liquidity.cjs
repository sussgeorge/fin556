// scripts/create-pair-and-add-liquidity.cjs
const { ethers } = require("hardhat");
require("dotenv").config();

// 🕒 Helper to wait for a transaction to confirm
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

  // 🧭 Check RPC node syncing status
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
  const tokenAmountStr = process.env.LIQUIDITY_TOKENS || "1000";
  const maxEthLiquidity = ethers.parseEther(
    process.env.LIQUIDITY_ETH_MAX || "0.00005"
  );

  if (!tokenAddress || !routerAddress || !factoryAddress || !wethAddress) {
    throw new Error("❌ Missing addresses in .env");
  }

  console.log(`✅ Router:  ${routerAddress}`);
  console.log(`🏭 Factory: ${factoryAddress}`);
  console.log(`💧 WETH:    ${wethAddress}`);
  console.log(`🪙 Token:   ${tokenAddress}`);
  console.log(`📊 Token Liquidity Amount: ${tokenAmountStr}`);
  console.log(
    `⚖️  Max ETH Liquidity Cap: ${ethers.formatEther(maxEthLiquidity)} ETH`
  );

  // 📝 Token Contract ABI (includes decimals)
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

  // 🧮 Get balances and decimals
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

  // 🧮 Determine ETH liquidity amount with safety cap
  let ethAmount = (ethBalance * BigInt(85)) / BigInt(100);
  if (ethAmount > maxEthLiquidity) {
    ethAmount = maxEthLiquidity;
  }

  if (ethAmount <= 0n) {
    throw new Error("❌ Not enough ETH to add liquidity.");
  }

  console.log(
    `📊 ETH used for liquidity: ${ethers.formatEther(ethAmount)} ETH`
  );

  // 🏦 Check if pair exists
  let pairAddress = await factory.getPair(tokenAddress, wethAddress);
  if (pairAddress === ethers.ZeroAddress) {
    console.log(`⚠️ No pair found for Token + WETH — creating...`);
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

  // 🔐 Approve token if needed
  const allowance = await token.allowance(deployer.address, routerAddress);
  if (allowance < tokenAmount) {
    console.log(`⏳ Approving router to spend tokens...`);
    const approveTx = await token.approve(routerAddress, tokenAmount);
    await waitForTx(approveTx.hash);
    console.log(`✅ Approval confirmed`);
  } else {
    console.log(`✅ Sufficient allowance already set`);
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

  // 🪙 Check LP token balance
  const lpAbi = ["function balanceOf(address) view returns (uint256)"];
  const lp = new ethers.Contract(pairAddress, lpAbi, ethers.provider);
  const lpBal = await lp.balanceOf(deployer.address);
  console.log(`💼 LP tokens received: ${ethers.formatEther(lpBal)}`);
  console.log(`🏦 Pair address: ${pairAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
