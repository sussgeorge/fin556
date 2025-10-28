// scripts/check-uniswap.cjs
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🔍 Checking Uniswap deployment...");

  // 🧾 Load from .env
  const routerAddress = process.env.UNISWAP_ROUTER_ADDRESS;
  const factoryAddress = process.env.UNISWAP_FACTORY_ADDRESS;
  const wethAddressEnv = process.env.WETH_ADDRESS;
  const tokenAddress = process.env.TOKEN_ADDRESS;

  if (!routerAddress) throw new Error("❌ UNISWAP_ROUTER_ADDRESS not set");
  if (!factoryAddress) throw new Error("❌ UNISWAP_FACTORY_ADDRESS not set");
  if (!tokenAddress) throw new Error("❌ TOKEN_ADDRESS not set");

  console.log(`\n🔁 Router:  ${routerAddress}`);
  console.log(`🏭 Factory: ${factoryAddress}`);
  if (wethAddressEnv) console.log(`💧 WETH (.env): ${wethAddressEnv}`);
  console.log(`🪙 Token:   ${tokenAddress}`);

  // 🔸 ABIs
  const routerAbi = [
    "function factory() external view returns (address)",
    "function WETH() external view returns (address)",
  ];

  const factoryAbi = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
    "function allPairsLength() external view returns (uint)",
    "function allPairs(uint) external view returns (address)",
  ];

  const wethAbi = [
    "function balanceOf(address) external view returns (uint256)",
  ];

  // 🔸 Contract instances
  const router = new ethers.Contract(routerAddress, routerAbi, ethers.provider);
  const factory = new ethers.Contract(
    factoryAddress,
    factoryAbi,
    ethers.provider
  );

  // 🔹 Check Router config
  const routerFactory = await router.factory();
  const routerWETH = await router.WETH();
  console.log(`\n🔁 Router -> factory(): ${routerFactory}`);
  console.log(`🔁 Router -> WETH():    ${routerWETH}`);

  // 🔹 Check Factory pair
  const wethForPair = wethAddressEnv || routerWETH;
  const pairAddress = await factory.getPair(tokenAddress, wethForPair);
  if (pairAddress === ethers.ZeroAddress) {
    console.log(`\n⚠️ No pair found for Token + WETH`);
  } else {
    console.log(`\n✅ Pair exists at: ${pairAddress}`);
  }

  // 🔹 Optional: Check WETH balance
  if (wethAddressEnv || routerWETH) {
    const weth = new ethers.Contract(wethForPair, wethAbi, ethers.provider);
    const [deployer] = await ethers.getSigners();
    const bal = await weth.balanceOf(deployer.address);
    console.log(
      `\n👛 WETH balance of ${deployer.address}: ${ethers.formatEther(
        bal
      )} WETH`
    );
  }

  // 🔸 Factory stats
  const totalPairs = await factory.allPairsLength();
  console.log(`\n📊 Total pairs on factory: ${totalPairs.toString()}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exitCode = 1;
});
