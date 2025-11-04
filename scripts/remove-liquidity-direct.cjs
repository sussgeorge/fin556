// remove-liquidity-direct.cjs
//-------------------------------------------------------------
// ✅ Remove Liquidity on Hoodi Using Direct LP Burn Method
//-------------------------------------------------------------

const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [user] = await ethers.getSigners();

  console.log(`\n👤 Wallet: ${user.address}`);

  // Load env
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
  const WETH_ADDRESS = process.env.WETH_ADDRESS;
  const FACTORY_ADDRESS = process.env.UNISWAP_FACTORY_ADDRESS;

  if (!TOKEN_ADDRESS || !WETH_ADDRESS || !FACTORY_ADDRESS) {
    throw new Error("❌ Missing TOKEN_ADDRESS / WETH_ADDRESS / FACTORY");
  }

  // Load factory
  const factory = await ethers.getContractAt(
    "UniswapV2Factory",
    FACTORY_ADDRESS
  );

  // Get pair
  const pair = await factory.getPair(TOKEN_ADDRESS, WETH_ADDRESS);

  if (pair === ethers.ZeroAddress) {
    throw new Error("❌ Pair does not exist.");
  }

  console.log(`✅ Pair located: ${pair}`);

  // Load LP Pair
  const lp = await ethers.getContractAt("UniswapV2Pair", pair);

  // ✅ Minimal ABI for HOODI token
  const token = new ethers.Contract(
    TOKEN_ADDRESS,
    [
      "function balanceOf(address) view returns (uint)",
      "function decimals() view returns (uint8)",
    ],
    user
  );

  // ✅ Minimal ABI for WETH
  const weth = new ethers.Contract(
    WETH_ADDRESS,
    [
      "function balanceOf(address) view returns (uint)",
      "function withdraw(uint) public",
    ],
    user
  );

  // Check LP balance
  const lpBalance = await lp.balanceOf(user.address);

  if (lpBalance === 0n) {
    throw new Error("❌ No LP tokens to remove.");
  }

  console.log(`💧 LP tokens available: ${lpBalance}`);

  // Approve pair to burn LP tokens
  console.log("🔐 Approving pair contract to burn LP...");
  const approveTx = await lp.approve(pair, lpBalance);
  console.log("⏳ Approve tx:", approveTx.hash);
  await approveTx.wait();
  console.log("✅ Approval confirmed");

  // Burn LP tokens → returns HOODI + WETH
  console.log("\n🔥 Burning LP tokens...");
  const burnTx = await lp.burn(user.address);
  console.log("⏳ Burn tx:", burnTx.hash);
  const burnReceipt = await burnTx.wait();
  console.log("✅ Liquidity removed!");

  // Check new balances
  const tokenReceived = await token.balanceOf(user.address);
  const wethReceived = await weth.balanceOf(user.address);

  console.log(
    "\n-------------------------------------------------------------"
  );
  console.log("✅ Returned Balances:");
  console.log(`- HOODI Returned: ${ethers.formatUnits(tokenReceived, 18)}`);
  console.log(`- WETH Returned:  ${ethers.formatEther(wethReceived)}`);
  console.log("-------------------------------------------------------------");

  // Optional: Unwrap WETH → ETH
  if (wethReceived > 0n) {
    console.log("\n🔄 Unwrapping WETH to ETH...");
    const unwrapTx = await weth.withdraw(wethReceived);
    console.log("⏳ Unwrap tx:", unwrapTx.hash);
    await unwrapTx.wait();
    console.log("✅ ETH Unwrapped and in wallet!");
  }

  console.log("\n🎯 Liquidity removal completed successfully.");
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
