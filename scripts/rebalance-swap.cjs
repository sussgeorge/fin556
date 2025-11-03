// scripts/rebalance-swap.cjs
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Using wallet: ${deployer.address}`);

  const router = await ethers.getContractAt(
    [
      "function swapExactETHForTokens(uint amountOutMin,address[] calldata path,address to,uint deadline) payable returns (uint[])",
    ],
    process.env.UNISWAP_ROUTER_ADDRESS,
    deployer
  );

  const path = [process.env.WETH_ADDRESS, process.env.TOKEN_ADDRESS];
  const wethAmount = "5.45"; // from compute-target-swap.cjs output
  const deadline = Math.floor(Date.now() / 1000) + 600;

  console.log(`⏳ Swapping ${wethAmount} WETH → HOODI...`);
  const tx = await router.swapExactETHForTokens(
    0, // accept any output
    path,
    deployer.address,
    deadline,
    { value: ethers.parseEther(wethAmount), gasLimit: 2_000_000 }
  );

  console.log(`📡 Tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ Swap completed in block ${receipt.blockNumber}`);
}

main().catch(console.error);
