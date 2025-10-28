// scripts/get-router-info.cjs
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const router = await ethers.getContractAt(
    "contracts/interfaces/IUniswapV2Router02.sol:IUniswapV2Router02",
    process.env.UNISWAP_ROUTER_ADDRESS
  );

  const factoryAddress = await router.factory();
  const wethAddress = await router.WETH();

  console.log("🏭 Factory Address:", factoryAddress);
  console.log("💰 WETH Address:", wethAddress);
}

main().catch(console.error);
