// scripts/deploy-uniswap.cjs
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`🚀 Deployer: ${deployer.address}`);

  // 1. Deploy Factory
  const Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  console.log("🏭 Factory deployed at:", factory.target);

  // 2. Deploy WETH
  const WETH = await ethers.getContractFactory("WETH9");
  const weth = await WETH.deploy();
  await weth.waitForDeployment();
  console.log("💧 WETH deployed at:", weth.target);

  // 3. Deploy Router
  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(factory.target, weth.target);
  await router.waitForDeployment();
  console.log("🔁 Router deployed at:", router.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
