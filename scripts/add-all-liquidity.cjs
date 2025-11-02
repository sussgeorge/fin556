// scripts/add-all-liquidity.cjs
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

  // --- Hoodi Testnet addresses ---
  const routerAddress = "0x5b491662E508c2E405500C8BF9d67E5dF780cD8e";
  const factoryAddress = "0x342D7aeC78cd3b581eb67655B6B7Bb157328590e";
  const wethAddress = "0x7a1fd5C3185fe6261577AccEe220844Dc9026225";

  // --- your five token addresses ---
  const TOKENS = [
    "0x341aac04059a1e81e6390177c4e4d1992b422d84",
    "0x7Be129f76C4FC82752Dd1ddCCC154F2298e2a435",
    "0x9c3ff3d8686b0A3c1eFDFeaD92565275e6Fb8051",
    "0x97a47102478072710fBe2b2fE6c762b1F6cf2B06",
    "0xf2Bef143E425cd0aea1Db4ef584010F607059bB8",
  ];

  const router = await ethers.getContractAt("UniswapV2Router02", routerAddress);
  const factory = await ethers.getContractAt(
    "UniswapV2Factory",
    factoryAddress
  );

  console.log(`✅ Router:  ${routerAddress}`);
  console.log(`🏭 Factory: ${factoryAddress}`);
  console.log(`💰 WETH:    ${wethAddress}`);

  for (const tokenAddress of TOKENS) {
    console.log(`\n🌊 Adding liquidity for token ${tokenAddress}`);

    const token = await ethers.getContractAt(
      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
      tokenAddress
    );

    const tokenAmount = ethers.parseUnits("10", 18); // 10 tokens
    const ethAmount = ethers.parseEther("0.1"); // 0.1 ETH
    const deadline = Math.floor(Date.now() / 1000) + 600;

    // approve router if needed
    const allowance = await token.allowance(deployer.address, routerAddress);
    if (allowance < tokenAmount) {
      console.log("⏳ Approving token...");
      const approveTx = await token.approve(routerAddress, tokenAmount);
      await waitForTx(approveTx.hash);
      console.log("✅ Approval done");
    } else {
      console.log("✅ Already approved");
    }

    // add liquidity
    try {
      console.log(`💧 Adding 10 tokens + 0.1 ETH to ${tokenAddress} pool...`);
      const tx = await router.addLiquidityETH(
        tokenAddress,
        tokenAmount,
        0,
        0,
        deployer.address,
        deadline,
        { value: ethAmount }
      );
      console.log(`📡 Tx sent: ${tx.hash}`);
      const receipt = await waitForTx(tx.hash);
      console.log(`✅ Liquidity added in block ${receipt.blockNumber}`);
    } catch (e) {
      console.error(`❌ Failed for token ${tokenAddress}:`, e.message);
      continue;
    }

    // fetch pair
    const pair = await factory.getPair(tokenAddress, wethAddress);
    console.log(`🏦 Pair address: ${pair}`);
  }

  console.log("\n🎉 All tokens processed!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
