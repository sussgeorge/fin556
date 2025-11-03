// scripts/tools/compute-target-swap.cjs
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const factoryAddress = process.env.UNISWAP_FACTORY_ADDRESS;
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const wethAddress = process.env.WETH_ADDRESS;
  const targetPrice = parseFloat(process.env.WETH_PER_TOKEN || "0.0001"); // desired ratio

  const factory = await ethers.getContractAt(
    "UniswapV2Factory",
    factoryAddress
  );
  const pairAddress = await factory.getPair(tokenAddress, wethAddress);
  const pair = await ethers.getContractAt(
    [
      "function getReserves() view returns (uint112,uint112,uint32)",
      "function token0() view returns (address)",
      "function token1() view returns (address)",
    ],
    pairAddress
  );

  const [r0, r1] = await pair.getReserves();
  const t0 = await pair.token0();
  const t1 = await pair.token1();
  const reserveToken =
    t0.toLowerCase() === tokenAddress.toLowerCase() ? r0 : r1;
  const reserveWeth = t0.toLowerCase() === tokenAddress.toLowerCase() ? r1 : r0;

  const currentPrice =
    Number(ethers.formatUnits(reserveWeth, 18)) /
    Number(ethers.formatUnits(reserveToken, 18));
  console.log(`🔍 Current price (WETH per HOODI): ${currentPrice}`);

  const reserveT = Number(ethers.formatUnits(reserveToken, 18));
  const reserveW = Number(ethers.formatUnits(reserveWeth, 18));

  const targetReserveW = reserveT * targetPrice;
  const wethNeeded = targetReserveW - reserveW;

  console.log(`🎯 To reach target 1 HOODI ≈ ${targetPrice} WETH:`);
  console.log(`👉 Swap in roughly ${wethNeeded} WETH worth of HOODI or WETH`);

  console.log(
    "💡 Positive value → need to ADD WETH; negative → need to REMOVE WETH (swap HOODI→WETH)."
  );
}

main().catch(console.error);
