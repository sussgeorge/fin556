import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get absolute path to project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const file = path.join(__dirname, "..", "deployments.json");

console.log("======================================");
console.log(" 🧾 HOODI ERC20 - Deployment History ");
console.log("======================================\n");

if (!fs.existsSync(file)) {
  console.log("⚠️  No deployments.json file found at:", file);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));

if (!Array.isArray(data) || data.length === 0) {
  console.log("⚠️  No deployments recorded yet.");
  process.exit(0);
}

// 🧭 Sort newest first by timestamp
data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

data.forEach((d, index) => {
  console.log(`🚀 Deployment #${index + 1}`);
  console.log(`🪙 Name:       ${d.name}`);
  console.log(`🔤 Symbol:     ${d.symbol}`);
  console.log(`💰 Supply:     ${d.supply}`);
  console.log(`📍 Address:    ${d.address}`);
  console.log(`🌐 Network:    ${d.network}`);
  console.log(`👤 Deployer:   ${d.deployer}`);
  console.log(`🕒 Timestamp:  ${d.timestamp}`);
  if (d.txHash) console.log(`🔗 Tx Hash:    ${d.txHash}`);
  console.log("--------------------------------------");
});

console.log(`✅ Total deployments: ${data.length}`);
