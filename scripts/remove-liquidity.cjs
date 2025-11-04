const { ethers } = require("hardhat");
require("dotenv").config();

async function waitForTx(tx) {
  const receipt = await tx.wait();
  return receipt;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`👤 Using wallet: ${signer.address}`);

  const token = process.env.TOKEN_ADDRESS;
  const weth = process.env.WETH_ADDRESS;
  const routerAddr = process.env.UNISWAP_ROUTER_ADDRESS;
  const factoryAddr = process.env.UNISWAP_FACTORY_ADDRESS;

  const routerAbi = [
    "function removeLiquidityETH(address token,uint liquidity,uint amountTokenMin,uint amountETHMin,address to,uint deadline) returns (uint amountToken,uint amountETH)",
  ];

  const lpAbi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 value) returns (bool)",
  ];

  const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddr);
  const router = new ethers.Contract(routerAddr, routerAbi, signer);

  const pair = await factory.getPair(token, weth);
  if (pair === ethers.ZeroAddress) {
    throw new Error("❌ Pair does NOT exist. Cannot remove liquidity.");
  }

  console.log(`✅ Pair located: ${pair}`);

  const lp = new ethers.Contract(pair, lpAbi, signer);

  // --- LP balance ---
  const lpBalance = await lp.balanceOf(signer.address);
  console.log(`💼 LP balance: ${ethers.formatEther(lpBalance)} LP tokens`);

  if (lpBalance === 0n) {
    throw new Error("❌ You do not hold any LP tokens.");
  }

  // --- Approve router ---
  console.log("⏳ Approving router to spend LP...");
  const approveTx = await lp.approve(routerAddr, lpBalance);
  await waitForTx(approveTx);
  console.log("✅ Router approved.");

  // --- Remove liquidity ---
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

  console.log(`⏳ Removing liquidity...`);
  const removeTx = await router.removeLiquidityETH(
    token,
    lpBalance, // Remove all LP tokens
    0, // Min token
    0, // Min ETH
    signer.address,
    deadline
  );

  const receipt = await waitForTx(removeTx);
  console.log(`✅ Liquidity removed! Hash: ${receipt.transactionHash}`);

  // --- Decode return values from event logs if needed ---
  console.log(
    "📤 Liquidity removal complete. Check returned token + ETH in wallet."
  );
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
