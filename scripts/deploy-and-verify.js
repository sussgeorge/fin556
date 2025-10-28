// deploy-and-verify.js
import pkg from "hardhat";
import dotenv from "dotenv";
import fs from "fs";

const { ethers, run, network } = pkg;
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();

  const name = process.env.TOKEN_NAME || "HoodiToken";
  const symbol = process.env.TOKEN_SYMBOL || "HOODI";
  const supplyHuman = process.env.TOKEN_SUPPLY || "1000000"; // 1,000,000
  const decimals = 18;
  const initialSupply = ethers.parseUnits(supplyHuman, decimals);

  console.log(`\n🚀 Deployer: ${deployer.address}`);
  console.log(`🪙 Deploying token: ${name} (${symbol})`);
  console.log(
    `💰 Initial Supply: ${supplyHuman} tokens (${initialSupply.toString()} wei)\n`
  );

  // Deploy contract
  const Token = await ethers.getContractFactory(
    "contracts/MyToken.sol:MyToken"
  );
  const token = await Token.deploy(initialSupply);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log(`✅ MyToken deployed at: ${tokenAddress}`);

  // 📝 Save to deployments.json
  const record = {
    name,
    symbol,
    supply: supplyHuman,
    decimals,
    address: tokenAddress,
    network: network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const file = "deployments.json";
  let data = [];

  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!Array.isArray(data)) data = [];
    } catch (e) {
      data = [];
    }
  }

  data.push(record);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`📝 Saved deployment info to ${file}`);

  // Wait for confirmations
  console.log(`\n⏳ Waiting for block confirmations...`);
  await token.deploymentTransaction().wait(5);

  // Verify contract
  console.log(`\n🔍 Verifying contract on Etherscan...`);
  try {
    await run("verify:verify", {
      address: tokenAddress,
      constructorArguments: [initialSupply],
      contract: "contracts/MyToken.sol:MyToken",
    });
    console.log("✅ Contract verified successfully!");
  } catch (err) {
    if (err.message.toLowerCase().includes("already verified")) {
      console.log("✅ Contract already verified!");
    } else {
      console.error("❌ Verification failed:", err);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
