// scripts/add-liquidity.cjs
const { ethers } = require("hardhat");
require("dotenv").config();

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

  const syncing = await ethers.provider.send("eth_syncing", []);
  if (syncing !== false) {
    console.error("⏳ RPC node is still syncing... try again later.");
    process.exit(1);
  }

  const tokenAddress = process.env.TOKEN_ADDRESS;
  const routerAddress = process.env.UNISWAP_ROUTER_ADDRESS;
  const factoryAddress = process.env.UNISWAP_FACTORY_ADDRESS;
  const wethAddress = process.env.WETH_ADDRESS;
  if (!tokenAddress || !routerAddress || !factoryAddress || !wethAddress) {
    throw new Error("❌ Missing addresses in .env");
  }

  const token = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    tokenAddress
  );
  const router = await ethers.getContractAt("UniswapV2Router02", routerAddress);
  const factory = await ethers.getContractAt(
    "UniswapV2Factory",
    factoryAddress
  );

  console.log(`✅ Router:  ${routerAddress}`);
  console.log(`🏭 Factory: ${factoryAddress}`);
  console.log(`💰 WETH:    ${wethAddress}`);

  const tokenAmount = ethers.parseUnits("1000", 18);
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  const ethAmount = (ethBalance * BigInt(85)) / BigInt(100);
  console.log(`💰 ETH balance:   ${ethers.formatEther(ethBalance)}`);
  console.log(
    `💰 Token balance: ${ethers.formatUnits(
      await token.balanceOf(deployer.address),
      18
    )}`
  );
  console.log(`📊 ETH used for liquidity: ${ethers.formatEther(ethAmount)}`);

  if (ethAmount <= 0) throw new Error("❌ Not enough ETH to add liquidity.");

  // ✅ Approve if needed
  const allowance = await token.allowance(deployer.address, routerAddress);
  if (allowance < tokenAmount) {
    console.log(`⏳ Approving tokens...`);
    const approveTx = await token.approve(routerAddress, tokenAmount);
    await waitForTx(approveTx.hash);
    console.log(`✅ Approval confirmed`);
  } else {
    console.log(`✅ Router already approved for required amount.`);
  }

  // 🚀 Add liquidity
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
  console.log(
    `⏳ Adding ${ethers.formatUnits(
      tokenAmount,
      18
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
      { value: ethAmount }
    );
    console.log(`📡 Tx sent: ${addTx.hash}`);

    const receipt = await waitForTx(addTx.hash);
    console.log(`✅ Liquidity added in block ${receipt.blockNumber}`);
    console.log(`📝 Tx: ${receipt.transactionHash}`);
  } catch (err) {
    console.error("❌ Add liquidity failed:", err);
    process.exit(1);
  }

  const pairAddress = await factory.getPair(tokenAddress, wethAddress);
  if (pairAddress === ethers.ZeroAddress) {
    throw new Error("❌ No pool found. Check token/WETH addresses.");
  }
  console.log(`🏦 Pair: ${pairAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
