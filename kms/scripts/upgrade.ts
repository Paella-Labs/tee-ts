import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

// --- CONFIGURATION ---
// Update this with the address from the deployment script
const PROXY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

async function main() {
  if (!PROXY_ADDRESS || !PROXY_ADDRESS.startsWith("0x")) {
    console.error(
      "Error: PROXY_ADDRESS is not set correctly in scripts/upgrade.ts. Please set it to the deployed proxy address."
    );
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading contracts with the account:", deployer.address);
  console.log("Proxy address (CrossmintAppAuth):", PROXY_ADDRESS);

  // Get the current implementation address
  const currentImplAddress = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS
  );
  console.log("Current implementation address:", currentImplAddress);

  // Get some info about the current contract state
  const CrossmintAppAuth = await ethers.getContractFactory("CrossmintAppAuth");
  const appAuth = CrossmintAppAuth.attach(PROXY_ADDRESS);
  const appId = await appAuth.appId();
  const allowAnyDevice = await appAuth.allowAnyDevice();
  console.log("Current state before upgrade:");
  console.log("  App ID:", appId);
  console.log("  Allow Any Device:", allowAnyDevice);

  // Test adding a compose hash
  const testComposeHash = ethers.hexlify(ethers.randomBytes(32));
  const testReason = "Test compose hash added during upgrade process";
  console.log("Adding test compose hash:", testComposeHash);
  console.log("With reason:", testReason);
  const tx = await appAuth.addComposeHash(testComposeHash, testReason);
  await tx.wait();
  console.log("Compose hash added. Transaction hash:", tx.hash);

  // Test if the compose hash was added
  const isComposeHashAllowed = await appAuth.allowedComposeHashes(
    testComposeHash
  );
  console.log("Is test compose hash allowed:", isComposeHashAllowed);

  // Prepare for an upgrade with the same contract implementation (for future use)
  console.log("\nThis script demonstrates upgrading to a new implementation.");
  console.log("When you need to upgrade in the future, you can:");
  console.log(
    "1. Update the CrossmintAppAuth.sol contract with new functionality"
  );
  console.log("2. Compile the updated contract");
  console.log(
    "3. Use this script to upgrade the deployed proxy to the new implementation"
  );

  console.log("\nTo verify on Basescan:");
  console.log(
    `npx hardhat verify --network ${hre.network.name} ${currentImplAddress}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
