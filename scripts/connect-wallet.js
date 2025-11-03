// Select button and address field
const connectButton = document.getElementById("connectButton");
const walletAddress = document.getElementById("walletAddress");

// Function to connect the wallet
async function connectWallet() {
  if (typeof window.ethereum !== "undefined") {
    try {
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      const account = accounts[0];
      walletAddress.innerText = account;
      console.log("✅ Wallet connected:", account);
      localStorage.setItem("connectedWallet", account); // save connection
    } catch (err) {
      console.error("❌ Connection error:", err);
    }
  } else {
    alert("Please install MetaMask!");
  }
}

// Function to check if wallet already connected
async function checkWalletConnection() {
  if (typeof window.ethereum !== "undefined") {
    const accounts = await ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      const account = accounts[0];
      walletAddress.innerText = account;
      console.log("🔄 Wallet auto-reconnected:", account);
    } else {
      walletAddress.innerText = "Not Connected";
    }
  }
}

// Detect account or network changes in MetaMask
if (typeof window.ethereum !== "undefined") {
  ethereum.on("accountsChanged", (accounts) => {
    if (accounts.length > 0) {
      walletAddress.innerText = accounts[0];
      console.log("🔁 Account changed:", accounts[0]);
    } else {
      walletAddress.innerText = "Not Connected";
    }
  });

  ethereum.on("chainChanged", (_chainId) => {
    console.log("🌐 Network changed:", _chainId);
    window.location.reload(); // refresh DApp on network change
  });
}

// Add button click listener
connectButton.addEventListener("click", connectWallet);

// Auto-check connection when page loads
window.addEventListener("DOMContentLoaded", checkWalletConnection);
