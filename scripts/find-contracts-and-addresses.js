import fs from "fs";
import path from "path";

// --- CONFIG ---
const contractsDir = "./contracts";
const scriptsDir = "./scripts";

// Helper: Recursively get all files from a directory
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

// 1. 🪙 Find all contract names in contracts/
function listContractNames() {
  let contractNames = [];
  const files = getAllFiles(contractsDir);
  files.forEach((file) => {
    if (file.endsWith(".sol")) {
      const content = fs.readFileSync(file, "utf8");
      const matches = [...content.matchAll(/\bcontract\s+(\w+)/g)];
      matches.forEach((m) => contractNames.push({ name: m[1], file }));
    }
  });

  console.log("\n📄 Found Contracts:");
  if (contractNames.length === 0) {
    console.log("⚠️  No Solidity contracts found.");
  } else {
    contractNames.forEach((c, i) => {
      console.log(` ${i + 1}. ${c.name} (in ${c.file})`);
    });
  }
}

// 2. 🧭 Find all Ethereum addresses in scripts/
function listDeployedAddresses() {
  let addresses = [];
  const files = getAllFiles(scriptsDir);
  files.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    const matches = [...content.matchAll(/0x[a-fA-F0-9]{40}/g)];
    matches.forEach((m) => addresses.push({ address: m[0], file }));
  });

  console.log("\n📬 Found Addresses:");
  if (addresses.length === 0) {
    console.log("⚠️  No addresses found in scripts.");
  } else {
    addresses.forEach((a, i) => {
      console.log(` ${i + 1}. ${a.address} (in ${a.file})`);
    });
  }
}

console.log("======================================");
console.log(" 🧭 HOODI ERC20 - Contracts & Addresses ");
console.log("======================================");

listContractNames();
listDeployedAddresses();
